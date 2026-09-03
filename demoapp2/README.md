# demoapp2

Host app that embeds `@fig/stake-widget` and talks to the sibling [`api`](../api/README.md) BFF so `FIGMENT_API_KEY` never reaches the browser.

`demoapp` is unchanged (legacy client-key / Vite proxy mode). Use this app for key-hiding mode.

## Setup

```bash
# 1) API BFF
cd api
cp .env.example .env   # FIGMENT_API_KEY, ALLOWED_ORIGINS includes :5175
npm install
npm run dev            # http://localhost:3000

# 2) This app (another terminal)
cd figapp/packages/stake-widget && npm install && cd -
cd demoapp2
cp .env.example .env
npm install
npm run build:widget
npm run dev            # http://localhost:5175
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite on port **5175** |
| `npm run build:widget` | Build `@fig/stake-widget` |
| `npm run build` | Build widget, then this app |

## Figment API

Defaults to `http://localhost:3000/api/figment` with **no** client API key.

```bash
# demoapp2/.env
VITE_FIGMENT_API_BASE=http://localhost:3000/api/figment
# production:
# VITE_FIGMENT_API_BASE=https://<api-deployment>/api/figment
```

Ensure `api` has `ALLOWED_ORIGINS` including `http://localhost:5175` (and your production origin).
