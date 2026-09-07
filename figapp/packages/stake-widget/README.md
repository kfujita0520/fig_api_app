# @fig/stake-widget

Embeddable Figment Solana staking widget (migrated from `figapp-react`).

Figment API calls go to a **host BFF** (default `/api/figment`). The widget never accepts or sends an API key — keep `FIGMENT_API_KEY` on the server only.

## Build

```bash
cd figapp/packages/stake-widget
npm install
npm run build
```

Or from the host app:

```bash
cd demoapp2
npm run build:widget
```

Output: `dist/stake-widget.js`, `dist/stake-widget.css`

## Usage (local file dependency)

```json
{
  "dependencies": {
    "@fig/stake-widget": "file:../figapp/packages/stake-widget"
  }
}
```

```jsx
import { FigmentStakeProviders, FigmentStakeWidget } from '@fig/stake-widget';
import '@fig/stake-widget/styles.css';

<FigmentStakeProviders cluster="devnet" endpoint={rpcUrl} wallets={wallets}>
  <FigmentStakeWidget
    cluster="devnet"
    voteAccount="..."
    apiBaseUrl="/api/figment"
    showHeader={true}
  />
</FigmentStakeProviders>
```

See `demoapp2/api` for a sample BFF that adds `FIGMENT_API_KEY` server-side.

### Props

| Prop | Default | Description |
|------|---------|-------------|
| `cluster` | `devnet` | `devnet` / `mainnet-beta` / `testnet` |
| `voteAccount` | Figment devnet default | Validator vote account |
| `apiBaseUrl` | `/api/figment` | Host BFF base URL |
| `showHeader` | `true` | Show header above the card |

## Pack (tarball)

```bash
npm run pack
# or: cd demoapp2 && npm run pack:widget
```
