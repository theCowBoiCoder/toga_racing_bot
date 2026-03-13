class Cache {
  constructor(ttlMs = 30 * 60 * 1000) {
    this.store = new Map();
    this.ttl = ttlMs;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key, data) {
    this.store.set(key, {
      data,
      expiry: Date.now() + this.ttl,
    });
  }

  clear() {
    this.store.clear();
  }
}

module.exports = Cache;
