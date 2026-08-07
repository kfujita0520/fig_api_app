# demo

Host app that embeds `@fig/stake-widget` using a **local tarball** (`.tgz`)
dependency. Use this folder as a reference for client-side install, similar to
how you would ship the widget without a monorepo `file:../` path.

The sibling `demoapp/` project uses a live `file:` path to the package source
and is separate; this `demo/` app is intentionally tarball-based.

## Prerequisites

- Node.js + npm
- Built package sources under `figapp/packages/stake-widget`

## 1. Create the package tarball

From the repository root (or any cwd), build and pack the widget package:

```bash
cd figapp/packages/stake-widget
npm install
npm run pack
```

`npm run pack` runs `vite build` and then `npm pack`.  
You should get a file such as:

```text
figapp/packages/stake-widget/fig-stake-widget-0.1.0.tgz
```

The exact name is derived from `package.json` `name` and `version`  
(`@fig/stake-widget` @ `0.1.0` → `fig-stake-widget-0.1.0.tgz`).

Confirm contents (optional):

```bash
npm pack --dry-run
# should list dist/stake-widget.js, dist/stake-widget.css, package.json
```

Copy the tarball into this directory:

```bash
cp fig-stake-widget-0.1.0.tgz ../../../demo/
# if run from figapp/packages/stake-widget:
#   ../../../demo is repo/demo
```

> This repo’s `demo/package.json` expects  
> `file:./fig-stake-widget-0.1.0.tgz`  
> If you change the package version, rename the file and update the dependency path.

## 2. Install dependencies (including the tarball)

```bash
cd demo
cp .env.example .env   # set VITE_FIGMENT_API_KEY etc.
npm install
```

What `npm install` does with the tarball entry:

1. Reads `"@fig/stake-widget": "file:./fig-stake-widget-0.1.0.tgz"`
2. Unpacks the archive into `node_modules/@fig/stake-widget/`
3. Installs other dependencies (React, Solana wallet adapters, …)
4. Records the lockfile entry for the local `.tgz`

Equivalent one-off form (adds / refreshes the same dependency):

```bash
npm install ./fig-stake-widget-0.1.0.tgz
```

## 3. Run the host app

```bash
npm run dev
```

Open http://localhost:5175

## App structure

| Path | Description |
|------|-------------|
| `src/main.jsx` | Host that passes env config as props to the widget |
| `package.json` | Depends on `@fig/stake-widget` via `file:./….tgz` |
| `.env.example` | Vite env template (`VITE_*`) |

```jsx
import { FigmentStakeProviders, FigmentStakeWidget } from '@fig/stake-widget';
import '@fig/stake-widget/styles.css';
```

## Updating the widget

1. Bump `version` in `figapp/packages/stake-widget/package.json` if needed  
2. `cd figapp/packages/stake-widget && npm run pack`  
3. Copy the new `.tgz` into `demo/`  
4. Update `package.json` dependency path if the filename changed  
5. `cd demo && npm install` (or `npm install ./fig-stake-widget-X.Y.Z.tgz`)

## Peer dependencies

The tarball only ships library `dist/` (`files: ["dist"]`).  
React, Solana, and wallet-adapter packages are **peerDependencies** of the widget
and are listed on this host so `npm install` provides them.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (port 5175) |
| `npm run build` | Production build of this host app |
| `npm run preview` | Preview the production build |
