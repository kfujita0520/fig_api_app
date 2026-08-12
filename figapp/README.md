# figapp

Libraries for the embeddable Figment Solana staking widget.

## Packages

| Path | Description |
|------|-------------|
| `packages/stake-widget` | Library: `import { FigmentStakeWidget } from '@fig/stake-widget'` |

## Host app

| Path | Description |
|------|-------------|
| `../demoapp` | Vite host that consumes the widget via `file:` |

## Commands

```bash
# Build the library
cd packages/stake-widget && npm install && npm run build

# Or from the host app
cd ../demoapp && npm run build:widget && npm run dev
```
