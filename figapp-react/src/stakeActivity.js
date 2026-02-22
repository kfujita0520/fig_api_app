/**
 * Fetch stake/unstake activity history from Solana RPC.
 * Uses getSignaturesForAddress + getTransaction, filters Stake Program instructions,
 * and maps to activity items (date, type, amount, status, tx hash).
 * @see https://solana.com/docs/rpc/json-structures
 */

const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111';

/** Stake instruction discriminators (first byte of instruction data) */
const STAKE_IX = {
  DELEGATE: 2,
  WITHDRAW: 4,
  DEACTIVATE: 5,
};

const ACTIVITY_SIGNATURE_LIMIT = 30;
const LAMPORTS_PER_SOL = 1e9;

/**
 * Decode base58 to Uint8Array (minimal decoder; no extra dependency if possible).
 * Uses TextEncoder/ArrayBuffer for base58 alphabet.
 */
function base58Decode(str) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let carry = ALPHABET.indexOf(str[i]);
    if (carry < 0) return null;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

/** Normalize account key to string (RPC may return { pubkey: string } in jsonParsed-style). */
function toAccountKeyString(key) {
  if (key == null) return null;
  if (typeof key === 'string') return key;
  if (typeof key === 'object' && key && 'pubkey' in key) return key.pubkey;
  return String(key);
}

/**
 * Get full list of account keys for a transaction (static + loaded from lookup tables).
 * loadedAddresses can be on the getTransaction response (top-level) or inside meta.
 * Keys are normalized to strings (RPC may return accountKeys as { pubkey } objects).
 * @param {{ accountKeys: string[]|Array<{pubkey:string}> }} message
 * @param {{ loadedAddresses?: { writable: string[], readonly: string[] } }} [loadedFrom]
 */
function getFullAccountKeys(message, loadedFrom) {
  const staticKeys = message?.accountKeys ?? [];
  const loaded = loadedFrom?.loadedAddresses;
  const staticStrings = Array.isArray(staticKeys)
    ? staticKeys.map(toAccountKeyString).filter(Boolean)
    : [];
  if (!loaded) return staticStrings;
  return [
    ...staticStrings,
    ...(loaded.writable ?? []).map(toAccountKeyString).filter(Boolean),
    ...(loaded.readonly ?? []).map(toAccountKeyString).filter(Boolean),
  ];
}

/**
 * Process a single transaction and extract stake-related activity entries.
 * @param {{ signature: string, blockTime?: number, transaction?: object, meta?: object, loadedAddresses?: object }} txResponse - full getTransaction response
 * @returns {Array<{ type: 'stake'|'unstake', amountSol: number, blockTime?: number, transactionHash: string, stakeAccount?: string, status?: string }>}
 */
function parseTransactionActivity(txResponse) {
  const { signature, blockTime, transaction: tx, meta, loadedAddresses } = txResponse ?? {};
  if (!tx?.message || !meta) return [];

  const message = tx.message;
  const loadedFrom = { loadedAddresses: loadedAddresses ?? meta?.loadedAddresses };
  const fullKeys = getFullAccountKeys(message, loadedFrom);
  const preBalances = meta.preBalances ?? [];
  const postBalances = meta.postBalances ?? [];
  const instructions = message.instructions ?? [];
  const innerIxs = meta.innerInstructions ?? [];

  const entries = [];
  const seenByStakeAccount = new Set();

  function processInstruction(ix, isInner = false) {
    const programIdIndex = ix.programIdIndex ?? ix.programId;
    const programId = typeof programIdIndex === 'number' ? fullKeys[programIdIndex] : programIdIndex;
    if (programId !== STAKE_PROGRAM_ID) return;

    const dataB58 = ix.data;
    if (!dataB58 || typeof dataB58 !== 'string') return;
    const data = base58Decode(dataB58);
    if (!data || data.length < 1) return;
    const discriminator = data[0];

    let type = null;
    if (discriminator === STAKE_IX.DELEGATE) type = 'stake';
    else if (discriminator === STAKE_IX.WITHDRAW || discriminator === STAKE_IX.DEACTIVATE) type = 'unstake';
    if (!type) return;

    const accountIndices = ix.accounts ?? [];
    const stakeAccountIndex = accountIndices[0];
    if (stakeAccountIndex == null) return;
    const stakeAccount = fullKeys[stakeAccountIndex];
    if (!stakeAccount) return;

    const key = `${signature}-${stakeAccount}-${type}-${isInner ? 'inner' : 'top'}`;
    if (seenByStakeAccount.has(key)) return;
    seenByStakeAccount.add(key);

    let amountLamports = 0;
    if (type === 'stake') {
      const post = postBalances[stakeAccountIndex] ?? 0;
      const pre = preBalances[stakeAccountIndex] ?? 0;
      amountLamports = Math.max(0, post - pre);
    } else if (type === 'unstake') {
      if (discriminator === STAKE_IX.WITHDRAW) {
        const pre = preBalances[stakeAccountIndex] ?? 0;
        const post = postBalances[stakeAccountIndex] ?? 0;
        amountLamports = Math.max(0, pre - post);
      } else {
        const pre = preBalances[stakeAccountIndex] ?? 0;
        amountLamports = pre;
      }
    }

    const amountSol = amountLamports / LAMPORTS_PER_SOL;
    entries.push({
      type,
      amountSol,
      blockTime: blockTime ?? null,
      transactionHash: signature,
      stakeAccount,
      status: type === 'stake' ? 'Activating' : 'Exiting',
    });
  }

  for (const ix of instructions) processInstruction(ix, false);
  for (const inner of innerIxs) {
    for (const ix of inner.instructions ?? []) processInstruction(ix, true);
  }

  return entries;
}

