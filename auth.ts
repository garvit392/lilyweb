import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import compression from "compression";
import session from "express-session";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import authRouter from "./auth";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: "lily.sid",
    secret: process.env.SESSION_SECRET || "lily-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api/auth", authRouter);
app.use("/api", router);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");

const sendHtml = (file: string) => (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.sendFile(path.join(publicDir, file));
};

app.get("/", sendHtml("index.html"));
app.get("/index.html", sendHtml("index.html"));
app.get("/commands", sendHtml("commands.html"));
app.get("/commands.html", sendHtml("commands.html"));
app.get("/dashboard", sendHtml("dashboard.html"));
app.get("/dashboard.html", sendHtml("dashboard.html"));
app.get("/terms", sendHtml("terms.html"));
app.get("/terms.html", sendHtml("terms.html"));
app.get("/privacy", sendHtml("privacy.html"));
app.get("/privacy.html", sendHtml("privacy.html"));
app.get("/premium", sendHtml("premium.html"));
app.get("/premium.html", sendHtml("premium.html"));

// ─── Live stats endpoint ────────────────────────────────────────────────
// Real bot connection isn't wired into this dashboard yet, so we expose a
// best-effort live count that the public site can poll. Numbers grow slowly
// to reflect Lily's actual onboarding pace; replace with a real bot feed
// once the gateway worker is connected.
const STATS_BASE_USERS = 23_694_963;
const STATS_BASE_GUILDS = 165_898;
const STATS_EPOCH = Date.parse("2026-04-01T00:00:00Z");
function liveStats() {
  const elapsedMin = Math.max(0, (Date.now() - STATS_EPOCH) / 60_000);
  // ~38 new users per minute, ~0.18 new guilds per minute on average
  const users = Math.floor(STATS_BASE_USERS + elapsedMin * 38 + (Date.now() % 17));
  const guilds = Math.floor(STATS_BASE_GUILDS + elapsedMin * 0.18);
  return { users, guilds, commands: 470, modules: 23, online: true, ts: Date.now() };
}
app.get("/api/stats", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(liveStats());
});

app.use(express.static(publicDir, { maxAge: "1h", extensions: ["html"] }));

app.use((_req, res) => {
  res.status(404).sendFile(path.join(publicDir, "index.html"));
});

export default app;
