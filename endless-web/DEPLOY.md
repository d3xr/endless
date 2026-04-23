# Endless Web App — Deployment

The web app ships in three build flavors. Pick the one that matches how
you plan to use it.

| Build    | Who it's for                        | Auth                                     | env file          |
|----------|-------------------------------------|------------------------------------------|-------------------|
| `dev`    | You, on localhost                   | OAuth redirect to ZenMoney               | `.env.development`|
| `prod`   | Self-hoster on their own domain     | OAuth, or PIN-locked encrypted token     | `.env.production` |
| `demo`   | Public read-only demo (no real data)| None — persona picker only               | `.env.demo`       |

## 0. Prerequisites

Create a ZenMoney OAuth application — free, takes two minutes:
<https://api.zenmoney.ru/> → `Создать приложение`. Copy the
`consumer_key` and `consumer_secret` it gives you.

## 1. Dev (localhost)

```bash
cp .env.development .env.development.local
# Edit .env.development.local — paste your client_id / client_secret
pnpm i
pnpm dev
# http://localhost:3000 — click "Войти" and OAuth back to localhost
```

If you'd rather skip the OAuth handshake on every reload, drop a plain token
into `.env.development.local` as `REACT_APP_DEV_TOKEN=...`. The app will
auto-login on load. **Localhost only** — this envvar is ignored in production
and demo builds.

## 2. Self-hosted private instance

You have two auth options for a prod build.

### Option A — OAuth (recommended)

```
# .env.production.local
REACT_APP_REDIRECT_URI=https://your-domain.example
REACT_APP_CLIENT_ID=your_zenmoney_client_id
REACT_APP_CLIENT_SECRET=your_zenmoney_client_secret
```

Each visitor logs in with their own ZenMoney account. Nothing personal
is baked into the bundle.

### Option B — PIN-locked single-user deploy

Useful if it's only *you* using the deploy and you don't want an OAuth
round-trip every session.

```bash
node scripts/encrypt-token.mjs
# Interactive:
#   1. paste a ZenMoney token (grab one with `endless token` in the CLI package)
#   2. choose a PIN
#   3. copy the REACT_APP_ENCRYPTED_TOKEN=... line it prints
```

Paste that line into `.env.production.local` alongside the OAuth envs.
The build will include the encrypted blob. It's useless without the PIN —
AES-GCM auth tag guarantees wrong PINs fail cryptographically, not
just "look wrong."

### Build & ship

```bash
pnpm build
# dist/ is the static bundle — upload to nginx / Vercel / Netlify / S3
```

### Security reality check

- 4-digit PIN × PBKDF2(200k iter, ~500ms/attempt on client) ≈ 1.5h to
  brute-force all 10,000 combinations. Use a 6+ digit PIN if you want
  real resistance. Client-side rate limit (5 attempts → 60s) is
  localStorage, so an attacker with DevTools bypasses it.
- For real isolation put the deploy behind nginx Basic Auth, a VPN, or
  a Tailscale node. The PIN is a speed bump, not a wall.

## 3. Public demo build

```bash
pnpm build -- --mode demo
# or: cp .env.demo .env.production.local && pnpm build
```

With `REACT_APP_DEMO_ONLY=true` the auth code paths short-circuit. There
is no token, encrypted or otherwise, in the bundle. Visitors land on the
persona picker and generate a 5-year synthetic history locally in the
browser. This is what `endless.vyroslo.ru` runs.

## 4. Rotating a PIN

There's no recovery — re-encrypt with a new PIN:

```bash
node scripts/encrypt-token.mjs
```

Swap the `REACT_APP_ENCRYPTED_TOKEN` line in `.env.production.local`,
rebuild, redeploy.
