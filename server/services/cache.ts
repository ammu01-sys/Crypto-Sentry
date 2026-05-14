import logger from '../utils/logger';

interface CacheItem<T = any> {
  value: T;
  expiresAt: number | null;
}

class MemoryCache {
  private cache = new Map<string, CacheItem>();

  constructor() {
    logger.info('In-Memory Pricing Cache Service Initialized.');
  }

  /**
   * Put an object into memory cache with a TTL
   * @param key Unique key
   * @param value Data to cache
   * @param ttlMs Time to live in milliseconds (optional)
   */
  set<T = any>(key: string, value: T, ttlMs: number | null = null): void {
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this.cache.set(key, { value, expiresAt });
    logger.debug(`Cache set key: ${key}`);
  }

  /**
   * Get an object from memory cache if it exists and is fresh
   * @param key Unique key
   * @returns Cached item or null
   */
  get<T = any>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      logger.debug(`Cache key expired: ${key}`);
      return null;
    }

    return cached.value as T;
  }

  /**
   * Evict key from cache
   * @param key Unique key
   */
  delete(key: string): void {
    this.cache.delete(key);
    logger.debug(`Cache key deleted: ${key}`);
  }

  /**
   * Clear all cached keys
   */
  flush(): void {
    this.cache.clear();
    logger.info('Cache flushed completely.');
  }

  /**
   * Get all active (non-expired) keys and values from the cache
   * @returns Object containing all cached data keys and values
   */
  getAll(): Record<string, any> {
    const data: Record<string, any> = {};
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this.cache.delete(key); // Lazy evict expired keys
      } else {
        data[key] = item.value;
      }
    }
    return data;
  }
}

// Global Singleton Instance
const cacheInstance = new MemoryCache();

export default cacheInstance;
