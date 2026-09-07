/**
 * Build Activity for a wallet: Figment first, RPC only for gaps.
 *
 * 1. GET /solana/activities (org activities, filtered by stake authority)
 * 2. GET /solana/stakes (on-chain status / inferred rows)
 * 3. If Figment returned no history, fill from wallet signatures only
 *    (getSignaturesForAddress + limited concurrent getTransaction)
 */

import {
  figmentActivitiesToEntries,
  mapActivityToUI,
  parseTransactionActivity,
} from './stakeActivityCore.js';

const FIGMENT_API_BASE = 'https://api.figment.io';
const ACTIVITY_PAGE_SIZE = 100;
const ACTIVITY_MAX_PAGES = 5;
const RPC_SIGNATURE_LIMIT = 30;
const RPC_UNKNOWN_TX_LIMIT = 20;
const RPC_TX_CONCURRENCY = 4;

function unwrapList(body) {
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  return [];
}

function defaultRpcUrl(network) {
  if (network === 'mainnet') return 'https://api.mainnet-beta.solana.com';
  if (network === 'testnet') return 'https://api.testnet.solana.com';
  return 'https://api.devnet.solana.com';
}

async function figmentGet(apiKey, path, query) {
  const url = new URL(`${FIGMENT_API_BASE}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || res.statusText || 'Figment request failed';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function fetchFigmentActivities(apiKey, network) {
  const collected = [];
  let hasNext = true;
  for (let page = 1; page <= ACTIVITY_MAX_PAGES && hasNext; page += 1) {
    const body = await figmentGet(apiKey, '/solana/activities', {
      network,
      'page[number]': String(page),
      'page[size]': String(ACTIVITY_PAGE_SIZE),
    });
    collected.push(...unwrapList(body));
    hasNext = Boolean(body?.meta?.pagination?.has_next);
  }
  return collected;
}

async function fetchFigmentStakes(apiKey, network, stakeAuthority) {
  const body = await figmentGet(apiKey, '/solana/stakes', {
    network,
    stake_authority: stakeAuthority,
  });
  return unwrapList(body);
}

async function rpcRequest(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(body?.error?.message || `RPC ${method} failed`);
  }
  return body.result;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const n = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

/**
 * RPC fallback: wallet signatures only, skip hashes Figment already returned,
 * cap concurrent getTransaction calls (Alchemy does not support JSON-RPC batches).
 */
async function fillGapsFromRpc({ rpcUrl, stakeAuthority, knownTxHashes }) {
  const signatures = await rpcRequest(rpcUrl, 'getSignaturesForAddress', [
    stakeAuthority,
    { limit: RPC_SIGNATURE_LIMIT },
  ]);
  const known = new Set(knownTxHashes);
  const unknown = (signatures || [])
    .filter((item) => item?.signature && !item.err && !known.has(item.signature))
    .slice(0, RPC_UNKNOWN_TX_LIMIT);
  if (!unknown.length) return [];

  const fetched = await mapPool(unknown, RPC_TX_CONCURRENCY, async (item) => {
    try {
      const tx = await rpcRequest(rpcUrl, 'getTransaction', [
        item.signature,
        { encoding: 'json', maxSupportedTransactionVersion: 0 },
      ]);
      return { item, tx };
    } catch {
      return { item, tx: null };
    }
  });

  const entries = [];
  for (const { item, tx } of fetched) {
    if (!tx?.transaction || tx.meta?.err) continue;
    entries.push(...parseTransactionActivity({
      signature: item.signature,
      blockTime: tx.blockTime ?? item.blockTime ?? null,
      transaction: tx.transaction,
      meta: tx.meta,
      loadedAddresses: tx.loadedAddresses ?? tx.meta?.loadedAddresses,
    }));
  }
  return entries;
}

function mergeEntries(figmentEntries, rpcEntries) {
  const byKey = new Map();
  for (const entry of [...figmentEntries, ...rpcEntries]) {
    const key = entry.transactionHash
      ? `${entry.transactionHash}:${entry.type}:${entry.stakeAccount || ''}`
      : `nostake:${entry.type}:${entry.stakeAccount || ''}:${entry.blockTime || ''}`;
    if (!byKey.has(key)) byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
}

/**
 * @param {{ apiKey: string, network: string, stakeAuthority: string, rpcUrl?: string }} params
 */
export async function buildStakeActivity({ apiKey, network, stakeAuthority, rpcUrl }) {
  const [activitiesResult, stakesResult] = await Promise.allSettled([
    fetchFigmentActivities(apiKey, network),
    fetchFigmentStakes(apiKey, network, stakeAuthority),
  ]);

  if (activitiesResult.status === 'rejected' && stakesResult.status === 'rejected') {
    throw activitiesResult.reason;
  }

  const activities = activitiesResult.status === 'fulfilled' ? activitiesResult.value : [];
  const stakes = stakesResult.status === 'fulfilled' ? stakesResult.value : [];
  const figmentEntries = figmentActivitiesToEntries(activities, stakeAuthority);

  let rpcEntries = [];
  let source = figmentEntries.length ? 'figment' : 'figment-empty';
  // Gap: Figment has no history for this wallet. Then scan wallet signatures only.
  if (figmentEntries.length === 0) {
    const endpoint = rpcUrl?.trim() || defaultRpcUrl(network);
    try {
      rpcEntries = await fillGapsFromRpc({
        rpcUrl: endpoint,
        stakeAuthority,
        knownTxHashes: figmentEntries.map((entry) => entry.transactionHash).filter(Boolean),
      });
      if (rpcEntries.length) source = 'rpc';
    } catch (error) {
      if (!stakes.length) throw error;
      source = 'stakes-fallback';
    }
  }

  const entries = mergeEntries(figmentEntries, rpcEntries);
  // Avoid duplicating Figment timeline rows with inferred stake cards when
  // activities have no stake_account to join on.
  const useStakeFallback = entries.length === 0 || entries.some((entry) => entry.stakeAccount);
  const data = mapActivityToUI(entries, useStakeFallback ? stakes : []);

  return {
    data,
    meta: {
      source,
      figmentCount: figmentEntries.length,
      rpcCount: rpcEntries.length,
    },
  };
}
