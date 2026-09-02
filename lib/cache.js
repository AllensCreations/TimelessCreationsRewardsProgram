/**
 * In-Memory TTLCache with Tag-Based Invalidation
 * Dramatically accelerates read-heavy API responses (1-5ms response times)
 * and reduces Turso SQLite HTTP roundtrips.
 */

class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttlMs = 30000, tags = []) {
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt, tags });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async getOrSet(key, fetcherFn, ttlMs = 30000, tags = []) {
    const cached = this.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const fresh = await fetcherFn();
    this.set(key, fresh, ttlMs, tags);
    return fresh;
  }

  invalidateTag(tag) {
    if (!tag) return;
    const targetTag = String(tag).toLowerCase();
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags && entry.tags.some(t => String(t).toLowerCase() === targetTag)) {
        this.store.delete(key);
      }
    }
  }

  invalidateAll() {
    this.store.clear();
  }
}

export const cache = new MemoryCache();
