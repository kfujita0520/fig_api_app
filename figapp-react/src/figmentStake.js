/**
 * Figment Solana Stake API client.
 * @see https://docs.figment.io/reference/solana-stake
 * @see https://docs.figment.io/reference/solana-broadcast
 * @see https://docs.figment.io/reference/solana-stakes
 * @see https://docs.figment.io/reference/solana-undelegate
 * In dev we use the Vite proxy to avoid CORS; in production we call the API directly.
 */

const FIGMENT_API_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? '/figment-api'
    : 'https://api.figment.io';

function getApiKey() {
  const key = import.meta.env.VITE_FIGMENT_API_KEY;
  if (!key || typeof key !== 'string') return null;
  return key.trim();
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
 * Create an unsigned stake transaction via Figment.
 * @param {{ fundingAccount: string, voteAccount: string, amountSol: number, network: "mainnet"|"devnet"|"testnet" }} params
 * @returns {Promise<{ unsignedTxHex: string, stakeAccount?: string }>}
 */
export async function createStakeTransaction({ fundingAccount, voteAccount, amountSol, network }) {
  const apiKey = getApiKey();
  // #region agent log
  const stakeUrl = `${FIGMENT_API_BASE}/solana/stake`;
  fetch('http://127.0.0.1:7242/ingest/dc4f4259-83ec-4f57-986f-57cb295bd52c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'figmentStake.js:createStakeTransaction',message:'Before stake fetch',data:{hasApiKey:!!apiKey,url:stakeUrl,isDev:!!(typeof import.meta!=='undefined'&&import.meta.env?.DEV)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  if (!apiKey) {
    throw new Error('Figment API key is not configured. Set VITE_FIGMENT_API_KEY in .env');
  }

  const res = await fetch(stakeUrl, {
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

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/dc4f4259-83ec-4f57-986f-57cb295bd52c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'figmentStake.js:createStakeTransaction',message:'After stake fetch',data:{status:res.status,statusText:res.statusText,bodyMessage:body?.error?.message,ok:res.ok},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
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
 * Broadcast a signed transaction via Figment.
 * @param {{ signedPayloadHex: string, network: "mainnet"|"devnet"|"testnet" }} params
 * @returns {Promise<{ transactionHash: string }>}
 */
export async function broadcastSignedTransaction({ signedPayloadHex, network }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Figment API key is not configured. Set VITE_FIGMENT_API_KEY in .env');
  }

  const payload = signedPayloadHex.replace(/^0x/i, '');

  const res = await fetch(`${FIGMENT_API_BASE}/solana/broadcast`, {
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
 * Create an unsigned undelegate transaction via Figment.
 * @param {{ stakeAccount: string, network: "mainnet"|"devnet"|"testnet" }} params
 * @returns {Promise<{ unsignedTxHex: string }>}
 */
export async function createUndelegateTransaction({ stakeAccount, network }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Figment API key is not configured. Set VITE_FIGMENT_API_KEY in .env');
  }

  const res = await fetch(`${FIGMENT_API_BASE}/solana/undelegate`, {
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
 * Fetch list of stake accounts from Figment.
 * @param {{ network: "mainnet"|"devnet"|"testnet", stakeAuthority?: string }} params
 * @returns {Promise<Array<{ id: string, stake_account: string, status: string, active_balance: string|null, inactive_balance: string|null, balance: string|null }>>}
 */
export async function getStakes({ network, stakeAuthority }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Figment API key is not configured. Set VITE_FIGMENT_API_KEY in .env');
  }

  const params = new URLSearchParams({ network });
  if (stakeAuthority) params.set('stake_authority', stakeAuthority);
  const url = `${FIGMENT_API_BASE}/solana/stakes?${params.toString()}`;

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
