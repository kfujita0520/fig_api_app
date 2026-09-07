# demoWidget

Host app for `@fig/stake-widget` with an embedded **Figment BFF** under `api/`.
One Vercel project serves the static app and the serverless API (same origin).

```text
Browser
  →  /api/figment/solana/...     (FIGMENT_API_KEY on server)
  →  /api/solana/activity        (Figment activities + stakes first;
                                  SOLANA_RPC_URL only to fill gaps)
```

## Local setup

```bash
cd widget/packages/stake-widget && npm install && cd -
cd demoWidget
cp .env.example .env   # set FIGMENT_API_KEY (+ optional SOLANA_RPC_URL)
npm install
npm run build:widget

# terminal 1 — BFF
npm run dev:api        # http://localhost:3000

# terminal 2 — Vite (proxies /api/figment and /api/solana → :3000)
npm run dev            # http://localhost:5175
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Express BFF on port 3000 (`!VERCEL`) |
| `npm run dev` | Vite on 5175 with `/api/figment` + `/api/solana` proxy |
| `npm run build:widget` | Build `@fig/stake-widget` |
| `npm run build` | Build widget, then this app |

## Vercel (single project)

1. **Root Directory** = `demoWidget`
2. **Install Command** (include widget + this app):

```bash
npm install --include=dev && npm install --prefix ../widget/packages/stake-widget --include=dev
```

If Root is `demoWidget`, the sibling widget path is `../widget/packages/stake-widget`.

Alternatively set Root to `./` (repo root) and use:

| Setting | Value |
|---------|--------|
| Install | `npm install --prefix demoWidget --include=dev && npm install --prefix widget/packages/stake-widget --include=dev` |
| Build | `cd widget/packages/stake-widget && ./node_modules/.bin/vite build && cd ../../.. && cd demoWidget && ./node_modules/.bin/vite build` |
| Output | `demoWidget/dist` |

With **Root = `demoWidget`**:

| Setting | Value |
|---------|--------|
| Build | `npm run build --prefix ../widget/packages/stake-widget && npx vite build` |
| Output | `dist` |

3. **Environment Variables**
   - `FIGMENT_API_KEY` → **Secret**
   - `SOLANA_RPC_URL` → **Secret** (optional; Activity gap-fill only; falls back to public cluster RPC)
   - `VITE_SOLANA_CLUSTER` → `devnet` (optional). Wallet `Connection` uses `clusterApiUrl` (e.g. `https://api.devnet.solana.com`)
   - Do **not** set `VITE_FIGMENT_API_KEY` or `VITE_SOLANA_RPC_URL`
   - `VITE_FIGMENT_API_BASE` optional; default in code is `/api/figment`

`vercel.json` rewrites `/api/figment/*` and `/api/solana/*` to the Express serverless entry at `/api`.

## Security

- Never commit `.env` or real keys.
- Prefer rotating the Figment key if it was ever shipped as `VITE_FIGMENT_API_KEY`.
