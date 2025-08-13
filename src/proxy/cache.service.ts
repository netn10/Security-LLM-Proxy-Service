import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
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
      return await this.cacheManager.get(key);
    } catch (error) {
      console.warn('Cache get error:', error.message);
      return null;
    }
  }

  /**
   * Set cached response with TTL
   */
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
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
}
