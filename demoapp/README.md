# demoapp

Host app that embeds `@fig/stake-widget` from `figapp/packages/stake-widget`
via a local `file:` dependency (no npm workspaces).

## Setup

```bash
# library (once): install build tools for stake-widget
cd figapp/packages/stake-widget && npm install && cd -

cd demoapp
cp .env.example .env   # set VITE_FIGMENT_API_KEY etc.
npm install
npm run build:widget   # builds dist/ under stake-widget
npm run dev
```

Open http://localhost:5174

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build:widget` | Build `@fig/stake-widget` library |
| `npm run build` | Build widget, then this app |
| `npm run pack:widget` | Create a `.tgz` of the widget |

## Dependency

```json
"@fig/stake-widget": "file:../figapp/packages/stake-widget"
```

## Figment API / CORS

The app calls Figment via same-origin `/figment-api` (not `https://api.figment.io` from the browser).

- **Local:** `vite.config.js` proxies `/figment-api` → `https://api.figment.io`
- **Vercel:** repo-root `vercel.json` rewrites `/figment-api/:path*` → `https://api.figment.io/:path*`

Override with `VITE_FIGMENT_API_BASE` only if you need a different base.
