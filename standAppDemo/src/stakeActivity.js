/**
 * Fetch stake/unstake activity history from Solana RPC.
 * Uses getSignaturesForAddress + getTransaction, filters Stake Program instructions,
 * and maps to activity items (date, type, amount, status, tx hash).
 * @see https://solana.com/docs/rpc/json-structures
 */

import { PublicKey } from '@solana/web3.js';

const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111';

/** Stake instruction discriminators (first byte of instruction data) */
const STAKE_IX = {
  DELEGATE: 2,
  WITHDRAW: 4,
  DEACTIVATE: 5,
};

const ACTIVITY_SIGNATURE_LIMIT = 30;
const ACTIVITY_TRANSACTION_LIMIT = 100;
const TRANSACTION_BATCH_SIZE = 25;
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

/** Normalize account keys returned by legacy, v0, or parsed transactions. */
function toAccountKeyString(key) {
  if (key == null) return null;
  if (typeof key === 'string') return key;
  if (typeof key?.toBase58 === 'function') return key.toBase58();
  if (typeof key === 'object' && key && 'pubkey' in key) return toAccountKeyString(key.pubkey);
  return String(key);
}

/**
 * Get full list of account keys for a transaction (static + loaded from lookup tables).
 * Legacy messages expose accountKeys; v0 messages expose staticAccountKeys.
 * @param {{ accountKeys?: unknown[], staticAccountKeys?: unknown[] }} message
 * @param {{ loadedAddresses?: { writable: string[], readonly: string[] } }} [loadedFrom]
 */
function getFullAccountKeys(message, loadedFrom) {
  const staticKeys = message?.staticAccountKeys ?? message?.accountKeys ?? [];
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

/** Return instruction data bytes for legacy (base58) and v0 (Uint8Array) messages. */
function getInstructionData(data) {
  if (typeof data === 'string') return base58Decode(data);
  if (data instanceof Uint8Array) return data;
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (Array.isArray(data)) return Uint8Array.from(data);
  return null;
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
  const instructions = message.compiledInstructions ?? message.instructions ?? [];
  const innerIxs = meta.innerInstructions ?? [];

  const entries = [];
  const seenByStakeAccount = new Set();

  function processInstruction(ix) {
    const programIdIndex = ix.programIdIndex ?? ix.programId;
    const programId = typeof programIdIndex === 'number'
      ? fullKeys[programIdIndex]
      : toAccountKeyString(programIdIndex);
    if (programId !== STAKE_PROGRAM_ID) return;

    const data = getInstructionData(ix.data);
    if (!data || data.length < 1) return;
    const discriminator = data[0];

    let type = null;
    if (discriminator === STAKE_IX.DELEGATE) type = 'stake';
    else if (discriminator === STAKE_IX.WITHDRAW || discriminator === STAKE_IX.DEACTIVATE) type = 'unstake';
    if (!type) return;

    const accountIndices = ix.accountKeyIndexes ?? ix.accounts ?? [];
    const stakeAccountIndex = accountIndices[0];
    if (stakeAccountIndex == null) return;
    const stakeAccount = fullKeys[stakeAccountIndex];
    if (!stakeAccount) return;

    const key = `${signature}-${stakeAccount}-${type}`;
    if (seenByStakeAccount.has(key)) return;
    seenByStakeAccount.add(key);

    let amountLamports = 0;
    if (type === 'stake') {
      const post = postBalances[stakeAccountIndex] ?? 0;
      const pre = preBalances[stakeAccountIndex] ?? 0;
      amountLamports = Math.max(0, post - pre);
      // Delegating an already-created stake account does not change its balance.
      if (amountLamports === 0) amountLamports = post;
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
      status: type === 'stake'
        ? 'Activating'
        : discriminator === STAKE_IX.WITHDRAW
          ? 'Inactive'
          : 'Exiting',
    });
  }

  for (const ix of instructions) processInstruction(ix);
  for (const inner of innerIxs) {
    for (const ix of inner.instructions ?? []) processInstruction(ix);
  }

  return entries;
}

/**
 * Fetch stake activity for a wallet from Solana RPC.
 * @param {import('@solana/web3.js').Connection} connection
 * @param {import('@solana/web3.js').PublicKey} publicKey
 * @param {string[]} [stakeAccounts] stake accounts returned by Figment
 * @returns {Promise<Array<{ type: 'stake'|'unstake', amountSol: number, blockTime?: number, transactionHash: string, stakeAccount?: string, status?: string }>>}
 */
