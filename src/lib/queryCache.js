/**
 * High-performance client-side query cache with TTL & promise deduplication.
 * Prevents redundant database network requests and reduces load on Supabase.
 */

const cacheStore = new Map();
const inFlightPromises = new Map();

/**
 * Common cache keys and prefixes
 */
export const CACHE_KEYS = {
  SETTINGS: "app_settings",
  DASHBOARD_STATS: "dashboard_stats",
  EVENTS_LIST: "events_list",
  NOTICES_LIST: "notices_list",
  MEMBERS_DIRECTORY: "members_dir",
};

/**
 * Fetch data with automated caching and simultaneous request deduplication.
 *
 * @param {string} key - Unique cache key
 * @param {Function} fetcherFn - Async function that returns data
 * @param {number} ttlMs - Time-to-live in milliseconds (default: 30 seconds)
 * @returns {Promise<any>}
 */
export async function fetchWithCache(key, fetcherFn, ttlMs = 30000) {
  const now = Date.now();
  const cached = cacheStore.get(key);

  // Return valid cached data immediately without hitting the network
  if (cached && now - cached.timestamp < cached.ttlMs) {
    return cached.data;
  }

  // Deduplicate concurrent in-flight requests for the same key
  if (inFlightPromises.has(key)) {
    return inFlightPromises.get(key);
  }

  const promise = (async () => {
    try {
      const data = await fetcherFn();
      if (data !== undefined && data !== null) {
        cacheStore.set(key, {
          data,
          timestamp: Date.now(),
          ttlMs,
        });
      }
      return data;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, promise);
  return promise;
}

/**
 * Manually set or update a cached entry
 */
export function setCachedData(key, data, ttlMs = 30000) {
  cacheStore.set(key, {
    data,
    timestamp: Date.now(),
    ttlMs,
  });
}

/**
 * Get cached data synchronously if valid
 */
export function getCachedData(key) {
  const cached = cacheStore.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
    return cached.data;
  }
  return null;
}

/**
 * Invalidate cached items matching a key or prefix
 * @param {string} [prefix] - If provided, clears keys starting with prefix. Otherwise clears all.
 */
export function invalidateCache(prefix) {
  if (!prefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key === prefix || key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}
