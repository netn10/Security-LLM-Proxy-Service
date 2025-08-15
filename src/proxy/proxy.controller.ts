import {
  Controller,
  All,
  Get,
  Req,
  Res,
  Headers,
  Param,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { LoggingService } from './logging.service';
import { RequestAction } from './entities/request-log.entity';
import { formatTimestamp } from '../common/utils/timestamp.util';

@Controller()
export class ProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Root endpoint with quick pointers
   */
  @Get('/')
  root() {
    return {
      message: 'Lasso Security LLM Proxy is running',
      try: {
        health: '/health',
        openai: '/openai/*path',
        anthropic: '/anthropic/*path',
        stats: '/stats',
        logs: '/logs'
      }
    };
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'Lasso Security LLM Proxy',
      timestamp: formatTimestamp(),
      endpoints: {
        openai: '/openai/*path',
        anthropic: '/anthropic/*path'
      },
      features: {
        dataSanitization: true,
        timeBasedBlocking: true,
        rateLimiting: true,
        caching: true,
        policyEnforcement: true,
        logging: true,
      }
    };
  }

  @Get('stats')
  async getStatistics() {
    return await this.loggingService.getStatistics();
  }

  @Get('logs')
  async getRecentLogs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 50;
    return await this.loggingService.getRecentLogs(limitNum);
  }

  @Get('logs/:action')
  async getLogsByAction(
    @Param('action') action: RequestAction,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : 50;
    return await this.loggingService.getLogsByAction(action, limitNum);
  }

  @All('openai/*path')
  async proxyOpenAI(
    @Req() req: Request,
    @Res() res: Response,
    @Headers() headers: Record<string, string>,
  ) {
    // Extract the path from the original URL
    const originalUrl = req.url;
    const path = originalUrl.replace('/openai', '');
    
    console.log(`[${formatTimestamp()}] 🔄 Proxying OpenAI request: ${req.method} ${path}`);
    
    // Get raw body data
    let body: any = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = req.body;
    }
    
    return this.proxyService.forwardRequest(
      'openai',
      req.method,
      path,
      body,
      headers,
      res,
      req,
    );
  }

  @All('anthropic/*path')
  async proxyAnthropic(
    @Req() req: Request,
    @Res() res: Response,
    @Headers() headers: Record<string, string>,
  ) {
    // Extract the path from the original URL
    const originalUrl = req.url;
    const path = originalUrl.replace('/anthropic', '');
    
    console.log(`[${formatTimestamp()}] 🔄 Proxying Anthropic request: ${req.method} ${path}`);
    
    // Get raw body data
    let body: any = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = req.body;
    }
    
    return this.proxyService.forwardRequest(
      'anthropic',
      req.method,
      path,
      body,
      headers,
      res,
      req,
    );
  }
}
