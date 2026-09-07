/**
 * Shared Activity mapping: Figment activities / stakes + optional parsed RPC txs.
 * Kept next to the BFF so Vercel does not depend on the widget package source.
 */

const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111';

const STAKE_IX = {
  DELEGATE: 2,
  WITHDRAW: 4,
  DEACTIVATE: 5,
};

const LAMPORTS_PER_SOL = 1e9;

const FIGMENT_TYPE_MAP = {
  delegation: 'stake',
  undelegation: 'unstake',
  withdrawal: 'withdraw',
};

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

function toAccountKeyString(key) {
  if (key == null) return null;
  if (typeof key === 'string') return key;
  if (typeof key?.toBase58 === 'function') return key.toBase58();
  if (typeof key === 'object' && key && 'pubkey' in key) return toAccountKeyString(key.pubkey);
  return String(key);
}

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

function getInstructionData(data) {
  if (typeof data === 'string') return base58Decode(data);
  if (data instanceof Uint8Array) return data;
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (Array.isArray(data)) return Uint8Array.from(data);
  return null;
}

function statusFromFigmentActivity(activity, type) {
  const life = (activity.status || '').toLowerCase();
  if (life === 'failed') return 'Failed';
  if (type === 'stake') return life === 'complete' ? 'Active' : 'Activating';
  if (type === 'unstake') return life === 'complete' ? 'Inactive' : 'Exiting';
  return 'Withdrawn';
}

/**
 * Map Figment GET /solana/activities rows to the same entry shape as RPC parsing.
 */
export function figmentActivitiesToEntries(activities, stakeAuthority) {
  return (activities ?? [])
    .filter((activity) => {
      if (
        stakeAuthority
        && activity.delegation_address
        && activity.delegation_address !== stakeAuthority
      ) {
        return false;
      }
      const txStatus = activity.tx?.status;
      if (txStatus === 'failed' || txStatus === 'expired') return false;
      return Boolean(FIGMENT_TYPE_MAP[activity.type]);
    })
    .map((activity) => {
      const type = FIGMENT_TYPE_MAP[activity.type];
      const ts = activity.timestamp ? Date.parse(activity.timestamp) : NaN;
      const details = activity.details && typeof activity.details === 'object'
        ? activity.details
        : {};
      return {
        type,
        amountSol: Number(activity.amount) || 0,
        blockTime: Number.isNaN(ts) ? null : Math.floor(ts / 1000),
        transactionHash: activity.tx?.hash || undefined,
        stakeAccount: details.stake_account || details.stakeAccount || null,
        status: statusFromFigmentActivity(activity, type),
      };
    });
}

/**
 * Process a single getTransaction response and extract stake-related activity entries.
 */
export function parseTransactionActivity(txResponse) {
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
    else if (discriminator === STAKE_IX.DEACTIVATE) type = 'unstake';
    else if (discriminator === STAKE_IX.WITHDRAW) type = 'withdraw';
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
      if (amountLamports === 0) amountLamports = post;
    } else if (type === 'withdraw') {
      const pre = preBalances[stakeAccountIndex] ?? 0;
      const post = postBalances[stakeAccountIndex] ?? 0;
      amountLamports = Math.max(0, pre - post);
    } else if (type === 'unstake') {
      const pre = preBalances[stakeAccountIndex] ?? 0;
      amountLamports = pre;
    }

    entries.push({
      type,
      amountSol: amountLamports / LAMPORTS_PER_SOL,
      blockTime: blockTime ?? null,
      transactionHash: signature,
      stakeAccount,
      status: type === 'stake'
        ? 'Activating'
        : type === 'withdraw'
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
 * Map raw activity entries to UI shape and optionally enrich status from Figment stakes.
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
      const isUnstakeStatus = statusLower === 'exiting' || statusLower === 'deactivating';
      const isWithdrawStatus = statusLower === 'inactive' || statusLower === 'withdrawn';
      let type = 'stake';
      if (isWithdrawStatus || (!isStakeStatus && !isUnstakeStatus && hasOnlyInactiveBalance)) {
        type = 'withdraw';
      } else if (isUnstakeStatus) {
        type = 'unstake';
      }
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
    else if (statusLower === 'inactive' || statusLower === 'withdrawn' || statusLower === 'failed') statusDot = 'gray';

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

    const defaultStatus =
      e.type === 'stake' ? 'Activating'
      : e.type === 'withdraw' ? 'Inactive'
      : 'Exiting';

    return {
      date: dateStr,
      type: e.type,
      amount: amountStr,
      status: status || defaultStatus,
      note,
      statusDot,
      transactionHash: e.transactionHash,
    };
  });
}
