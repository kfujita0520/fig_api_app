# demoapp2

Host app for `@fig/stake-widget` with an embedded **Figment BFF** under `api/`.
One Vercel project serves the static app and the serverless API (same origin).

```text
Browser
  →  /api/figment/solana/...
  →  api/index.js (adds FIGMENT_API_KEY)
  →  https://api.figment.io/solana/...
```

## Local setup

```bash
cd figapp/packages/stake-widget && npm install && cd -
cd demoapp2
cp .env.example .env   # set FIGMENT_API_KEY
npm install
npm run build:widget

# terminal 1 — BFF
npm run dev:api        # http://localhost:3000

# terminal 2 — Vite (proxies /api/figment → :3000)
npm run dev            # http://localhost:5175
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Express BFF on port 3000 (`!VERCEL`) |
| `npm run dev` | Vite on 5175 with `/api/figment` proxy |
| `npm run build:widget` | Build `@fig/stake-widget` |
| `npm run build` | Build widget, then this app |

## Vercel (single project)

1. **Root Directory** = `demoapp2`
2. **Install Command** (include widget + this app):

```bash
npm install --include=dev && npm install --prefix ../figapp/packages/stake-widget --include=dev
```

If Root is `demoapp2`, the sibling widget path is `../figapp/packages/stake-widget`.

Alternatively set Root to `./` (repo root) and use:

| Setting | Value |
|---------|--------|
| Install | `npm install --prefix demoapp2 --include=dev && npm install --prefix figapp/packages/stake-widget --include=dev` |
| Build | `cd figapp/packages/stake-widget && ./node_modules/.bin/vite build && cd ../../.. && cd demoapp2 && ./node_modules/.bin/vite build` |
| Output | `demoapp2/dist` |

With **Root = `demoapp2`**:

| Setting | Value |
|---------|--------|
| Build | `npm run build --prefix ../figapp/packages/stake-widget && npx vite build` |
| Output | `dist` |

3. **Environment Variables**
   - `FIGMENT_API_KEY` → **Secret**
   - `VITE_SOLANA_CLUSTER` → `devnet` (optional)
   - Do **not** set `VITE_FIGMENT_API_KEY`
   - `VITE_FIGMENT_API_BASE` optional; default in code is `/api/figment`

`vercel.json` rewrites `/api/figment/*` to the Express serverless entry at `/api`.

## Security

- Never commit `.env` or real keys.
- Prefer rotating the Figment key if it was ever shipped as `VITE_FIGMENT_API_KEY`.
