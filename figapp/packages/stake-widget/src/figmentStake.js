/**
 * Figment Solana Stake API client.
 * Configure via setFigmentClientConfig({ apiBaseUrl, apiKey }) from the host widget.
 * @see https://docs.figment.io/reference/overview-1
 */

const DEFAULT_API_BASE = 'https://api.figment.io';

/** @type {{ apiBaseUrl: string, apiKey: string | null }} */
let clientConfig = {
  apiBaseUrl: DEFAULT_API_BASE,
  apiKey: null,
};

/**
 * @param {{ apiBaseUrl?: string, apiKey?: string | null }} next
 */
export function setFigmentClientConfig(next = {}) {
  clientConfig = {
    apiBaseUrl: next.apiBaseUrl?.trim() || clientConfig.apiBaseUrl || DEFAULT_API_BASE,
    apiKey:
      next.apiKey === undefined
        ? clientConfig.apiKey
        : typeof next.apiKey === 'string'
          ? next.apiKey.trim() || null
          : null,
  };
}

export function getFigmentClientConfig() {
  return { ...clientConfig };
}

function getApiBase() {
  return clientConfig.apiBaseUrl || DEFAULT_API_BASE;
}

function getApiKey() {
  return clientConfig.apiKey;
}

function requireApiKey() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Figment API key is not configured. Pass apiKey to FigmentStakeWidget (or setFigmentClientConfig).'
    );
  }
  return apiKey;
}

/**
 * Map app cluster to Figment network.
 * @param {string} cluster - e.g. "devnet", "mainnet-beta", "testnet"
 * @returns {"mainnet"|"devnet"|"testnet"}
 */
export function clusterToNetwork(cluster) {
  const c = (cluster || '').toLowerCase();
  if (c === 'mainnet-beta' || c === 'mainnet') return 'mainnet';
  if (c === 'testnet') return 'testnet';
  return 'devnet';
}

/**
 * @param {{ fundingAccount: string, voteAccount: string, amountSol: number, network: "mainnet"|"devnet"|"testnet" }} params
 */
export async function createStakeTransaction({ fundingAccount, voteAccount, amountSol, network }) {
  const apiKey = requireApiKey();
  const res = await fetch(`${getApiBase()}/solana/stake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      funding_account: fundingAccount,
      vote_account: voteAccount,
      amount_sol: amountSol,
      network,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || res.statusText || 'Stake request failed';
    throw new Error(msg);
  }

  const data = body?.data ?? body;
  const unsignedTxHex =
    data?.unsigned_tx_serialized_hex ?? data?.unsigned_transaction_serialized ?? data?.unsignedTx_serialized_hex;
  if (!unsignedTxHex || typeof unsignedTxHex !== 'string') {
    throw new Error('Invalid response: missing unsigned transaction');
  }

  return {
    unsignedTxHex: unsignedTxHex.replace(/^0x/i, ''),
    stakeAccount: data?.stake_account,
  };
}

/**
 * @param {{ signedPayloadHex: string, network: "mainnet"|"devnet"|"testnet" }} params
 */
export async function broadcastSignedTransaction({ signedPayloadHex, network }) {
  const apiKey = requireApiKey();
  const payload = signedPayloadHex.replace(/^0x/i, '');

  const res = await fetch(`${getApiBase()}/solana/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      transaction_payload: payload,
      network,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || res.statusText || 'Broadcast failed';
    throw new Error(msg);
  }

  const txHash = body?.transaction_hash ?? body?.data?.transaction_hash;
  if (!txHash || typeof txHash !== 'string') {
    throw new Error('Invalid response: missing transaction hash');
  }

  return { transactionHash: txHash };
}

/**
 * @param {{ stakeAccount: string, network: "mainnet"|"devnet"|"testnet" }} params
 */
export async function createUndelegateTransaction({ stakeAccount, network }) {
  const apiKey = requireApiKey();
  const res = await fetch(`${getApiBase()}/solana/undelegate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      stake_account: stakeAccount,
      network,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || res.statusText || 'Undelegate request failed';
    throw new Error(msg);
  }

  const data = body?.data ?? body;
  const unsignedTxHex =
    data?.unsigned_tx_serialized_hex ?? data?.unsigned_transaction_serialized ?? data?.unsignedTx_serialized_hex;
  if (!unsignedTxHex || typeof unsignedTxHex !== 'string') {
    throw new Error('Invalid response: missing unsigned transaction');
  }

  return { unsignedTxHex: unsignedTxHex.replace(/^0x/i, '') };
}

/**
 * @param {{ stakeAccount: string, recipientAccount: string, amountSol: number, network: "mainnet"|"devnet"|"testnet" }} params
 */
export async function createWithdrawTransaction({ stakeAccount, recipientAccount, amountSol, network }) {
  const apiKey = requireApiKey();
  const res = await fetch(`${getApiBase()}/solana/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      stake_account: stakeAccount,
      recipient_account: recipientAccount,
      amount_sol: amountSol,
      network,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || res.statusText || 'Withdraw request failed';
    throw new Error(msg);
  }

  const data = body?.data ?? body;
  const unsignedTxHex =
    data?.unsigned_tx_serialized_hex ?? data?.unsigned_transaction_serialized ?? data?.unsignedTx_serialized_hex;
  if (!unsignedTxHex || typeof unsignedTxHex !== 'string') {
    throw new Error('Invalid response: missing unsigned transaction');
  }

  return { unsignedTxHex: unsignedTxHex.replace(/^0x/i, '') };
}

/**
 * @param {{ network: "mainnet"|"devnet"|"testnet", stakeAuthority?: string }} params
 */
export async function getStakes({ network, stakeAuthority }) {
  const apiKey = requireApiKey();
  const params = new URLSearchParams({ network });
  if (stakeAuthority) params.set('stake_authority', stakeAuthority);
  const url = `${getApiBase()}/solana/stakes?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || res.statusText || 'Failed to fetch stakes';
    throw new Error(msg);
  }

  const data = body?.data ?? body;
  return Array.isArray(data) ? data : [];
}
