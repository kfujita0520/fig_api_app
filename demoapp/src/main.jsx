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
  const apiKey = import.meta.env.VITE_FIGMENT_API_KEY || null;
  // Same-origin proxy path avoids CORS in both Vite dev and Vercel production.
  // Dev: vite.config.js proxies /figment-api → api.figment.io
  // Prod: vercel.json rewrites /figment-api → api.figment.io
  const apiBaseUrl = import.meta.env.VITE_FIGMENT_API_BASE || '/figment-api';

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <div className="demoapp">
      <header className="demoapp__header">
        <p className="demoapp__eyebrow">Stake Widget Demo App</p>
        
      </header>

      <FigmentStakeProviders cluster={cluster} endpoint={rpcUrl} wallets={wallets}>
        <FigmentStakeWidget
          cluster={cluster}
          voteAccount={voteAccount}
          apiBaseUrl={apiBaseUrl}
          apiKey={apiKey}
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
