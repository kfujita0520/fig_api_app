# @fig/stake-widget

Embeddable Figment Solana staking widget (migrated from `figapp-react`).

## Build

```bash
cd figapp/packages/stake-widget
npm install
npm run build
```

Or from the host app:

```bash
cd demoapp
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
    apiBaseUrl="/figment-api"
    apiKey={apiKey}
    showHeader={true}
  />
</FigmentStakeProviders>
```

### Props

| Prop | Default | Description |
|------|---------|-------------|
| `cluster` | `devnet` | `devnet` / `mainnet-beta` / `testnet` |
| `voteAccount` | Figment devnet default | Validator vote account |
| `apiBaseUrl` | `https://api.figment.io` | Figment API base (use a proxy to avoid CORS) |
| `apiKey` | `null` | Figment API key (prefer a BFF in production) |
| `showHeader` | `true` | Show header above the card |

## Pack (tarball)

```bash
npm run pack
# or: cd demoapp && npm run pack:widget
```