export async function fetchStakeActivity(connection, publicKey, stakeAccounts = []) {
  if (!connection || !publicKey) return [];

  const publicKeyString = publicKey.toBase58();
  const addresses = [publicKey];
  const seenAddresses = new Set([publicKeyString]);
  for (const address of stakeAccounts) {
    if (!address || seenAddresses.has(address)) continue;
    try {
      addresses.push(new PublicKey(address));
      seenAddresses.add(address);
    } catch {
      // Ignore malformed stake accounts instead of hiding wallet activity.
    }
  }

  const signatureLists = await Promise.all(
    addresses.map((address, index) =>
      connection
        .getSignaturesForAddress(address, { limit: ACTIVITY_SIGNATURE_LIMIT })
        .catch((error) => {
          if (index === 0) throw error;
          return [];
        })
    )
  );
  const signaturesByHash = new Map();
  for (const item of signatureLists.flat()) {
    const existing = signaturesByHash.get(item.signature);
    if (!existing || (item.blockTime ?? 0) > (existing.blockTime ?? 0)) {
      signaturesByHash.set(item.signature, item);
    }
  }
  const sigs = [...signaturesByHash.values()]
    .sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
  if (!sigs.length) return [];

  const opts = { maxSupportedTransactionVersion: 0 };
  const allEntries = [];
  const successfulSigs = sigs.filter((item) => !item.err);
  const limitedSigs = successfulSigs.slice(0, ACTIVITY_TRANSACTION_LIMIT);
  const signatures = limitedSigs.map((item) => item.signature);
  if (!signatures.length) return [];

  const transactions = [];
  for (let start = 0; start < signatures.length; start += TRANSACTION_BATCH_SIZE) {
    const signatureBatch = signatures.slice(start, start + TRANSACTION_BATCH_SIZE);
    try {
      transactions.push(...await connection.getTransactions(signatureBatch, opts));
    } catch {
      // Some RPC providers disable batch requests. Fall back to individual requests
      // while keeping a failed/pruned transaction from hiding the rest of the list.
      transactions.push(...await Promise.all(
        signatureBatch.map((signature) =>
          connection.getTransaction(signature, opts).catch(() => null)
        )
      ));
    }
  }

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (!tx?.transaction || tx.meta?.err) continue;
    const entries = parseTransactionActivity({
      signature: signatures[i],
      blockTime: tx.blockTime ?? limitedSigs[i]?.blockTime ?? undefined,
      transaction: tx.transaction,
      meta: tx.meta,
      loadedAddresses: tx.loadedAddresses,
    });
    allEntries.push(...entries);
  }

  allEntries.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
  return allEntries;
}

/**
 * Map raw activity entries to UI shape and optionally enrich status from Figment stakes.
 * @param {Array<{ type: string, amountSol: number, blockTime?: number, transactionHash: string, stakeAccount?: string, status?: string }>} entries
 * @param {Array<{ stake_account: string, status?: string, balance?: string, active_balance?: string, inactive_balance?: string }>} [stakes]
 * @returns {Array<{ date: string, type: string, amount: string, status: string, note: string|null, statusDot: string, transactionHash?: string }>}
 */
export function mapActivityToUI(entries, stakes = []) {
  const stakeByAccount = new Map((stakes ?? []).map((s) => [s.stake_account, s]));
  const representedStakeAccounts = new Set(
    entries.map((entry) => entry.stakeAccount).filter(Boolean)
  );
  const fallbackEntries = (stakes ?? [])
    .filter((stake) => stake.stake_account && !representedStakeAccounts.has(stake.stake_account))
    .map((stake) => {
      const statusLower = (stake.status ?? '').toLowerCase();
      const inactiveBalance = parseFloat(stake.inactive_balance);
      const activeBalance = parseFloat(stake.active_balance);
      const hasOnlyInactiveBalance = inactiveBalance > 0 && !(activeBalance > 0);
      const isStakeStatus = statusLower === 'active' || statusLower === 'activating';
      const isUnstakeStatus = ['inactive', 'exiting', 'deactivating', 'withdrawn'].includes(statusLower);
      const type = isUnstakeStatus || (!isStakeStatus && hasOnlyInactiveBalance)
        ? 'unstake'
        : 'stake';
      const amount = parseFloat(stake.balance);
      return {
        type,
        amountSol: Number.isNaN(amount) ? 0 : amount,
        blockTime: null,
        stakeAccount: stake.stake_account,
        status: stake.status,
      };
    });

  return [...entries, ...fallbackEntries].map((e) => {
    const stakeInfo = e.stakeAccount ? stakeByAccount.get(e.stakeAccount) : null;
    const rawStatus = (stakeInfo?.status ?? e.status ?? '').toString();
    const status = rawStatus
      ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase()
      : '';
    const statusLower = status.toLowerCase();
    let statusDot = 'green';
    if (statusLower === 'active') statusDot = 'green';
    else if (statusLower === 'activating' || statusLower === 'exiting' || statusLower === 'deactivating') statusDot = 'yellow';
    else if (statusLower === 'inactive' || statusLower === 'withdrawn') statusDot = 'gray';

    let dateStr = '';
    if (e.blockTime != null) {
      const d = new Date(e.blockTime * 1000);
      dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    }

    const amountStr = (e.amountSol > 0 ? e.amountSol.toFixed(4) : '0').replace(/\.?0+$/, '') + ' SOL';
    const note = statusLower === 'activating'
      ? '1 day until active'
      : statusLower === 'exiting' || statusLower === 'deactivating'
        ? '1 day until exit'
        : null;

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