/**
 * Fetch stake activity for a wallet from Solana RPC.
 * @param {import('@solana/web3.js').Connection} connection
 * @param {import('@solana/web3.js').PublicKey} publicKey
 * @returns {Promise<Array<{ type: 'stake'|'unstake', amountSol: number, blockTime?: number, transactionHash: string, stakeAccount?: string, status?: string }>>}
 */
export async function fetchStakeActivity(connection, publicKey) {
  if (!connection || !publicKey) return [];

  const sigs = await connection.getSignaturesForAddress(publicKey, {
    limit: ACTIVITY_SIGNATURE_LIMIT,
  });
  if (!sigs.length) return [];

  const opts = { maxSupportedTransactionVersion: 0 };
  const allEntries = [];

  for (const { signature } of sigs) {
    try {
      const tx = await connection.getTransaction(signature, opts);
      if (!tx?.transaction) continue;
      const entries = parseTransactionActivity({
        signature,
        blockTime: tx.blockTime ?? undefined,
        transaction: tx.transaction,
        meta: tx.meta,
        loadedAddresses: tx.loadedAddresses,
      });
      allEntries.push(...entries);
    } catch (_) {
      // Skip failed fetches (e.g. pruned, rate limit)
    }
  }

  allEntries.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
  return allEntries;
}

/**
 * Map raw activity entries to UI shape and optionally enrich status from Figment stakes.
 * @param {Array<{ type: string, amountSol: number, blockTime?: number, transactionHash: string, stakeAccount?: string, status?: string }>} entries
 * @param {Array<{ stake_account: string, status?: string }>} [stakes]
 * @returns {Array<{ date: string, type: string, amount: string, status: string, note: string|null, statusDot: string, transactionHash?: string }>}
 */
export function mapActivityToUI(entries, stakes = []) {
  const stakeByAccount = new Map((stakes ?? []).map((s) => [s.stake_account, s]));

  return entries.map((e) => {
    const stakeInfo = e.stakeAccount ? stakeByAccount.get(e.stakeAccount) : null;
    const status = (stakeInfo?.status ?? e.status ?? '').toString();
    const statusLower = status.toLowerCase();
    let statusDot = 'green';
    if (statusLower === 'active') statusDot = 'green';
    else if (statusLower === 'activating' || statusLower === 'exiting' || statusLower === 'inactive') statusDot = 'yellow';

    let dateStr = '—';
    if (e.blockTime != null) {
      const d = new Date(e.blockTime * 1000);
      dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    }

    const amountStr = (e.amountSol > 0 ? e.amountSol.toFixed(4) : '0').replace(/\.?0+$/, '') + ' SOL';
    const note = statusLower === 'activating' ? '1 day until active' : statusLower === 'exiting' ? '1 day until exit' : null;

    return {
      date: dateStr,
      type: e.type,
      amount: amountStr,
      status: status || (e.type === 'stake' ? 'Activating' : 'Exiting'),
      note,
      statusDot,
      transactionHash: e.transactionHash,
    };
  });
}
