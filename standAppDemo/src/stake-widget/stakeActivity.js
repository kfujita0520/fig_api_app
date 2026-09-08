/**
 * Activity history via the host BFF (`GET /api/solana/activity`).
 * The browser does not call Solana RPC for the Activity tab.
 *
 * Results are cached in-memory ~20s and in-flight requests are coalesced so
 * wallet-connect prefetch and the Activity tab share one HTTP call.
 */

const CLIENT_ACTIVITY_CACHE_TTL_MS = 20_000;

const clientCache = new Map();
const clientInflight = new Map();

function clusterToNetwork(cluster) {
  const c = (cluster || '').toLowerCase();
  if (c === 'mainnet-beta' || c === 'mainnet') return 'mainnet';
  if (c === 'testnet') return 'testnet';
  return 'devnet';
}

function activityCacheKey(activityApiUrl, stakeAuthority, cluster) {
  return `${activityApiUrl}|${clusterToNetwork(cluster)}|${stakeAuthority}`;
}

/**
 * Resolve the Activity BFF URL from the Figment BFF base (`/api/figment` → `/api/solana/activity`).
 */
export function resolveActivityApiUrl(apiBaseUrl, activityApiUrl) {
  if (activityApiUrl?.trim()) return activityApiUrl.trim().replace(/\/$/, '');
  const base = (apiBaseUrl || '/api/figment').replace(/\/$/, '');
  if (base.endsWith('/figment')) {
    return `${base.slice(0, -'/figment'.length)}/solana/activity`;
  }
  return '/api/solana/activity';
}

/**
 * @param {{ activityApiUrl: string, stakeAuthority: string, cluster?: string }} params
 * @returns {Array|null}
 */
export function peekStakeActivityCache({ activityApiUrl, stakeAuthority, cluster }) {
  if (!activityApiUrl || !stakeAuthority) return null;
  const hit = clientCache.get(activityCacheKey(activityApiUrl, stakeAuthority, cluster));
  if (!hit || Date.now() >= hit.expiresAt) return null;
  return hit.items;
}

/**
 * Fetch mapped activity rows from the host BFF.
 * @param {{ activityApiUrl: string, stakeAuthority: string, cluster?: string, fresh?: boolean }} params
 * @returns {Promise<Array<{ date: string, type: string, amount: string, status: string, note: string|null, statusDot: string, transactionHash?: string }>>}
 */
export async function fetchStakeActivity({ activityApiUrl, stakeAuthority, cluster, fresh = false }) {
  if (!activityApiUrl || !stakeAuthority) return [];

  const key = activityCacheKey(activityApiUrl, stakeAuthority, cluster);
  const pending = clientInflight.get(key);
  if (!fresh) {
    const hit = clientCache.get(key);
    if (hit && Date.now() < hit.expiresAt) return hit.items;
    if (pending) return pending.promise;
  } else if (pending?.fresh) {
    return pending.promise;
  }

  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost';
  const url = new URL(activityApiUrl, origin);
  url.searchParams.set('network', clusterToNetwork(cluster));
  url.searchParams.set('stake_authority', stakeAuthority);
  if (fresh) url.searchParams.set('fresh', '1');

  let promise;
  promise = (async () => {
    const res = await fetch(url.toString(), { method: 'GET' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || body?.message || res.statusText || 'Failed to load activity';
      throw new Error(msg);
    }
    const items = Array.isArray(body?.data) ? body.data : [];
    clientCache.set(key, { items, expiresAt: Date.now() + CLIENT_ACTIVITY_CACHE_TTL_MS });
    return items;
  })().finally(() => {
    if (clientInflight.get(key)?.promise === promise) clientInflight.delete(key);
  });

  clientInflight.set(key, { promise, fresh: Boolean(fresh) });
  return promise;
}

/**
 * Start loading activity as soon as a wallet is connected. Errors are swallowed
 * so a failed prefetch does not surface until the Activity tab fetches.
 */
export function prefetchStakeActivity(params) {
  return fetchStakeActivity(params).catch(() => []);
}
