/**
 * Short-lived in-memory cache with in-flight coalescing.
 * Per process (local Express / warm serverless instance). TTL keeps post-stake
 * data from staying stale for long; `skip` bypasses after explicit refresh.
 */

export const ACTIVITY_CACHE_TTL_MS = 20_000;

const entries = new Map();
const inflight = new Map();

export function getCached(key) {
  const hit = entries.get(key);
  if (!hit) return undefined;
  if (Date.now() >= hit.expiresAt) {
    entries.delete(key);
    return undefined;
  }
  return hit.value;
}

export function setCached(key, value, ttlMs = ACTIVITY_CACHE_TTL_MS) {
  entries.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @param {{ skip?: boolean, ttlMs?: number }} [options]
 * @returns {Promise<T>}
 */
export async function withCache(key, loader, options = {}) {
  const skip = Boolean(options.skip);
  const ttlMs = options.ttlMs ?? ACTIVITY_CACHE_TTL_MS;

  if (!skip) {
    const cached = getCached(key);
    if (cached !== undefined) return cached;
    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const pending = Promise.resolve()
    .then(loader)
    .then((value) => {
      setCached(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === pending) inflight.delete(key);
    });

  inflight.set(key, pending);
  return pending;
}
