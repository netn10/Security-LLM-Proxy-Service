import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RateLimitInfo {
  tokens: number;
  lastRefill: number;
}

@Injectable()
export class RateLimitingService {
  private rateLimitStore = new Map<string, RateLimitInfo>();
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private readonly refillInterval: number; // milliseconds

  constructor(private readonly configService: ConfigService) {
    // Get rate limiting configuration from environment variables
    this.maxTokens = this.configService.get<number>('RATE_LIMIT_MAX_TOKENS', 100);
    this.refillRate = this.configService.get<number>('RATE_LIMIT_REFILL_RATE', 10); // 10 tokens per second
    this.refillInterval = this.configService.get<number>('RATE_LIMIT_REFILL_INTERVAL', 1000); // 1 second
  }

  /**
   * Check if a request from the given IP should be rate limited
   * @param ip The IP address of the client
   * @param tokensRequired Number of tokens required for this request (default: 1)
   * @returns true if request should be allowed, false if rate limited
   */
  async isAllowed(ip: string, tokensRequired: number = 1): Promise<boolean> {
    const now = Date.now();
    const rateLimitInfo = this.rateLimitStore.get(ip) || {
      tokens: this.maxTokens,
      lastRefill: now,
    };

    // Refill tokens based on time elapsed
    const timeElapsed = now - rateLimitInfo.lastRefill;
    const tokensToAdd = Math.floor((timeElapsed / this.refillInterval) * this.refillRate);
    
    if (tokensToAdd > 0) {
      rateLimitInfo.tokens = Math.min(this.maxTokens, rateLimitInfo.tokens + tokensToAdd);
      rateLimitInfo.lastRefill = now;
    }

    // Check if we have enough tokens
    if (rateLimitInfo.tokens >= tokensRequired) {
      rateLimitInfo.tokens -= tokensRequired;
      this.rateLimitStore.set(ip, rateLimitInfo);
      return true;
    }

    // Update the store even if rate limited (to save the refill time)
    this.rateLimitStore.set(ip, rateLimitInfo);
    return false;
  }

  /**
   * Get current rate limit status for an IP
   * @param ip The IP address
   * @returns Rate limit information including remaining tokens and reset time
   */
  getRateLimitStatus(ip: string): {
    remaining: number;
    resetTime: number;
    maxTokens: number;
  } {
    const rateLimitInfo = this.rateLimitStore.get(ip);
    if (!rateLimitInfo) {
      return {
        remaining: this.maxTokens,
        resetTime: Date.now() + this.refillInterval,
        maxTokens: this.maxTokens,
      };
    }

    const now = Date.now();
    const timeElapsed = now - rateLimitInfo.lastRefill;
    const tokensToAdd = Math.floor((timeElapsed / this.refillInterval) * this.refillRate);
    const currentTokens = Math.min(this.maxTokens, rateLimitInfo.tokens + tokensToAdd);

    return {
      remaining: Math.max(0, currentTokens),
      resetTime: rateLimitInfo.lastRefill + this.refillInterval,
      maxTokens: this.maxTokens,
    };
  }

  /**
   * Reset rate limit for a specific IP (useful for testing or admin purposes)
   * @param ip The IP address to reset
   */
  resetRateLimit(ip: string): void {
    this.rateLimitStore.delete(ip);
  }

  /**
   * Get rate limiting statistics
   * @returns Statistics about rate limiting usage
   */
  getStats(): {
    totalIPs: number;
    maxTokens: number;
    refillRate: number;
    refillInterval: number;
  } {
    return {
      totalIPs: this.rateLimitStore.size,
      maxTokens: this.maxTokens,
      refillRate: this.refillRate,
      refillInterval: this.refillInterval,
    };
  }

  /**
   * Clean up old entries to prevent memory leaks
   * This should be called periodically
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [ip, info] of this.rateLimitStore.entries()) {
      if (now - info.lastRefill > maxAge) {
        this.rateLimitStore.delete(ip);
      }
    }
  }
}
