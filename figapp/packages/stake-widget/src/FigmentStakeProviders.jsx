import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * Optional wallet / connection providers for hosts that do not already wrap the tree.
 *
 * @param {{
 *   children: import('react').ReactNode,
 *   cluster?: string,
 *   endpoint?: string,
 *   wallets?: unknown[],
 *   autoConnect?: boolean,
 * }} props
 */
export function FigmentStakeProviders({
  children,
  cluster = 'devnet',
  endpoint,
  wallets = [],
  autoConnect = true,
}) {
  const resolvedEndpoint = useMemo(
    () => endpoint || clusterApiUrl(cluster),
    [cluster, endpoint]
  );

  return (
    <ConnectionProvider endpoint={resolvedEndpoint}>
      <WalletProvider wallets={wallets} autoConnect={autoConnect}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
