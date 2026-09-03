# api

Standalone **BFF** for Figment Solana APIs. The browser never sees `FIGMENT_API_KEY`.

```text
Host app (demoapp2 / widget)
  →  GET|POST https://<this-service>/api/figment/solana/...
  →  Server adds x-api-key
  →  https://api.figment.io/solana/...
```

Uses **Express**: locally `app.listen`, on Vercel the same app is exported as a serverless function (`process.env.VERCEL` is set).

## Endpoints (proxied)

| Client path | Upstream |
|-------------|----------|
| `/api/figment/solana/stake` | `POST /solana/stake` |
| `/api/figment/solana/broadcast` | `POST /solana/broadcast` |
| `/api/figment/solana/undelegate` | `POST /solana/undelegate` |
| `/api/figment/solana/withdraw` | `POST /solana/withdraw` |
| `/api/figment/solana/stakes` | `GET /solana/stakes` |

Other paths return `404`.

## Local setup

```bash
cd api
cp .env.example .env   # set FIGMENT_API_KEY (+ ALLOWED_ORIGINS)
npm install
npm run dev            # http://localhost:3000 (no Vercel CLI required)
```

Smoke test:

```bash
curl "http://localhost:3000/api/figment/solana/stakes?network=devnet"
```

## Deploy (separate Vercel project)

1. Create a Vercel project with **Root Directory** = `api`
2. Environment Variables:
   - `FIGMENT_API_KEY` → **Secret**
   - `ALLOWED_ORIGINS` → Config, e.g. `https://your-demoapp2.vercel.app,http://localhost:5175`
3. Deploy (`npm run deploy` or Vercel dashboard)

## Calling from a host app

Point the widget at this service **without** a client API key:

```jsx
<FigmentStakeWidget
  cluster="devnet"
  apiBaseUrl="https://<api-deployment>/api/figment"
  // do not pass apiKey
/>
```

Or set `VITE_FIGMENT_API_BASE` in the host app (see `demoapp2`).

## Security notes

- Do not commit `.env` or real keys.
- Prefer rotating `FIGMENT_API_KEY` if it was ever embedded as `VITE_FIGMENT_API_KEY`.
- Restrict `ALLOWED_ORIGINS` to your frontends only.
