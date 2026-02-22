# Figment Elements Staking – React App

Simple React version of the staking widget. 
Connect a wallet, enter a SOL amount, and stake via the [Figment Solana Stake API](https://docs.figment.io/reference/solana-stake); the wallet signs and the transaction is broadcast via Figment.

## Environment

Copy `.env.example` to `.env` and set:

- **`VITE_FIGMENT_API_KEY`** (required) – Your Figment API key (used for stake and broadcast).
- **`VITE_SOLANA_CLUSTER`** – `devnet`, `mainnet`, or `testnet` (default: `devnet`).
- **`VITE_FIGMENT_VOTE_ACCOUNT`** (optional) – Validator vote account; if unset, devnet uses Figment’s default.

Do not commit `.env` or real API keys.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Build

```bash
npm run build
npm run preview   # optional: preview production build
```

## Structure

- `src/App.jsx` – Main app with Stake, Rewards, Activity tabs, connect wallet flow, and wallet modal
- `src/App.css` – Styles (same as original `figapp/styles.css`)
- `public/favicon.png` – Favicon
