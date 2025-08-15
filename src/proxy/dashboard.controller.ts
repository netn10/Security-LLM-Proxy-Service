import { Controller, Get, Res, Query, Param, Delete } from '@nestjs/common';
import { Response } from 'express';
import { LoggingService } from './logging.service';
import { CacheService } from './cache.service';
import { RateLimitingService } from './rate-limiting.service';

@Controller('dashboard')
export class DashboardController {
    constructor(
        private readonly loggingService: LoggingService,
        private readonly cacheService: CacheService,
        private readonly rateLimitingService: RateLimitingService,
    ) { }

    /**
     * Serve the main dashboard HTML page
     */
    @Get()
    async getDashboard(@Res() res: Response) {
        const html = this.generateDashboardHTML();
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }

    /**
     * Get detailed system metrics
     */
    @Get('metrics')
    async getMetrics() {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        const cacheStats = this.cacheService.getStats();

        return {
            timestamp: new Date().toISOString(),
            system: {
                uptime,
                memoryUsage,
                nodeVersion: process.version,
                platform: process.platform,
                pid: process.pid,
            },
            cache: {
                ...cacheStats,
                hitRate: this.cacheService.getHitRate(),
            },
            performance: {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                external: memoryUsage.external,
                rss: memoryUsage.rss,
            }
        };
    }

    /**
     * Get real-time logs with filtering
     */
    @Get('logs')
    async getLogs(@Query('limit') limit?: string, @Query('action') action?: string) {
        const limitNum = limit ? parseInt(limit) : 50;

        if (action) {
            return await this.loggingService.getLogsByAction(action as any, limitNum);
        } else {
            return await this.loggingService.getRecentLogs(limitNum);
        }
    }

    /**
     * Get rate limiting statistics
     */
    @Get('rate-limits')
    async getRateLimitStats() {
        return {
            timestamp: new Date().toISOString(),
            rateLimiting: this.rateLimitingService.getStats(),
        };
    }

    /**
     * Get rate limit status for a specific IP
     */
    @Get('rate-limits/:ip')
    async getRateLimitStatus(@Param('ip') ip: string) {
        return {
            timestamp: new Date().toISOString(),
            ip,
            status: this.rateLimitingService.getRateLimitStatus(ip),
        };
    }

    /**
     * Reset rate limit for a specific IP
     */
    @Delete('rate-limits/:ip')
    async resetRateLimit(@Param('ip') ip: string) {
        this.rateLimitingService.resetRateLimit(ip);
        return {
            timestamp: new Date().toISOString(),
            message: `Rate limit reset for IP: ${ip}`,
        };
    }

    /**
     * Get performance analytics
     */
    @Get('analytics')
    async getAnalytics() {
        const stats = await this.loggingService.getStatistics();
        const cacheStats = this.cacheService.getStats();
        const rateLimitStats = this.rateLimitingService.getStats();

        return {
            timestamp: new Date().toISOString(),
            requestAnalytics: {
                totalRequests: stats.total,
                requestsByProvider: stats.byProvider,
                requestsByAction: stats.byAction,
                successRate: this.calculateSuccessRate(stats),
            },
            cacheAnalytics: {
                hitRate: this.cacheService.getHitRate(),
                totalCacheRequests: cacheStats.totalRequests,
                cacheHits: cacheStats.hits,
                cacheMisses: cacheStats.misses,
                cacheSize: cacheStats.size,
            },
            rateLimitAnalytics: {
                totalIPs: rateLimitStats.totalIPs,
                maxTokens: rateLimitStats.maxTokens,
                refillRate: rateLimitStats.refillRate,
                refillInterval: rateLimitStats.refillInterval,
            },
            systemHealth: {
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime(),
                isHealthy: this.isSystemHealthy(),
            }
        };
    }

