# Figment Elements Staking – React App

React staking widget for Solana. Connect a wallet, stake SOL via the [Figment Solana Stake API](https://docs.figment.io/reference/overview-1), and manage positions. The app uses Figment for stake/undelegate/withdraw and broadcast; activity history is built from Solana RPC so it works from any device.

## Features

- **Stake tab** – Enter SOL amount (min 0.0025 SOL), optional “Max” (balance minus gas reserve). Creates a stake transaction via Figment; wallet signs and the transaction is broadcast via Figment. Shows validator (Figment), gross rewards rate, fee, and activation time.
- **Rewards tab** – Lists stake accounts (from Figment `GET /solana/stakes`) with active/inactive balance and status. **Undelegate** (with downward arrow): visible when status is not Inactive; enabled only when status is Active. **Withdrawal** (with downward arrow): visible when there is inactive balance and status is not Activating; withdraws full inactive balance to the connected wallet.
- **Activity tab** – Stake and unstake history from **Solana RPC** (`getSignaturesForAddress` + `getTransactions`). Filters Stake Program instructions (Delegate, Withdraw, Deactivate), shows date, type, amount, status, and an Explorer link. When devnet history has been pruned, unmatched Figment stakes are shown as inferred Stake/Unstake rows with a blank date and no transaction link.
- **Wallet** – Connect via Solana wallet adapter; header shows truncated address; click to open modal with network, balance, and Disconnect.

## Environment

Copy `.env.example` to `.env` and set:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIGMENT_API_KEY` | Yes | Figment API key (stake, broadcast, undelegate, withdraw, stakes). |
| `VITE_SOLANA_CLUSTER` | No | `devnet`, `mainnet-beta`, or `testnet`. Default: `devnet`. |
| `VITE_SOLANA_RPC_URL` | No | Full-history Solana RPC URL for reliable Activity history. Falls back to the public cluster RPC. |
| `VITE_FIGMENT_VOTE_ACCOUNT` | No | Validator vote account; if unset, devnet uses Figment default. |

Do not commit `.env` or real API keys.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview   # optional: preview production build
```

## Project structure

| Path | Description |
|------|-------------|
| `src/App.jsx` | Main app: tabs (Stake, Rewards, Activity), wallet connect/modal, panels and handlers. |
| `src/App.css` | Styles for layout, tabs, stake form, reward cards, activity list, buttons, modal. |
| `src/figmentStake.js` | Figment API client: `createStakeTransaction`, `broadcastSignedTransaction`, `createUndelegateTransaction`, `createWithdrawTransaction`, `getStakes`, `clusterToNetwork`. |
| `src/stakeActivity.js` | Activity from Solana RPC: `fetchStakeActivity` (signatures + transaction parsing), `mapActivityToUI` (optional Figment stakes enrichment). |
| `public/favicon.png` | Favicon. |

## APIs used

- **Figment** – [Stake](https://docs.figment.io/reference/solana-stake), [Broadcast](https://docs.figment.io/reference/solana-broadcast), [Stakes](https://docs.figment.io/reference/solana-stakes), [Undelegate](https://docs.figment.io/reference/solana-undelegate), [Withdraw](https://docs.figment.io/reference/solana-withdraw). In dev, requests go through the Vite proxy (`/figment-api`); in production, direct to `https://api.figment.io`.
- **Solana RPC** – `getSignaturesForAddress`, batched `getTransactions` (with legacy and v0 message support) to build activity history; wallet balance via `connection.getBalance`.
