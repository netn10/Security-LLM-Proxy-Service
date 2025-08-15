import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { DataSanitizationService } from './data-sanitization.service';
import { CacheService } from './cache.service';
import { LoggingService } from './logging.service';
import { PolicyEnforcementService } from './policy-enforcement.service';
import { RateLimitingService } from './rate-limiting.service';
import { MonitoringGateway } from './monitoring.gateway';
import { RequestAction } from './entities/request-log.entity';
import { FinancialContentException } from './exceptions/financial-content.exception';
import { TimeBlockedException } from './exceptions/time-blocked.exception';
import { RateLimitedException } from './exceptions/rate-limited.exception';
import { SensitiveDataException } from './exceptions/sensitive-data.exception';
import { formatTimestamp } from '../common/utils/timestamp.util';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

@Injectable()
export class ProxyService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly dataSanitizationService: DataSanitizationService,
    private readonly cacheService: CacheService,
    private readonly loggingService: LoggingService,
    private readonly policyEnforcementService: PolicyEnforcementService,
    private readonly rateLimitingService: RateLimitingService,
    private readonly monitoringGateway: MonitoringGateway,
  ) {}

  /**
   * Complete proxy implementation with all phases
   */
  async forwardRequest(
    provider: 'openai' | 'anthropic',
    method: string,
    path: string,
    body: any,
    headers: Record<string, string>,
    res: Response,
    req?: Request,
  ): Promise<void> {
    const startTime = Date.now();
    let action: RequestAction = RequestAction.PROXIED;
    let errorMessage: string | undefined;
    let sanitizedBody = body; // Initialize sanitizedBody

    try {
      // Phase 1: Rate limiting
      if (req && this.shouldApplyRateLimiting()) {
        const clientIP = this.getClientIP(req);
        const tokensRequired = this.getTokensRequired(path, method);
        
        if (!(await this.rateLimitingService.isAllowed(clientIP, tokensRequired))) {
          action = RequestAction.BLOCKED_RATE_LIMIT;
          errorMessage = 'Request blocked due to rate limiting';
          
          await this.loggingService.logRequest(
            provider,
            body,
            action,
            path,
            Date.now() - startTime,
            errorMessage,
          );

          // Broadcast to monitoring dashboard
          this.monitoringGateway.broadcastRequestEvent({
            provider,
            action,
            path,
            timestamp: new Date().toISOString(),
          });

          throw new RateLimitedException();
        }
      }

      // Phase 2: Time-based blocking
      if (this.shouldBlockByTime()) {
        action = RequestAction.BLOCKED_TIME;
        errorMessage = 'Request blocked due to time-based policy';
        
        await this.loggingService.logRequest(
          provider,
          body,
          action,
          path,
          Date.now() - startTime,
          errorMessage,
        );

        // Broadcast to monitoring dashboard
        this.monitoringGateway.broadcastRequestEvent({
          provider,
          action,
          path,
          timestamp: new Date().toISOString(),
        });

        throw new TimeBlockedException();
      }

      // Phase 3: Apply data sanitization for specific endpoints
      try {
        sanitizedBody = this.shouldSanitizeEndpoint(path) 
          ? await this.dataSanitizationService.sanitizeData(body)
          : body;
      } catch (error) {
        if (error instanceof SensitiveDataException) {
          action = RequestAction.BLOCKED_SENSITIVE_DATA;
          errorMessage = 'Request blocked due to sensitive data detection';
          
          await this.loggingService.logRequest(
            provider,
            body,
            action,
            path,
            Date.now() - startTime,
            errorMessage,
          );

          // Broadcast to monitoring dashboard
          this.monitoringGateway.broadcastRequestEvent({
            provider,
            action,
            path,
            timestamp: new Date().toISOString(),
          });

          throw error;
        }
        throw error; // Re-throw other errors
      }

      // Phase 4: LLM-based policy enforcement for supported endpoints
      if (this.shouldEnforcePolicy(path) && await this.policyEnforcementService.shouldBlockFinancialContent(sanitizedBody)) {
        action = RequestAction.BLOCKED_FINANCIAL;
        errorMessage = 'Request blocked due to financial content policy';
        
        await this.loggingService.logRequest(
          provider,
          sanitizedBody,
          action,
          path,
          Date.now() - startTime,
          errorMessage,
        );

        // Broadcast to monitoring dashboard
        this.monitoringGateway.broadcastRequestEvent({
          provider,
          action,
          path,
          timestamp: new Date().toISOString(),
        });

        throw new FinancialContentException();
      }

      // Phase 5: Check cache for identical requests
      if (this.shouldUseCache(path)) {
        const cacheKey = this.cacheService.generateCacheKey(provider, path, sanitizedBody);
        const cachedResponse = await this.cacheService.get(cacheKey);
        
        if (cachedResponse) {
          action = RequestAction.SERVED_FROM_CACHE;
          
          await this.loggingService.logRequest(
            provider,
            sanitizedBody,
            action,
            path,
            Date.now() - startTime,
          );

          // Broadcast to monitoring dashboard
          this.monitoringGateway.broadcastRequestEvent({
            provider,
            action,
            path,
            timestamp: new Date().toISOString(),
          });

          // Return cached response
          res.status(cachedResponse.status);
          const skipCachedHeaders = new Set([
            'transfer-encoding',
            'content-length',
            'connection',
            'keep-alive',
            'content-encoding',
          ]);
          Object.entries(cachedResponse.headers || {}).forEach(([key, value]) => {
            const lowerKey = key.toLowerCase();
            if (typeof value === 'string' && !skipCachedHeaders.has(lowerKey)) {
              res.setHeader(key, value);
            }
          });
          res.send(cachedResponse.data);
          return;
        }
      }

      // Get provider configuration
      const baseURL = this.getProviderBaseURL(provider);
      const apiKey = this.getProviderAPIKey(provider);

      // Prepare headers for the target API
      const targetHeaders = this.prepareHeaders(headers, provider, apiKey);

      // Make the request to the target API using native Node.js
      const targetURL = `${baseURL}${path}`;

      const response = await this.makeNativeRequest(
        method,
        targetURL,
        sanitizedBody,
        targetHeaders,
      );

      // Phase 6: Cache successful responses
      if (this.shouldUseCache(path) && response.status === 200) {
        const cacheKey = this.cacheService.generateCacheKey(provider, path, sanitizedBody);
        const cacheTTL = this.configService.get<number>('CACHE_TTL', 300);
        
        await this.cacheService.set(cacheKey, {
          status: response.status,
          headers: response.headers,
          data: response.data,
        }, cacheTTL);
      }

      // Forward the response back to the client
      res.status(response.status);
      
      // Copy response headers
      const skipHeaders = new Set([
        'transfer-encoding',
        'content-length',
        'connection',
        'keep-alive',
        'content-encoding',
      ]);
      Object.entries(response.headers).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase();
        if (typeof value === 'string' && !skipHeaders.has(lowerKey)) {
          res.setHeader(key, value);
        }
      });

      res.send(response.data);

      // Broadcast successful proxy request to monitoring dashboard
      this.monitoringGateway.broadcastRequestEvent({
        provider,
        action,
        path,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // Re-throw our custom exceptions
      }

      console.error(`[${formatTimestamp()}] ❌ Proxy error:`, error.message);
      errorMessage = error.message;
      action = RequestAction.PROXIED; // Still log as proxied even if it failed
      
      throw new HttpException(
        'Proxy request failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      // Phase 7: Log the request (if not already logged)
      const blockedActions = [
        RequestAction.BLOCKED_TIME,
        RequestAction.BLOCKED_FINANCIAL,
        RequestAction.BLOCKED_RATE_LIMIT,
        RequestAction.BLOCKED_SENSITIVE_DATA
      ];
      if (!blockedActions.includes(action)) {
        await this.loggingService.logRequest(
          provider,
          sanitizedBody || body,
          action,
          path,
          Date.now() - startTime,
          errorMessage,
        );
      }
    }
  }

  /**
   * Phase 3: Check if request should be blocked based on current time
   */
  private shouldBlockByTime(): boolean {
    const timeBlockingEnabled = this.configService.get<boolean>('ENABLE_TIME_BASED_BLOCKING', true);
    
    if (!timeBlockingEnabled) {
      return false;
    }

    const currentSeconds = new Date().getSeconds();
    const blockedSeconds = [1, 2, 7, 8];
    
    return blockedSeconds.includes(currentSeconds);
  }

  /**
   * Phase 3: Check if caching should be used for this endpoint
   */
  private shouldUseCache(path: string): boolean {
    const cachingEnabled = this.configService.get<boolean>('ENABLE_CACHING', true);
    
    if (!cachingEnabled) {
      return false;
    }

    // Only cache specific endpoints
    return path.includes('/chat/completions') || path.includes('/messages');
  }

  /**
   * Phase 5: Check if policy enforcement should be applied
   */
  private shouldEnforcePolicy(path: string): boolean {
    const policyEnabled = this.configService.get<boolean>('ENABLE_POLICY_ENFORCEMENT', true);
    
    if (!policyEnabled) {
      return false;
    }

    // Only enforce policy on specific endpoints
    return path.includes('/chat/completions') || path.includes('/messages');
  }

  /**
   * Get the base URL for a provider
   */
  private getProviderBaseURL(provider: 'openai' | 'anthropic'): string {
    switch (provider) {
      case 'openai':
        return this.configService.get<string>('OPENAI_API_URL', 'https://api.openai.com');
      case 'anthropic':
        return this.configService.get<string>('ANTHROPIC_API_URL', 'https://api.anthropic.com');
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Get the API key for a provider
   */
  private getProviderAPIKey(provider: 'openai' | 'anthropic'): string {
    switch (provider) {
      case 'openai':
        return this.configService.get<string>('OPENAI_API_KEY');
      case 'anthropic':
        return this.configService.get<string>('ANTHROPIC_API_KEY');
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Phase 2: Check if endpoint should be sanitized
   */
  private shouldSanitizeEndpoint(path: string): boolean {
    const sanitizationEnabled = this.configService.get<boolean>('ENABLE_DATA_SANITIZATION', true);
    
    if (!sanitizationEnabled) {
      return false;
    }

    // Only sanitize specific endpoints
    return path.includes('/chat/completions') || path.includes('/messages');
  }

  /**
   * Prepare headers for the target API request
   */
  private prepareHeaders(
    originalHeaders: Record<string, string>,
    provider: 'openai' | 'anthropic',
    apiKey: string,
  ): Record<string, string> {
    // Start with a clean headers object
    const headers: Record<string, string> = {};
    
    // Only copy safe headers from original headers, excluding problematic ones
    const safeHeaders = [
      'content-type', 'Content-Type',
      'user-agent', 'User-Agent',
      'accept', 'Accept',
      'cache-control', 'Cache-Control',
      'pragma', 'Pragma'
    ];
    
    // Copy safe headers, ensuring we don't have conflicting versions
    safeHeaders.forEach(header => {
      const lowerHeader = header.toLowerCase();
      if (originalHeaders[header]) {
        headers[header] = originalHeaders[header];
      } else if (originalHeaders[lowerHeader]) {
        headers[header] = originalHeaders[lowerHeader];
      }
    });

    // Add provider-specific authorization
    switch (provider) {
      case 'openai':
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
    }

    // Ensure content-type is set for POST requests
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Request identity encoding to avoid compression-related header conflicts
    headers['Accept-Encoding'] = 'identity';

    return headers;
  }

  /**
   * Make HTTP request using native Node.js modules to avoid header conflicts
   */
  private makeNativeRequest(
    method: string,
    url: string,
    data: any,
    headers: Record<string, string>,
  ): Promise<{ status: number; headers: any; data: any }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      // Clean headers to avoid conflicts
      const cleanHeaders: Record<string, string> = {};
      
      // Copy headers but exclude problematic ones
      Object.entries(headers).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase();
        // Exclude headers that Node.js will handle automatically or cause conflicts
        if (!['content-length', 'transfer-encoding', 'host', 'connection', 'keep-alive'].includes(lowerKey)) {
          cleanHeaders[key] = value;
        }
      });

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method.toUpperCase(),
        headers: {
          ...cleanHeaders,
          'Host': urlObj.hostname,
        },
      };

      const req = client.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          let parsedData;
          try {
            parsedData = JSON.parse(responseData);
          } catch {
            parsedData = responseData;
          }
          
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            data: parsedData,
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      // Send request body if present
      if (data && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
        const bodyData = typeof data === 'string' ? data : JSON.stringify(data);
        req.write(bodyData);
      }

      req.end();
    });
  }

  /**
   * Phase 1: Check if rate limiting should be applied
   */
  private shouldApplyRateLimiting(): boolean {
    return this.configService.get<boolean>('ENABLE_RATE_LIMITING', true);
  }

  /**
   * Get the client IP address from the request
   */
  private getClientIP(req: Request): string {
    // Check for forwarded headers first (for proxy scenarios)
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIP = req.headers['x-real-ip'] as string;
    if (realIP) {
      return realIP;
    }

    // Fallback to connection remote address
    return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  }

  /**
   * Determine how many tokens a request should cost based on endpoint and method
   */
  private getTokensRequired(path: string, method: string): number {
    // Base cost for all requests
    let tokens = 1;

    // Higher cost for expensive operations
    if (path.includes('/chat/completions') || path.includes('/messages')) {
      tokens = 5; // Chat completions are more expensive
    }

    // Higher cost for POST requests (they usually contain more data)
    if (method.toUpperCase() === 'POST') {
      tokens *= 2;
    }

    return tokens;
  }
}
