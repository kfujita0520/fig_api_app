# @fig/stake-widget

Embeddable Figment Solana staking widget (migrated from `figapp-react`).

Figment API calls go to a **host BFF** (default `/api/figment`). Activity history goes to `/api/solana/activity`: the server calls Figment `GET /solana/activities` and `GET /solana/stakes` first, then fills gaps from Solana RPC (`SOLANA_RPC_URL` or public cluster). The widget never accepts API keys or private RPC URLs.

## Build

```bash
cd widget/packages/stake-widget
npm install
npm run build
```

Or from the host app:

```bash
cd widgetDemo
npm run build:widget
```

Output: `dist/stake-widget.js`, `dist/stake-widget.css`

## Usage (local file dependency)

```json
{
  "dependencies": {
    "@fig/stake-widget": "file:../widget/packages/stake-widget"
  }
}
```

```jsx
import { FigmentStakeProviders, FigmentStakeWidget } from '@fig/stake-widget';
import '@fig/stake-widget/styles.css';

<FigmentStakeProviders cluster="devnet" wallets={wallets}>
  <FigmentStakeWidget
    cluster="devnet"
    voteAccount="..."
    apiBaseUrl="/api/figment"
    showHeader={true}
  />
</FigmentStakeProviders>
```

See `widgetDemo/api` for a sample BFF that adds `FIGMENT_API_KEY` / `SOLANA_RPC_URL` server-side.

### Props

| Prop | Default | Description |
|------|---------|-------------|
| `cluster` | `devnet` | `devnet` / `mainnet-beta` / `testnet` |
| `voteAccount` | Figment devnet default | Validator vote account |
| `apiBaseUrl` | `/api/figment` | Host Figment BFF base URL |
| `activityApiUrl` | derived from `apiBaseUrl` | Host Activity BFF URL (`/api/solana/activity`) |
| `showHeader` | `true` | Show header above the card |

## Pack (tarball)

```bash
npm run pack
# or: cd widgetDemo && npm run pack:widget
```
