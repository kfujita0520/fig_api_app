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
  const apiBaseUrl = import.meta.env.DEV
    ? '/figment-api'
    : 'https://api.figment.io';

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
