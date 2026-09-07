import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { FigmentStakeProviders, FigmentStakeWidget } from '@fig/stake-widget';
import '@fig/stake-widget/styles.css';
import './index.css';

function App() {
  const cluster = import.meta.env.VITE_SOLANA_CLUSTER || 'devnet';
  const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL?.trim() || undefined;
  const voteAccount = import.meta.env.VITE_FIGMENT_VOTE_ACCOUNT || undefined;
  // Same-origin BFF (Vite proxies locally; Vercel serves api/index.js). No client apiKey.
  const apiBaseUrl = import.meta.env.VITE_FIGMENT_API_BASE || '/api/figment';

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <div className="demoapp">
      <header className="demoapp__header">
        <p className="demoapp__eyebrow">Stake Widget Demo App 2 (BFF)</p>
      </header>

      <FigmentStakeProviders cluster={cluster} endpoint={rpcUrl} wallets={wallets}>
        <FigmentStakeWidget
          cluster={cluster}
          voteAccount={voteAccount}
          apiBaseUrl={apiBaseUrl}
        />
      </FigmentStakeProviders>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
