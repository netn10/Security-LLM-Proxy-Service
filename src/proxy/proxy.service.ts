import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { DataSanitizationService } from './data-sanitization.service';
import { CacheService } from './cache.service';
import { LoggingService } from './logging.service';
import { PolicyEnforcementService } from './policy-enforcement.service';
import { RequestAction } from './entities/request-log.entity';
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
  ): Promise<void> {
    const startTime = Date.now();
    let action: RequestAction = RequestAction.PROXIED;
    let errorMessage: string | undefined;
    let sanitizedBody = body; // Initialize sanitizedBody

    try {
      // Phase 3: Time-based blocking
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

        throw new HttpException(
          {
            error: {
              message: 'Request blocked due to time-based policy',
              code: 'TIME_BLOCKED',
            },
          },
          HttpStatus.FORBIDDEN,
        );
      }

      // Phase 2: Apply data sanitization for specific endpoints
      sanitizedBody = this.shouldSanitizeEndpoint(path) 
        ? this.dataSanitizationService.sanitizeData(body)
        : body;

      // Phase 5: LLM-based policy enforcement for supported endpoints
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

        throw new HttpException(
          {
            error: {
              message: 'Request blocked due to financial content policy',
              code: 'FINANCIAL_BLOCKED',
            },
          },
          HttpStatus.FORBIDDEN,
        );
      }

      // Phase 3: Check cache for identical requests
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

          // Return cached response
          res.status(cachedResponse.status);
          Object.entries(cachedResponse.headers || {}).forEach(([key, value]) => {
            if (typeof value === 'string') {
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
      console.log(`📡 Forwarding to: ${method} ${targetURL}`);

      const response = await this.makeNativeRequest(
        method,
        targetURL,
        sanitizedBody,
        targetHeaders,
      );

      // Phase 3: Cache successful responses
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
      Object.entries(response.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          res.setHeader(key, value);
        }
      });

      res.send(response.data);

    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // Re-throw our custom exceptions
      }

      console.error('❌ Proxy error:', error.message);
      errorMessage = error.message;
      action = RequestAction.PROXIED; // Still log as proxied even if it failed
      
      throw new HttpException(
        'Proxy request failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      // Phase 4: Log the request (if not already logged)
      if (action !== RequestAction.BLOCKED_TIME && action !== RequestAction.BLOCKED_FINANCIAL) {
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
}
