import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { VersionedTransaction } from '@solana/web3.js';
import { createStakeTransaction, broadcastSignedTransaction, clusterToNetwork } from './figmentStake';

const TABS = ['stake', 'rewards', 'activity'];

const ACTIVITY_ITEMS = [
  { date: 'FEB 19', type: 'stake', amount: '0.11 SOL', status: 'Activating', note: '1 day until active', statusDot: 'yellow' },
  { date: 'FEB 19', type: 'unstake', amount: '0.098 SOL', status: 'Exiting', note: '1 day until exit', statusDot: 'yellow' },
  { date: 'FEB 9', type: 'stake', amount: '0.1 SOL', status: 'Active', note: null, statusDot: 'green' },
  { date: 'FEB 9', type: 'stake', amount: '0.1 SOL', status: 'Active', note: null, statusDot: 'green' },
];

const REWARD_CARDS = [
  { address: 'Z4QK...aCR5', status: 'Active', statusDot: 'green', activeStake: '0.098 SOL', inactiveStake: '0 SOL', rewards: '0 SOL' },
  { address: '8jrK...mohE', status: 'Exiting', statusDot: 'yellow', activeStake: '0.098 SOL', inactiveStake: '0 SOL', rewards: '0 SOL' },
];

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
      <div className="stake-row">
        <div>
          <div className="stake-amount">0 SOL</div>
          <div className="stake-fiat">↑↓ $0</div>
        </div>
        <div className="stake-amount-input-wrap">
          <input
            type="number"
            className="stake-amount-input"
            placeholder="0.00"
            min={MIN_STAKE_SOL}
            step="any"
            value={stakeAmountSol}
            onChange={(e) => setStakeAmountSol(e.target.value)}
            disabled={isStaking}
          />
          <span className="stake-amount-suffix">SOL</span>
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

function RewardsPanel() {
  return (
    <div className="rewards-panel">
      <div className="rewards-stake-section">
        <div className="rewards-stake-total">0.3 <span className="unit">SOL</span></div>
        <div className="rewards-pills">
          <span className="rewards-pill active">0.2 Active</span>
          <span className="rewards-pill activating">0.11 Activating</span>
        </div>
      </div>
      <div className="rewards-rewards-section">
        <span className="rewards-info-icon" title="Rewards info">i</span>
        <div className="rewards-rewards-label">Rewards</div>
        <div className="rewards-na">N/A</div>
      </div>
      {REWARD_CARDS.map((card) => (
        <div key={card.address} className="reward-card">
          <div className="reward-card-header">
            <div className="reward-card-address">
              <span className="chain-icon" />
              {card.address}
            </div>
            <div className="reward-card-status">
              <span className={`status-dot ${card.statusDot}`} />
              {card.status}
            </div>
          </div>
          <div className="reward-card-metrics details">
            <DetailRow label="Active Stake" value={card.activeStake} />
            <DetailRow label="Inactive Stake" value={card.inactiveStake} />
            <DetailRow label="Rewards" value={card.rewards} />
          </div>
          <button type="button" className="undelegate-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17l10-10M7 7v10h10" />
            </svg>
            Undelegate
          </button>
        </div>
      ))}
    </div>
  );
}

function ActivityPanel() {
  return (
    <div className="activity-list">
      {ACTIVITY_ITEMS.map((item, i) => (
        <div key={i} className="activity-item">
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

  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();

  const walletConnected = !!connected;
  const shortAddress = publicKey ? shortenAddress(publicKey.toBase58()) : '';

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

  const handleBalanceRefetch = () => setBalanceRefetchKey((k) => k + 1);

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
            <RewardsPanel />
          </div>
          <div
            id="panel-activity"
            className={`tab-panel ${activeTab === 'activity' ? 'active' : ''}`}
            role="tabpanel"
          >
            <ActivityPanel />
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