    private calculateSuccessRate(stats: any): number {
        const total = stats.total;
        const blocked = (stats.byAction.blocked_time || 0) + (stats.byAction.blocked_financial || 0) + (stats.byAction.blocked_rate_limit || 0);
        return total > 0 ? ((total - blocked) / total) * 100 : 100;
    }

    private isSystemHealthy(): boolean {
        const memoryUsage = process.memoryUsage();
        const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
        return memoryUsagePercent < 0.9; // Consider healthy if memory usage is less than 90%
    }

    private generateDashboardHTML(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lasso Proxy Dashboard</title>
    <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
            transition: all 0.3s ease;
        }

        body.dark-mode {
            background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            color: #e2e8f0;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }

        .dark-mode .header {
            background: rgba(26, 32, 44, 0.95);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .header h1 {
            color: #4a5568;
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-align: center;
            transition: color 0.3s ease;
        }

        .dark-mode .header h1 {
            color: #e2e8f0;
        }

        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }

        .status-online {
            background-color: #48bb78;
        }

        .status-offline {
            background-color: #f56565;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
        }

        .dark-mode .card {
            background: rgba(26, 32, 44, 0.95);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }

        .dark-mode .card:hover {
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        }

        .card h3 {
            color: #4a5568;
            margin-bottom: 15px;
            font-size: 1.3rem;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
            transition: color 0.3s ease, border-color 0.3s ease;
        }

        .dark-mode .card h3 {
            color: #e2e8f0;
            border-bottom-color: #4a5568;
        }

        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding: 10px;
            background: rgba(237, 242, 247, 0.5);
            border-radius: 8px;
            transition: background 0.3s ease;
        }

        .dark-mode .metric {
            background: rgba(45, 55, 72, 0.5);
        }

        .metric-label {
            font-weight: 500;
            color: #4a5568;
            transition: color 0.3s ease;
        }

        .dark-mode .metric-label {
            color: #cbd5e0;
        }

        .metric-value {
            font-weight: bold;
            color: #2d3748;
            font-size: 1.1rem;
            transition: color 0.3s ease;
        }

        .dark-mode .metric-value {
            color: #f7fafc;
        }

        .chart-container {
            position: relative;
            height: 300px;
            margin-top: 15px;
        }

        .logs-container {
            max-height: 400px;
            overflow-y: auto;
            background: rgba(237, 242, 247, 0.3);
            border-radius: 8px;
            padding: 15px;
            transition: background 0.3s ease;
        }

        .dark-mode .logs-container {
            background: rgba(45, 55, 72, 0.3);
        }

        .log-entry {
            padding: 8px 12px;
            margin-bottom: 8px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 6px;
            border-left: 4px solid #4299e1;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            transition: background 0.3s ease, color 0.3s ease;
        }

        .dark-mode .log-entry {
            background: rgba(26, 32, 44, 0.8);
            color: #e2e8f0;
        }

        .log-entry.proxied {
            border-left-color: #48bb78;
        }

        .log-entry.blocked_time {
            border-left-color: #f56565;
        }

        .log-entry.blocked_financial {
            border-left-color: #ed8936;
        }

        .log-entry.blocked_rate_limit {
            border-left-color: #9f7aea;
        }

        .log-entry.served_from_cache {
            border-left-color: #4299e1;
        }

        .alerts-container {
            margin-top: 15px;
        }

        .alert {
            padding: 10px 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            font-weight: 500;
        }

        .alert.warning {
            background: rgba(246, 173, 85, 0.2);
            border: 1px solid #ed8936;
            color: #c05621;
        }

        .alert.error {
            background: rgba(245, 101, 101, 0.2);
            border: 1px solid #f56565;
            color: #c53030;
        }

