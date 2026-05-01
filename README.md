# Lily — Discord Bot Site

Marketing site, command catalog, and live interactive dashboard with real Discord OAuth login.

## Pages
- `/` — landing page
- `/commands` — searchable catalog of all 190+ commands
- `/dashboard` — live dashboard (login with Discord, configure features per server)

## API
- `GET  /api/auth/login`     — start Discord OAuth (redirects to Discord)
- `GET  /api/auth/callback`  — OAuth redirect target
- `POST /api/auth/logout`    — destroy session
- `GET  /api/auth/me`        — `{ authenticated, user, guilds[] }`
- `GET  /api/health`         — health check

## Run locally

```bash
pnpm install
pnpm run dev
# server listens on $PORT (default 3000)
```

## Required environment variables / secrets
- `DISCORD_CLIENT_SECRET` — your Discord app's OAuth secret (Developer Portal → OAuth2)
- `SESSION_SECRET`        — any long random string used to sign session cookies

## Discord application
The OAuth client ID is hard-coded to `1493552809415671830` in `src/auth.ts`.
In the Discord Developer Portal → OAuth2 → Redirects, add:
```
http://localhost:3000/api/auth/callback
https://YOUR-DOMAIN/api/auth/callback
```

## Files in this zip
- `public/` — static HTML, JSON, image
- `src/`    — Express + TypeScript source (app, auth, routes)
- `build.mjs`, `tsconfig.json`, `package.json` — build config
- `.replit-artifact/artifact.toml` — artifact descriptor (only relevant inside Replit)
