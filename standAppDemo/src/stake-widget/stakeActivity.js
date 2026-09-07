/**
 * Activity history via the host BFF (`GET /api/solana/activity`).
 * The browser does not call Solana RPC for the Activity tab.
 */

function clusterToNetwork(cluster) {
  const c = (cluster || '').toLowerCase();
  if (c === 'mainnet-beta' || c === 'mainnet') return 'mainnet';
  if (c === 'testnet') return 'testnet';
  return 'devnet';
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
 * Fetch mapped activity rows from the host BFF.
 * @param {{ activityApiUrl: string, stakeAuthority: string, cluster?: string }} params
 * @returns {Promise<Array<{ date: string, type: string, amount: string, status: string, note: string|null, statusDot: string, transactionHash?: string }>>}
 */
export async function fetchStakeActivity({ activityApiUrl, stakeAuthority, cluster }) {
  if (!activityApiUrl || !stakeAuthority) return [];

  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost';
  const url = new URL(activityApiUrl, origin);
  url.searchParams.set('network', clusterToNetwork(cluster));
  url.searchParams.set('stake_authority', stakeAuthority);

  const res = await fetch(url.toString(), { method: 'GET' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || res.statusText || 'Failed to load activity';
    throw new Error(msg);
  }
  return Array.isArray(body?.data) ? body.data : [];
}