        .alert.info {
            background: rgba(66, 153, 225, 0.2);
            border: 1px solid #4299e1;
            color: #2b6cb0;
        }



        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: #718096;
        }

        .timestamp {
            text-align: center;
            color: #718096;
            font-size: 0.9rem;
            margin-top: 10px;
            transition: color 0.3s ease;
        }

        .dark-mode .timestamp {
            color: #a0aec0;
        }

        .theme-toggle {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.9);
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: all 0.3s ease;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
        }

        .dark-mode .theme-toggle {
            background: rgba(26, 32, 44, 0.9);
            color: #f7fafc;
        }

        .theme-toggle:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }
    </style>
</head>
<body>
    <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()">🌙</button>
    <div class="container">
        <div class="header">
            <h1>
                <span class="status-indicator status-online" id="statusIndicator"></span>
                Lasso Proxy Dashboard
            </h1>
            <div class="timestamp" id="lastUpdate">Last updated: Never</div>
        </div>

        <div class="grid">
            <!-- System Overview -->
            <div class="card">
                <h3>System Overview</h3>
                <div class="metric">
                    <span class="metric-label">Status</span>
                    <span class="metric-value" id="systemStatus">Online</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Uptime</span>
                    <span class="metric-value" id="uptime">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Memory Usage</span>
                    <span class="metric-value" id="memoryUsage">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Requests</span>
                    <span class="metric-value" id="totalRequests">-</span>
                </div>
            </div>

            <!-- Request Statistics -->
            <div class="card">
                <h3>Request Statistics</h3>
                <div class="metric">
                    <span class="metric-label">Proxied</span>
                    <span class="metric-value" id="proxiedCount">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Blocked (Time)</span>
                    <span class="metric-value" id="blockedTimeCount">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Blocked (Financial)</span>
                    <span class="metric-value" id="blockedFinancialCount">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Blocked (Rate Limit)</span>
                    <span class="metric-value" id="blockedRateLimitCount">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Served from Cache</span>
                    <span class="metric-value" id="cachedCount">-</span>
                </div>
            </div>

            <!-- Cache Performance -->
            <div class="card">
                <h3>Cache Performance</h3>
                <div class="metric">
                    <span class="metric-label">Hit Rate</span>
                    <span class="metric-value" id="cacheHitRate">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Cache Hits</span>
                    <span class="metric-value" id="cacheHits">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Cache Misses</span>
                    <span class="metric-value" id="cacheMisses">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Cache Size</span>
                    <span class="metric-value" id="cacheSize">-</span>
                </div>
            </div>

            <!-- Provider Distribution -->
            <div class="card">
                <h3>Provider Distribution</h3>
                <div class="metric">
                    <span class="metric-label">OpenAI</span>
                    <span class="metric-value" id="openaiCount">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Anthropic</span>
                    <span class="metric-value" id="anthropicCount">-</span>
                </div>
            </div>

            <!-- Rate Limiting -->
            <div class="card">
                <h3>Rate Limiting</h3>
                <div class="metric">
                    <span class="metric-label">Active IPs</span>
                    <span class="metric-value" id="activeIPs">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Max Tokens</span>
                    <span class="metric-value" id="maxTokens">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Refill Rate</span>
                    <span class="metric-value" id="refillRate">-</span>
                </div>
            </div>
        </div>

        <!-- Charts Row -->
        <div class="grid">
            <div class="card">
                <h3>Request Activity</h3>
                <div class="chart-container">
                    <canvas id="requestChart"></canvas>
                </div>
            </div>
            <div class="card">
                <h3>Action Distribution</h3>
                <div class="chart-container">
                    <canvas id="actionChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Alerts and Logs -->
        <div class="grid">
            <div class="card">
                <h3>System Alerts</h3>
                <div class="alerts-container" id="alertsContainer">
                    <div class="loading">No alerts at the moment</div>
                </div>
            </div>
            <div class="card">
                <h3>Recent Activity</h3>
                <div class="logs-container" id="logsContainer">
                    <div class="loading">Loading recent activity...</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let socket;
        let requestChart, actionChart;
        let requestData = [];
        let actionData = {};

        // Initialize Socket.IO connection
        function initializeSocket() {
            socket = io();
            
            socket.on('connect', () => {
                console.log('Connected to dashboard');
                document.getElementById('statusIndicator').className = 'status-indicator status-online';
                document.getElementById('systemStatus').textContent = 'Online';
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from dashboard');
                document.getElementById('statusIndicator').className = 'status-indicator status-offline';
                document.getElementById('systemStatus').textContent = 'Offline';
            });

            socket.on('monitoring-update', (data) => {
                updateDashboard(data);
            });

            socket.on('request-event', (event) => {
                addLogEntry(event);
            });

            socket.on('alert', (alert) => {
                addAlert(alert);
            });

            socket.on('logs-response', (logs) => {
                updateLogs(logs);
            });
        }

        // Update dashboard with new data
        function updateDashboard(data) {
            // Update timestamp
            document.getElementById('lastUpdate').textContent = 'Last updated: ' + new Date(data.timestamp).toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

            // Update system metrics
            document.getElementById('uptime').textContent = formatUptime(data.systemMetrics.uptime);
            document.getElementById('memoryUsage').textContent = formatBytes(data.systemMetrics.memoryUsage.heapUsed);
            document.getElementById('totalRequests').textContent = data.stats.total;

            // Update request statistics
            document.getElementById('proxiedCount').textContent = data.stats.byAction.proxied || 0;
            document.getElementById('blockedTimeCount').textContent = data.stats.byAction.blocked_time || 0;
            document.getElementById('blockedFinancialCount').textContent = data.stats.byAction.blocked_financial || 0;
            document.getElementById('blockedRateLimitCount').textContent = data.stats.byAction.blocked_rate_limit || 0;
            document.getElementById('cachedCount').textContent = data.stats.byAction.served_from_cache || 0;

            // Update cache performance
            const hitRate = data.cacheStats.hits + data.cacheStats.misses > 0 
                ? ((data.cacheStats.hits / (data.cacheStats.hits + data.cacheStats.misses)) * 100).toFixed(1)
                : '0.0';
            document.getElementById('cacheHitRate').textContent = hitRate + '%';
            document.getElementById('cacheHits').textContent = data.cacheStats.hits;
            document.getElementById('cacheMisses').textContent = data.cacheStats.misses;
            document.getElementById('cacheSize').textContent = data.cacheStats.size;

            // Update provider distribution
            document.getElementById('openaiCount').textContent = data.stats.byProvider.openai || 0;
            document.getElementById('anthropicCount').textContent = data.stats.byProvider.anthropic || 0;

            // Update rate limiting - check both possible data sources
            const rateLimitData = data.rateLimitStats || data.rateLimitAnalytics;
            if (rateLimitData) {
                document.getElementById('activeIPs').textContent = rateLimitData.totalIPs || 0;
                document.getElementById('maxTokens').textContent = rateLimitData.maxTokens || 0;
                document.getElementById('refillRate').textContent = (rateLimitData.refillRate || 0) + '/s';
            }

            // Update charts
            updateCharts(data);

            // Update alerts
            updateAlerts(data.alerts);
        }

        // Initialize charts
        function initializeCharts() {
            const requestCtx = document.getElementById('requestChart').getContext('2d');
            requestChart = new Chart(requestCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Request Activity (per 5s)',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });

            const actionCtx = document.getElementById('actionChart').getContext('2d');
            actionChart = new Chart(actionCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Proxied', 'Blocked (Time)', 'Blocked (Financial)', 'Blocked (Rate Limit)', 'Cached'],
                    datasets: [{
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: [
                            '#48bb78',
                            '#f56565',
                            '#ed8936',
                            '#9f7aea',
                            '#4299e1'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        // Update charts with new data
        function updateCharts(data) {
            // Use server-side request activity data
            if (data.requestActivity) {
                requestChart.data.labels = data.requestActivity.labels;
                requestChart.data.datasets[0].data = data.requestActivity.data;
                requestChart.update();
            }

            // Update action chart
            actionChart.data.datasets[0].data = [
                data.stats.byAction.proxied || 0,
                data.stats.byAction.blocked_time || 0,
                data.stats.byAction.blocked_financial || 0,
                data.stats.byAction.blocked_rate_limit || 0,
                data.stats.byAction.served_from_cache || 0
            ];
            actionChart.update();
        }

        // Update alerts
        function updateAlerts(alerts) {
            const container = document.getElementById('alertsContainer');
            if (alerts.length === 0) {
                container.innerHTML = '<div class="loading">No alerts at the moment</div>';
                return;
            }

            container.innerHTML = alerts.map(alert => 
                \`<div class="alert \${alert.type}">
                    <strong>\${alert.type.toUpperCase()}:</strong> \${alert.message}
                    <br><small>\${new Date(alert.timestamp).toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</small>
                </div>\`
            ).join('');
        }

        // Add log entry
        function addLogEntry(event) {
            const container = document.getElementById('logsContainer');
            const logEntry = document.createElement('div');
            logEntry.className = \`log-entry \${event.action}\`;
            logEntry.innerHTML = \`
                <strong>\${event.action}</strong> - \${event.provider}<br>
                <small>\${new Date(event.timestamp).toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</small>
            \`;
            
            container.insertBefore(logEntry, container.firstChild);
            
            // Keep only last 50 entries
            const entries = container.querySelectorAll('.log-entry');
            if (entries.length > 50) {
                container.removeChild(entries[entries.length - 1]);
            }
        }

        // Update logs
        function updateLogs(logs) {
            const container = document.getElementById('logsContainer');
            container.innerHTML = logs.map(log => 
                \`<div class="log-entry \${log.action}">
                    <strong>\${log.action}</strong> - \${log.provider}<br>
                    <small>\${new Date(log.timestamp).toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</small>
                </div>\`
            ).join('');
        }

        // Add alert
        function addAlert(alert) {
            const container = document.getElementById('alertsContainer');
            const alertDiv = document.createElement('div');
            alertDiv.className = \`alert \${alert.type}\`;
            alertDiv.innerHTML = \`
                <strong>\${alert.type.toUpperCase()}:</strong> \${alert.message}
                <br><small>\${new Date(alert.timestamp).toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</small>
            \`;
            
            container.insertBefore(alertDiv, container.firstChild);
            
            // Keep only last 10 alerts
            const alerts = container.querySelectorAll('.alert');
            if (alerts.length > 10) {
                container.removeChild(alerts[alerts.length - 1]);
            }
        }

        // Utility functions
        function formatUptime(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return \`\${hours}h \${minutes}m \${secs}s\`;
        }

        function formatBytes(bytes) {
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            if (bytes === 0) return '0 Bytes';
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        }

        // Theme management
        function toggleTheme() {
            const body = document.body;
            const themeToggle = document.getElementById('themeToggle');
            const isDark = body.classList.contains('dark-mode');
            
            if (isDark) {
                body.classList.remove('dark-mode');
                themeToggle.textContent = '🌙';
                localStorage.setItem('theme', 'light');
            } else {
                body.classList.add('dark-mode');
                themeToggle.textContent = '☀️';
                localStorage.setItem('theme', 'dark');
            }
        }

        function loadTheme() {
            const savedTheme = localStorage.getItem('theme');
            const body = document.body;
            const themeToggle = document.getElementById('themeToggle');
            
            if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                body.classList.add('dark-mode');
                themeToggle.textContent = '☀️';
            } else {
                body.classList.remove('dark-mode');
                themeToggle.textContent = '🌙';
            }
        }



        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', () => {
            loadTheme();
            initializeSocket();
            initializeCharts();
            
            // Request initial data
            socket.emit('request-update');
            socket.emit('get-logs', { limit: 50 });
        });
    </script>
</body>
</html>
    `;
    }
}
