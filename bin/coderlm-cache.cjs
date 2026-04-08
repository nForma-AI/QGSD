'use strict';

/**
 * coderlm-cache.cjs — LRU cache for coderlm query results
 *
 * Uses Map insertion-order trick for O(1) LRU eviction:
 *   - delete + re-insert on access promotes entry to MRU position
 *   - map.keys().next().value is always the LRU entry
 *
 * Each entry: { value, expiresAt: Date.now() + ttlMs }
 * On get: if expiresAt <= Date.now(), entry is treated as a miss and removed.
 *
 * @module coderlm-cache
 */

/**
 * Create an LRU cache with TTL support.
 * @param {number} [capacity=100] - Max number of entries
 * @param {number} [ttlMs=300000] - TTL per entry in milliseconds (default 5 min)
 * @returns {{ get, set, reset, stats }}
 */
function createLRUCache(capacity, ttlMs) {
  const _capacity = capacity !== undefined ? capacity : 100;
  const _ttlMs = ttlMs !== undefined ? ttlMs : 300000;

  /** @type {Map<string, {value: any, expiresAt: number}>} */
  const _cache = new Map();

  let _hits = 0;
  let _misses = 0;

  return {
    /**
     * Get a cached value by key.
     * Returns undefined on miss or expired entry (miss is counted).
     * @param {string} key
     * @returns {any|undefined}
     */
    get(key) {
      if (!_cache.has(key)) {
        _misses++;
        return undefined;
      }
      const entry = _cache.get(key);
      if (Date.now() >= entry.expiresAt) {
        _cache.delete(key);
        _misses++;
        return undefined;
      }
      // Promote to MRU: delete and re-insert at end of Map
      _cache.delete(key);
      _cache.set(key, entry);
      _hits++;
      return entry.value;
    },

    /**
     * Store a value in the cache.
     * If key already exists, refreshes value and TTL (no size increase).
     * If at capacity, evicts LRU entry (first key in Map).
     * @param {string} key
     * @param {any} value
     */
    set(key, value) {
      if (_cache.has(key)) {
        // Remove first to re-insert at MRU position (refresh TTL + position)
        _cache.delete(key);
      } else if (_cache.size >= _capacity) {
        // Evict LRU (first inserted / least recently used)
        _cache.delete(_cache.keys().next().value);
      }
      _cache.set(key, { value, expiresAt: Date.now() + _ttlMs });
    },

    /**
     * Clear all entries and reset statistics.
     */
    reset() {
      _cache.clear();
      _hits = 0;
      _misses = 0;
    },

    /**
     * Get current cache statistics.
     * @returns {{ hits: number, misses: number, size: number, hitRate: number }}
     */
    stats() {
      const total = _hits + _misses;
      return {
        hits: _hits,
        misses: _misses,
        size: _cache.size,
        hitRate: total === 0 ? 0 : _hits / total,
      };
    },
  };
}

module.exports = { createLRUCache };
