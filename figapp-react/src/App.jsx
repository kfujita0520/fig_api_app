import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { VersionedTransaction } from '@solana/web3.js';
import { createStakeTransaction, broadcastSignedTransaction, clusterToNetwork, getStakes, createUndelegateTransaction } from './figmentStake';
import { fetchStakeActivity, mapActivityToUI } from './stakeActivity';

const TABS = ['stake', 'rewards', 'activity'];

function formatStakeBalance(value) {
  if (value == null || value === '') return '0 SOL';
  const n = parseFloat(value);
  if (Number.isNaN(n)) return String(value) + ' SOL';
  if (n >= 1e8) return (n / 1e9).toFixed(4) + ' SOL';
  return n.toFixed(4) + ' SOL';
}

function statusToDot(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'green';
  if (s === 'activating' || s === 'exiting' || s === 'inactive') return 'yellow';
  return 'green';
}

function DetailRow({ label, value, children }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      {children ?? <span className="detail-value">{value}</span>}
    </div>
  );
}

function shortenAddress(address, chars = 4) {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

const MIN_STAKE_SOL = 0.0025;
const STAKE_GAS_RESERVE_SOL = 0.01;
const DEFAULT_VOTE_ACCOUNT_DEVNET = '21Jxcw74j5SvajRKE3PvNifu26CVorF7DF8HyanKNzZ3';

function hexToBytes(hex) {
  const h = hex.replace(/^0x/i, '');
  const arr = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) arr[i / 2] = parseInt(h.slice(i, i + 2), 16);
  return arr;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function StakePanel({ walletConnected, onConnectWallet, balanceSol, onBalanceRefetch }) {
  const { publicKey, signTransaction } = useWallet();

  const [stakeAmountSol, setStakeAmountSol] = useState('');
  const [isStaking, setIsStaking] = useState(false);
  const [error, setError] = useState('');
  const [successTxHash, setSuccessTxHash] = useState('');

  const validatorCell = (
    <div className="validator-cell">
      <span className="validator-icon">F</span>
      <span className="detail-value">Figment</span>
    </div>
  );

  const balanceDisplay = balanceSol != null ? `${balanceSol.toFixed(2)} SOL` : '— SOL';
  const cluster = import.meta.env.VITE_SOLANA_CLUSTER || 'devnet';
  const network = clusterToNetwork(cluster);
  const voteAccount = import.meta.env.VITE_FIGMENT_VOTE_ACCOUNT || DEFAULT_VOTE_ACCOUNT_DEVNET;

  const handleMax = () => {
    if (balanceSol != null && balanceSol > 0) {
      const max = Math.max(0, balanceSol - STAKE_GAS_RESERVE_SOL);
      setStakeAmountSol(max.toFixed(4));
    }
  };

  const handleStake = async () => {
    setError('');
    setSuccessTxHash('');
    const amount = parseFloat(stakeAmountSol);
    if (!publicKey) {
      setError('Wallet not connected');
      return;
    }
    if (Number.isNaN(amount) || amount < MIN_STAKE_SOL) {
      setError(`Minimum stake is ${MIN_STAKE_SOL} SOL`);
      return;
    }
    if (balanceSol != null && amount > balanceSol) {
      setError('Insufficient balance');
      return;
    }

    setIsStaking(true);
    try {
      const { unsignedTxHex } = await createStakeTransaction({
        fundingAccount: publicKey.toBase58(),
        voteAccount,
        amountSol: amount,
        network,
      });

      const txBytes = hexToBytes(unsignedTxHex);
      const versionedTx = VersionedTransaction.deserialize(txBytes);

      if (!signTransaction) {
        throw new Error('Wallet does not support signing transactions');
      }
      const signedTx = await signTransaction(versionedTx);
      const signedHex = bytesToHex(signedTx.serialize());

      const { transactionHash } = await broadcastSignedTransaction({
        signedPayloadHex: signedHex,
        network,
      });

      setSuccessTxHash(transactionHash);
      setStakeAmountSol('');
      if (typeof onBalanceRefetch === 'function') onBalanceRefetch();
    } catch (e) {
      const message = e?.message || String(e);
      setError(message);
    } finally {
      setIsStaking(false);
    }
  };

  const amountNum = parseFloat(stakeAmountSol);
  const amountValid =
    !Number.isNaN(amountNum) &&
    amountNum >= MIN_STAKE_SOL &&
    (balanceSol == null || amountNum <= balanceSol);
  const stakeBtnDisabled = isStaking || !amountValid;

  if (!walletConnected) {
    return (
      <div className="stake-connect-wrap is-visible">
        <div className="stake-input-area">
          <div className="stake-input-row">
            <div>
              <div className="stake-amount">0 SOL</div>
              <div className="stake-fiat">↑↓ $0</div>
            </div>
            <button type="button" className="stake-max-btn">Max</button>
          </div>
        </div>
        <div className="details">
          <DetailRow label="Gross Rewards Rate" value="6.3%" />
          <DetailRow label="Validator">{validatorCell}</DetailRow>
          <DetailRow label="Fee" value="7%" />
          <DetailRow label="Activation Time" value="~1 day" />
        </div>
        <button type="button" className="connect-wallet-btn" onClick={onConnectWallet}>
          Connect Wallet
        </button>
      </div>
    );
  }

  const clusterForExplorer = cluster === 'mainnet-beta' ? 'mainnet-beta' : cluster || 'devnet';
  const explorerTxUrl = successTxHash
    ? `https://explorer.solana.com/tx/${successTxHash}${clusterForExplorer === 'mainnet-beta' ? '' : '?cluster=' + clusterForExplorer}`
    : '';

  return (
    <div className="stake-connected-wrap is-visible">
      <div className="stake-balance-box">
        <div className="stake-row">
          <div className="stake-balance-left">
            <div className="stake-amount-editable">
              <input
                type="number"
                className="stake-amount-input-inline"
                placeholder="0"
                min={MIN_STAKE_SOL}
                step="any"
                value={stakeAmountSol}
                onChange={(e) => setStakeAmountSol(e.target.value)}
                disabled={isStaking}
                aria-label="Amount to stake in SOL"
              />
              <span className="stake-amount-unit">SOL</span>
            </div>
            <div className="stake-fiat">↑↓ $0</div>
          </div>
          <button
            type="button"
            className="stake-btn"
            onClick={handleMax}
            disabled={isStaking || balanceSol == null || balanceSol <= 0}
            title={`Set to balance minus ${STAKE_GAS_RESERVE_SOL} SOL gas reserve`}
          >
            ↑ {balanceDisplay}
          </button>
        </div>
      </div>
      <div className="details">
        <DetailRow label="Gross Rewards Rate" value="6.3%" />
        <DetailRow label="Validator">{validatorCell}</DetailRow>
        <DetailRow label="Fee" value="7%" />
        <DetailRow label="Activation Time" value="~1 day" />
      </div>
      {error && <div className="stake-error">{error}</div>}
      {successTxHash && (
        <div className="stake-success">
          Staked successfully.{' '}
          {explorerTxUrl ? (
            <a href={explorerTxUrl} target="_blank" rel="noopener noreferrer">
              View transaction
            </a>
          ) : null}
        </div>
      )}
      <button
        type="button"
        className="stake-submit-btn"
        onClick={handleStake}
        disabled={stakeBtnDisabled}
      >
        {isStaking ? 'Staking…' : 'Stake'}
      </button>
      <div className="minimum">0.0025 SOL minimum</div>
    </div>
  );
}

function RewardsPanel({ onBalanceRefetch }) {
  const { publicKey, signTransaction } = useWallet();
  const cluster = import.meta.env.VITE_SOLANA_CLUSTER || 'devnet';
  const network = clusterToNetwork(cluster);

  const [stakes, setStakes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stakesRefetchKey, setStakesRefetchKey] = useState(0);
  const [undelegatingStakeAccount, setUndelegatingStakeAccount] = useState(null);
  const [undelegateError, setUndelegateError] = useState('');

  useEffect(() => {
    setError('');
    const stakeAuthority = publicKey ? publicKey.toBase58() : undefined;
    if (!stakeAuthority) {
      setStakes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getStakes({ network, stakeAuthority })
      .then((data) => {
        if (!cancelled) setStakes(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || 'Failed to load stakes');
          setStakes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [network, publicKey, stakesRefetchKey]);

  const handleUndelegate = async (stake) => {
    const stakeAccount = stake.stake_account;
    if (!stakeAccount || !publicKey) return;
    setUndelegateError('');
    setUndelegatingStakeAccount(stakeAccount);
    try {
      const { unsignedTxHex } = await createUndelegateTransaction({ stakeAccount, network });
      const txBytes = hexToBytes(unsignedTxHex);
      const versionedTx = VersionedTransaction.deserialize(txBytes);
      if (!signTransaction) {
        throw new Error('Wallet does not support signing transactions');
      }
      const signedTx = await signTransaction(versionedTx);
      const signedHex = bytesToHex(signedTx.serialize());
      await broadcastSignedTransaction({ signedPayloadHex: signedHex, network });
      setStakesRefetchKey((k) => k + 1);
      if (typeof onBalanceRefetch === 'function') onBalanceRefetch();
    } catch (e) {
      setUndelegateError(e?.message || String(e));
    } finally {
      setUndelegatingStakeAccount(null);
    }
  };

  const totalActive = stakes.reduce((sum, s) => sum + (parseFloat(s.active_balance) || 0), 0);
  const totalInactive = stakes.reduce((sum, s) => sum + (parseFloat(s.inactive_balance) || 0), 0);
  const totalSol = stakes.reduce((sum, s) => {
    const b = parseFloat(s.balance);
    if (!Number.isNaN(b)) return sum + b;
    return sum + (parseFloat(s.active_balance) || 0) + (parseFloat(s.inactive_balance) || 0);
  }, 0);
  const toSol = (v) => (v >= 1e8 ? (v / 1e9).toFixed(2) : v.toFixed(2));
  const displayTotal = toSol(totalSol);
  const displayActive = toSol(totalActive);
  const displayActivating = toSol(totalInactive);

  return (
    <div className="rewards-panel">
      <div className="rewards-stake-section">
        <div className="rewards-stake-total">{displayTotal} <span className="unit">SOL</span></div>
        <div className="rewards-pills">
          <span className="rewards-pill active">{displayActive} Active</span>
          <span className="rewards-pill activating">{displayActivating} Activating</span>
        </div>
      </div>
      <div className="rewards-rewards-section">
        <span className="rewards-info-icon" title="Rewards info">i</span>
        <div className="rewards-rewards-label">Rewards</div>
        <div className="rewards-na">N/A</div>
      </div>
      {error && <div className="stake-error">{error}</div>}
      {undelegateError && <div className="stake-error">{undelegateError}</div>}
      {loading && <div className="rewards-loading">Loading stakes…</div>}
      {!loading && !error && stakes.length === 0 && !publicKey && (
        <div className="rewards-empty">Connect your wallet to see stake positions.</div>
      )}
      {!loading && !error && stakes.length === 0 && publicKey && (
        <div className="rewards-empty">No stake accounts. Stake SOL to see positions here.</div>
      )}
      {!loading && stakes.map((s) => (
        <div key={s.id || s.stake_account} className="reward-card">
          <div className="reward-card-header">
            <div className="reward-card-address">
              <span className="chain-icon" />
              {shortenAddress(s.stake_account || '')}
            </div>
            <div className="reward-card-status">
              <span className={`status-dot ${statusToDot(s.status)}`} />
              {s.status || '—'}
            </div>
          </div>
          <div className="reward-card-metrics details">
            <DetailRow label="Active Stake" value={formatStakeBalance(s.active_balance)} />
            <DetailRow label="Inactive Stake" value={formatStakeBalance(s.inactive_balance)} />
            <DetailRow label="Rewards" value="N/A" />
          </div>
          <button
            type="button"
            className="undelegate-btn"
            disabled={undelegatingStakeAccount != null || (s.status || '').toLowerCase() !== 'active'}
            onClick={() => handleUndelegate(s)}
          >
            {undelegatingStakeAccount === s.stake_account ? (
              'Signing…'
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17l10-10M7 7v10h10" />
                </svg>
                Undelegate
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

function ActivityPanel({ connection, publicKey, isActive, refetchKey, cluster }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isActive || !connection || !publicKey) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    const network = clusterToNetwork(cluster || 'devnet');
    Promise.all([
      fetchStakeActivity(connection, publicKey),
      getStakes({ network, stakeAuthority: publicKey.toBase58() }).catch(() => []),
    ])
      .then(([entries, stakes]) => {
        if (!cancelled) setItems(mapActivityToUI(entries, stakes));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || 'Failed to load activity');
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [connection, publicKey, isActive, refetchKey, cluster]);

  const explorerBase = 'https://explorer.solana.com';
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster || 'devnet'}`;

  if (!publicKey) {
    return (
      <div className="activity-list">
        <div className="rewards-empty">Connect your wallet to see stake and unstake activity.</div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="activity-list">
        <div className="rewards-loading">Loading activity…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="activity-list">
        <div className="stake-error">{error}</div>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="activity-list">
        <div className="rewards-empty">No stake or unstake activity yet.</div>
      </div>
    );
  }
  return (
    <div className="activity-list">
      {items.map((item, i) => (
        <div key={item.transactionHash ? `${item.transactionHash}-${i}` : i} className="activity-item">
          <div className="activity-left">
            <span className="activity-date">{item.date}</span>
            <span className={`activity-badge ${item.type}`}>{item.type === 'stake' ? 'Stake' : 'Unstake'}</span>
            <span className="activity-amount">{item.amount}</span>
          </div>
          <div className="activity-right">
            <span className={`status-dot ${item.statusDot}`} />
            <div className="activity-status-wrap">
              <span className="activity-status">{item.status}</span>
              {item.note && <span className="activity-status-note">{item.note}</span>}
            </div>
            {item.transactionHash && (
              <a
                href={`${explorerBase}/tx/${item.transactionHash}${clusterParam}`}
                target="_blank"
                rel="noopener noreferrer"
                className="activity-tx-link"
                title="View on explorer"
                aria-label="View transaction on explorer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const EXPLORER_URL = 'https://explorer.solana.com';

function WalletModal({ isOpen, onClose, publicKey, balanceSol, onDisconnect }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleDisconnect = () => {
    onClose();
    onDisconnect();
  };

  const addressStr = publicKey ? publicKey.toBase58() : '';
  const shortAddress = shortenAddress(addressStr);
  const explorerLink = addressStr
    ? `${EXPLORER_URL}/address/${addressStr}${import.meta.env.VITE_SOLANA_CLUSTER === 'mainnet-beta' ? '' : '?cluster=' + (import.meta.env.VITE_SOLANA_CLUSTER || 'devnet')}`
    : '#';

  return (
    <div
      className="modal-backdrop is-open"
      aria-hidden="false"
      onClick={handleBackdropClick}
    >
      <div
        className="modal-wallet"
        role="dialog"
        aria-label="Wallet details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-wallet-address">
          <span className="chain-icon" />
          <span className="address-text">{shortAddress}</span>
          <a
            href={explorerLink}
            target="_blank"
            rel="noopener noreferrer"
            className="modal-wallet-link"
            title="View on explorer"
            aria-label="View on explorer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
        <div className="modal-wallet-details details">
          <DetailRow label="Network" value={import.meta.env.VITE_SOLANA_CLUSTER === 'mainnet-beta' ? 'Mainnet' : 'Devnet'} />
          <DetailRow label="Available Balance" value={balanceSol != null ? `${balanceSol.toFixed(2)} SOL` : '—'} />
        </div>
        <button type="button" className="modal-disconnect" onClick={handleDisconnect}>
          Disconnect
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('stake');
  const [modalOpen, setModalOpen] = useState(false);
  const [balance, setBalance] = useState(null);
  const [balanceRefetchKey, setBalanceRefetchKey] = useState(0);
  const [activityRefetchKey, setActivityRefetchKey] = useState(0);

  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();

  const walletConnected = !!connected;
  const shortAddress = publicKey ? shortenAddress(publicKey.toBase58()) : '';
  const cluster = import.meta.env.VITE_SOLANA_CLUSTER || 'devnet';

  useEffect(() => {
    if (!publicKey || !connection) return;
    let cancelled = false;
    connection.getBalance(publicKey).then((lamports) => {
      if (!cancelled) setBalance(lamports / 1e9);
    }).catch(() => {
      if (!cancelled) setBalance(null);
    });
    return () => { cancelled = true; };
  }, [publicKey, connection, balanceRefetchKey]);

  const handleBalanceRefetch = () => {
    setBalanceRefetchKey((k) => k + 1);
    setActivityRefetchKey((k) => k + 1);
  };

  const handleConnectWallet = () => {
    setWalletModalVisible(true);
  };

  const handleAddressClick = () => {
    if (walletConnected) setModalOpen(true);
  };

  const handleAddressKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && walletConnected) {
      e.preventDefault();
      setModalOpen(true);
    }
  };

  const handleModalDisconnect = () => {
    disconnect();
    setModalOpen(false);
    setBalance(null);
  };

  return (
    <>
      <div className="header">
        <h1>Figment Elements</h1>
        <p>UI components for embeddable staking</p>
      </div>

      <div className="widget">
        <div className="widget-top">
          <div className="chain">
            <span className="chain-icon" />
            Solana
          </div>
          <div
            id="widget-address"
            className={`address ${!walletConnected ? 'wallet-hidden' : ''}`}
            role="button"
            tabIndex={0}
            title="Wallet details"
            onClick={handleAddressClick}
            onKeyDown={handleAddressKeyDown}
          >
            <span className="address-icon" />
            <span className="address-text">{shortAddress || 'AyE8...FJb3'}</span>
          </div>
        </div>

        <div className="tabs" role="tablist">
          {TABS.map((tabId) => (
            <div
              key={tabId}
              className={`tab ${activeTab === tabId ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === tabId}
              data-tab={tabId}
              onClick={() => setActiveTab(tabId)}
            >
              {tabId.charAt(0).toUpperCase() + tabId.slice(1)}
            </div>
          ))}
        </div>

        <div className="content">
          <div
            id="panel-stake"
            className={`tab-panel ${activeTab === 'stake' ? 'active' : ''}`}
            role="tabpanel"
          >
            <StakePanel
              walletConnected={walletConnected}
              onConnectWallet={handleConnectWallet}
              balanceSol={balance}
              onBalanceRefetch={handleBalanceRefetch}
            />
          </div>
          <div
            id="panel-rewards"
            className={`tab-panel ${activeTab === 'rewards' ? 'active' : ''}`}
            role="tabpanel"
          >
            <RewardsPanel onBalanceRefetch={handleBalanceRefetch} />
          </div>
          <div
            id="panel-activity"
            className={`tab-panel ${activeTab === 'activity' ? 'active' : ''}`}
            role="tabpanel"
          >
            <ActivityPanel
              connection={connection}
              publicKey={publicKey}
              isActive={activeTab === 'activity'}
              refetchKey={activityRefetchKey}
              cluster={cluster}
            />
          </div>
        </div>
      </div>

      <WalletModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        publicKey={publicKey}
        balanceSol={balance}
        onDisconnect={handleModalDisconnect}
      />
    </>
  );
}
