# standAppDemo

Self-contained staking sample: **UI source is in this folder**, plus a same-origin BFF.
It does **not** depend on `@fig/stake-widget`. Use this when you want an app you can copy and run without the widget package.

For the packaged widget, see `../widget` and `../widgetDemo`.

```text
Browser
  →  /api/figment/solana/...     (FIGMENT_API_KEY on server)
  →  /api/solana/activity        (Figment activities + stakes first;
                                  SOLANA_RPC_URL only to fill gaps)

src/stake-widget/               (inlined UI; not an npm package)
```

Keys never use a `VITE_` prefix. Wallet `Connection` uses public `clusterApiUrl` (e.g. `https://api.devnet.solana.com`).

## Local setup

```bash
cd standAppDemo
cp .env.example .env   # set FIGMENT_API_KEY (+ optional SOLANA_RPC_URL)
npm install

# terminal 1 — BFF (port 3001)
npm run dev:api

# terminal 2 — Vite (port 5173, proxies /api/* → :3001)
npm run dev
```

Open http://localhost:5173

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Express BFF on port 3001 |
| `npm run dev` | Vite on 5173 with `/api/figment` + `/api/solana` proxy |
| `npm run build` | Production build of this app only |

## Layout

| Path | Description |
|------|-------------|
| `src/main.jsx` | Host: wallet adapters + `FigmentStakeWidget` |
| `src/stake-widget/` | Inlined UI (from `widget/packages/stake-widget/src`) |
| `api/` | BFF: Figment proxy + Activity aggregation |

## Vercel (single project)

1. **Root Directory** = `standAppDemo`
2. **Install:** `npm install --include=dev`
3. **Build:** `npx vite build`
4. **Output:** `dist`
5. **Environment**
   - `FIGMENT_API_KEY` → **Secret**
   - `SOLANA_RPC_URL` → **Secret** (optional; Activity gap-fill)
   - `VITE_SOLANA_CLUSTER` → `devnet` (optional)

`vercel.json` rewrites `/api/figment/*` and `/api/solana/*` to the Express entry at `/api`.

## Security

- Never commit `.env` or real keys.
