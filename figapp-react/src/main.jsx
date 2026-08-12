import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import App from './App.jsx';
import './App.css';

import '@solana/wallet-adapter-react-ui/styles.css';

function WalletAdapterApp() {
  const cluster = import.meta.env.VITE_SOLANA_CLUSTER || 'devnet';
  const configuredRpcUrl = import.meta.env.VITE_SOLANA_RPC_URL?.trim();
  const endpoint = useMemo(
    () => configuredRpcUrl || clusterApiUrl(cluster),
    [cluster, configuredRpcUrl]
  );
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WalletAdapterApp />
  </StrictMode>
);
