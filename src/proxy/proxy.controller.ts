import {
  Controller,
  Post,
  All,
  Get,
  Req,
  Res,
  Body,
  Headers,
  Param,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { LoggingService } from './logging.service';
import { RequestAction } from './entities/request-log.entity';

@Controller()
export class ProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Health check endpoint
   */
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'Lasso Security LLM Proxy',
      timestamp: new Date().toISOString(),
      endpoints: {
        openai: '/openai/*',
        anthropic: '/anthropic/*'
      },
      features: {
        dataSanitization: true,
        timeBasedBlocking: true,
        caching: true,
        policyEnforcement: true,
        logging: true,
      }
    };
  }

  /**
   * Phase 4: Get request statistics
   */
  @Get('stats')
  async getStatistics() {
    return await this.loggingService.getStatistics();
  }

  /**
   * Phase 4: Get recent logs
   */
  @Get('logs')
  async getRecentLogs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 50;
    return await this.loggingService.getRecentLogs(limitNum);
  }

  /**
   * Phase 4: Get logs by action type
   */
  @Get('logs/:action')
  async getLogsByAction(
    @Param('action') action: RequestAction,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : 50;
    return await this.loggingService.getLogsByAction(action, limitNum);
  }

  /**
   * Phase 1: Catch-all endpoint for OpenAI requests
   * Handles all HTTP methods for paths starting with /openai/
   */
  @All('openai/*path')
  async proxyOpenAI(
    @Req() req: Request,
    @Res() res: Response,
    @Headers() headers: Record<string, string>,
    @Param('path') pathParam: string,
  ) {
    const path = '/' + pathParam;
    console.log(`🔄 Proxying OpenAI request: ${req.method} ${path}`);
    
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
    );
  }

  /**
   * Phase 1: Catch-all endpoint for Anthropic requests
   * Handles all HTTP methods for paths starting with /anthropic/
   */
  @All('anthropic/*path')
  async proxyAnthropic(
    @Req() req: Request,
    @Res() res: Response,
    @Headers() headers: Record<string, string>,
    @Param('path') pathParam: string,
  ) {
    const path = '/' + pathParam;
    console.log(`🔄 Proxying Anthropic request: ${req.method} ${path}`);
    
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
    );
  }
}
