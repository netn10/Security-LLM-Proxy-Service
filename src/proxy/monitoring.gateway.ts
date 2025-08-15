import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { CacheService } from './cache.service';
import { PolicyEnforcementService } from './policy-enforcement.service';
import { RateLimitingService } from './rate-limiting.service';
import { formatTimestamp } from '../common/utils/timestamp.util';

export interface MonitoringData {
  timestamp: string;
  stats: {
    total: number;
    byAction: Record<string, number>;
    byProvider: Record<string, number>;
  };
  recentLogs: any[];
  cacheStats: {
    hits: number;
    misses: number;
    size: number;
  };
  systemMetrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: number;
  };
  rateLimitStats: {
    totalIPs: number;
    maxTokens: number;
    refillRate: number;
    refillInterval: number;
  };
  alerts: {
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
  }[];
  requestActivity: {
    data: number[];
    labels: string[];
  };
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})
export class MonitoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients: Set<Socket> = new Set();
  private monitoringInterval: NodeJS.Timeout;
  private requestActivityData: number[] = [];
  private lastTotalRequests: number = 0;

  constructor(
    private readonly loggingService: LoggingService,
    private readonly cacheService: CacheService,
    private readonly policyEnforcementService: PolicyEnforcementService,
    private readonly rateLimitingService: RateLimitingService,
  ) { }

  onModuleInit() {
    // Broadcast monitoring data every 5 seconds
    this.monitoringInterval = setInterval(async () => {
      if (this.connectedClients.size > 0) {
        const monitoringData = await this.getMonitoringData();
        this.server.emit('monitoring-update', monitoringData);
      }
    }, 5000);
  }

  onModuleDestroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  handleConnection(client: Socket) {
    console.log(`[${formatTimestamp()}] 📊 Dashboard client connected: ${client.id}`);
    this.connectedClients.add(client);

    // Send initial data
    this.sendInitialData(client);
  }

  handleDisconnect(client: Socket) {
    console.log(`[${formatTimestamp()}] 📊 Dashboard client disconnected: ${client.id}`);
    this.connectedClients.delete(client);
  }

  @SubscribeMessage('request-update')
  async handleRequestUpdate(client: Socket) {
    const monitoringData = await this.getMonitoringData();
    client.emit('monitoring-update', monitoringData);
  }

  @SubscribeMessage('get-logs')
  async handleGetLogs(client: Socket, payload: { limit?: number; action?: string }) {
    try {
      let logs;
      if (payload.action) {
        logs = await this.loggingService.getLogsByAction(payload.action as any, payload.limit || 50);
      } else {
        logs = await this.loggingService.getRecentLogs(payload.limit || 50);
      }
      client.emit('logs-response', logs);
    } catch (error) {
      client.emit('error', { message: 'Failed to fetch logs' });
    }
  }

  @SubscribeMessage('get-stats')
  async handleGetStats(client: Socket) {
    try {
      const stats = await this.loggingService.getStatistics();
      client.emit('stats-response', stats);
    } catch (error) {
      client.emit('error', { message: 'Failed to fetch statistics' });
    }
  }

  @SubscribeMessage('reset-database')
  async handleResetDatabase(client: Socket) {
    try {
      console.log(`[${formatTimestamp()}] 🔄 Database reset requested via WebSocket`);

      // Import the reset function dynamically
      const { exec } = require('child_process');
      const path = require('path');

      const scriptPath = path.join(__dirname, '../../scripts/reset-database.js');

      exec(`node ${scriptPath} --confirm`, (error, stdout, stderr) => {
        if (error) {
          console.error(`[${formatTimestamp()}] ❌ Database reset failed:`, error);
          client.emit('database-reset-response', {
            success: false,
            message: 'Database reset failed: ' + error.message
          });
          return;
        }

        if (stderr) {
          console.warn(`[${formatTimestamp()}] ⚠️  Database reset warnings:`, stderr);
        }

        console.log(`[${formatTimestamp()}] ✅ Database reset completed successfully`);
        client.emit('database-reset-response', {
          success: true,
          message: 'Database reset completed successfully',
          output: stdout
        });
      });

    } catch (error) {
      console.error(`[${formatTimestamp()}] ❌ Database reset error:`, error);
      client.emit('database-reset-response', {
        success: false,
        message: 'Database reset error: ' + error.message
      });
    }
  }

  private async sendInitialData(client: Socket) {
    const monitoringData = await this.getMonitoringData();
    client.emit('monitoring-update', monitoringData);
  }

  private async getMonitoringData(): Promise<MonitoringData> {
    const [stats, recentLogs] = await Promise.all([
      this.loggingService.getStatistics(),
      this.loggingService.getRecentLogs(10)
    ]);

    // Update request activity data
    this.updateRequestActivity(stats.total);

    const cacheStats = this.cacheService.getStats();
    const systemMetrics = this.getSystemMetrics();
    const rateLimitStats = this.rateLimitingService.getStats();
    const alerts = this.getAlerts();

    return {
      timestamp: new Date().toISOString(),
      stats,
      recentLogs,
      cacheStats,
      systemMetrics,
      rateLimitStats,
      alerts,
      requestActivity: this.getRequestActivityData()
    };
  }

  private getSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Simple CPU usage calculation (this is a basic implementation)
    const startUsage = process.cpuUsage();
    const cpuUsage = (startUsage.user + startUsage.system) / 1000000; // Convert to seconds

    return {
      uptime,
      memoryUsage,
      cpuUsage
    };
  }

  private getAlerts() {
    const alerts = [];
    const memoryUsage = process.memoryUsage();

    // Memory usage alert
    if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.8) {
      alerts.push({
        type: 'warning' as const,
        message: 'High memory usage detected',
        timestamp: new Date().toISOString()
      });
    }

    // Cache hit rate alert
    const cacheStats = this.cacheService.getStats();
    if (cacheStats.hits + cacheStats.misses > 0) {
      const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
      if (hitRate < 0.3) {
        alerts.push({
          type: 'info' as const,
          message: 'Low cache hit rate detected',
          timestamp: new Date().toISOString()
        });
      }
    }

    return alerts;
  }

  // Method to broadcast real-time events
  public broadcastRequestEvent(eventData: any) {
    this.server.emit('request-event', {
      ...eventData,
      timestamp: new Date().toISOString()
    });
  }

  public broadcastAlert(alert: { type: 'warning' | 'error' | 'info'; message: string }) {
    this.server.emit('alert', {
      ...alert,
      timestamp: new Date().toISOString()
    });
  }

  private updateRequestActivity(currentTotal: number) {
    // Calculate new requests since last update
    let newRequests = currentTotal - this.lastTotalRequests;

    // Handle cases where total count might have been reset (e.g., database cleanup, server restart)
    if (newRequests < 0) {
      // If we get negative values, it means the total was reset
      // In this case, we should treat it as 0 new requests rather than negative
      newRequests = 0;
    }

    this.lastTotalRequests = currentTotal;

    // Add new request activity to the data array
    this.requestActivityData.push(newRequests);

    // Keep only last 20 data points (100 seconds of data)
    if (this.requestActivityData.length > 20) {
      this.requestActivityData.shift();
    }
  }

  private getRequestActivityData() {
    // Generate labels for the last 20 time intervals
    const labels = Array.from({ length: this.requestActivityData.length }, (_, i) =>
      new Date(Date.now() - (this.requestActivityData.length - i - 1) * 5000).toLocaleTimeString('en-US', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    );

    return {
      data: [...this.requestActivityData], // Return a copy to prevent external modification
      labels
    };
  }
}
