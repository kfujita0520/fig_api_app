import { useState } from 'react';

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

function StakePanel({ walletConnected, onConnectWallet }) {
  const validatorCell = (
    <div className="validator-cell">
      <span className="validator-icon">F</span>
      <span className="detail-value">Figment</span>
    </div>
  );

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

  return (
    <div className="stake-connected-wrap is-visible">
      <div className="stake-row">
        <div>
          <div className="stake-amount">0 SOL</div>
          <div className="stake-fiat">↑↓ $0</div>
        </div>
        <button type="button" className="stake-btn">↑ 4.6 SOL</button>
      </div>
      <div className="details">
        <DetailRow label="Gross Rewards Rate" value="6.3%" />
        <DetailRow label="Validator">{validatorCell}</DetailRow>
        <DetailRow label="Fee" value="7%" />
        <DetailRow label="Activation Time" value="~1 day" />
      </div>
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

function WalletModal({ isOpen, onClose, onDisconnect }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleDisconnect = () => {
    onClose();
    onDisconnect();
  };

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
          <span className="address-text">AyE8...FJb3</span>
          <a href="#" className="modal-wallet-link" title="View on explorer" aria-label="View on explorer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
        <div className="modal-wallet-details details">
          <DetailRow label="Network" value="Devnet" />
          <DetailRow label="Available Balance" value="4.69 SOL" />
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
  const [walletConnected, setWalletConnected] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleAddressClick = () => {
    if (walletConnected) setModalOpen(true);
  };

  const handleAddressKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && walletConnected) {
      e.preventDefault();
      setModalOpen(true);
    }
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
            <span className="address-text">AyE8...FJb3</span>
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
              onConnectWallet={() => setWalletConnected(true)}
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
        onDisconnect={() => setWalletConnected(false)}
      />
    </>
  );
}
