import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  totalRequests: number;
}

@Injectable()
export class CacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    totalRequests: 0
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Generate a cache key based on provider, path, and sanitized body
   */
  generateCacheKey(provider: string, path: string, sanitizedBody: any): string {
    const bodyHash = JSON.stringify(sanitizedBody);
    return `proxy:${provider}:${path}:${Buffer.from(bodyHash).toString('base64').substring(0, 32)}`;
  }

  /**
   * Get cached response
   */
  async get(key: string): Promise<any | null> {
    try {
      this.stats.totalRequests++;
      const result = await this.cacheManager.get(key);
      
      if (result !== null) {
        this.stats.hits++;
      } else {
        this.stats.misses++;
      }
      
      return result;
    } catch (error) {
      console.warn('Cache get error:', error.message);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set cached response with TTL
   */
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.stats.size++;
    } catch (error) {
      console.warn('Cache set error:', error.message);
    }
  }

  /**
   * Check if request should be served from cache
   */
  async shouldServeFromCache(key: string): Promise<boolean> {
    const cached = await this.get(key);
    return cached !== null;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      totalRequests: 0
    };
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    if (this.stats.totalRequests === 0) return 0;
    return this.stats.hits / this.stats.totalRequests;
  }
}
