import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";

const router: Router = Router();

const CLIENT_ID = "1493552809415671830";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const SCOPE = "identify guilds";
const ADMIN_PERM = 0x8n;

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string;
};

type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  approximate_member_count?: number;
};

type SessionData = {
  state?: string;
  returnTo?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  user?: DiscordUser;
  guilds?: DiscordGuild[];
};

declare module "express-session" {
  interface SessionData {
    auth?: SessionData;
  }
}

function getRedirectUri(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/api/auth/callback`;
}

router.get("/login", (req: Request, res: Response) => {
  if (!CLIENT_SECRET) {
    res.status(500).send("DISCORD_CLIENT_SECRET is not configured.");
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  req.session.auth = req.session.auth || {};
  req.session.auth.state = state;
  req.session.auth.returnTo = (req.query.returnTo as string) || "/dashboard";
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: SCOPE,
    prompt: "none",
    state,
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get("/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const auth = req.session.auth || {};
    if (!code || !state || state !== auth.state) {
      res.status(400).send("Invalid OAuth state. Try logging in again.");
      return;
    }

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: getRedirectUri(req),
      }),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      res.status(502).send(`Discord token exchange failed: ${txt}`);
      return;
    }
    const token = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const [userRes, guildsRes] = await Promise.all([
      fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }),
      fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }),
    ]);
    if (!userRes.ok || !guildsRes.ok) {
      res.status(502).send("Failed to fetch Discord user or guild list.");
      return;
    }
    const user = (await userRes.json()) as DiscordUser;
    const guilds = (await guildsRes.json()) as DiscordGuild[];

    req.session.auth = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      user,
      guilds,
    };

    const returnTo = auth.returnTo && auth.returnTo.startsWith("/") ? auth.returnTo : "/dashboard";
    res.redirect(returnTo);
  } catch (err) {
    res.status(500).send(`OAuth callback error: ${(err as Error).message}`);
  }
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", (req: Request, res: Response) => {
  const auth = req.session.auth;
  if (!auth?.user) {
    res.json({ authenticated: false });
    return;
  }
  const manageable = (auth.guilds || []).filter((g) => {
    try {
      const perms = BigInt(g.permissions);
      return g.owner || (perms & ADMIN_PERM) === ADMIN_PERM;
    } catch {
      return g.owner;
    }
  });
  res.json({
    authenticated: true,
    user: {
      id: auth.user.id,
      username: auth.user.global_name || auth.user.username,
      handle: auth.user.username,
      avatarUrl: auth.user.avatar
        ? `https://cdn.discordapp.com/avatars/${auth.user.id}/${auth.user.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${(parseInt(auth.user.id) >> 22) % 6}.png`,
    },
    guilds: manageable.map((g) => ({
      id: g.id,
      name: g.name,
      iconUrl: g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`
        : null,
      owner: g.owner,
    })),
  });
});

export default router;
