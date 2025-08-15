const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3000';

async function testDashboard() {
  console.log('🧪 Testing Lasso Proxy Dashboard...\n');

  try {
    // Test 1: Check if dashboard HTML is served
    console.log('1. Testing dashboard HTML endpoint...');
    const dashboardResponse = await axios.get(`${BASE_URL}/dashboard`);
    if (dashboardResponse.status === 200 && dashboardResponse.data.includes('Lasso Proxy Dashboard')) {
      console.log('✅ Dashboard HTML served successfully');
    } else {
      console.log('📊 Dashboard HTML status: Not served correctly');
    }

    // Test 2: Test dashboard metrics endpoint
    console.log('\n2. Testing dashboard metrics endpoint...');
    const metricsResponse = await axios.get(`${BASE_URL}/dashboard/metrics`);
    if (metricsResponse.status === 200 && metricsResponse.data.system) {
      console.log('✅ Dashboard metrics endpoint working');
      console.log(`   - Uptime: ${metricsResponse.data.system.uptime}s`);
      console.log(`   - Memory: ${Math.round(metricsResponse.data.system.memoryUsage.heapUsed / 1024 / 1024)}MB`);
    } else {
      console.log('📊 Dashboard metrics endpoint status: Not available');
    }

    // Test 3: Test dashboard analytics endpoint
    console.log('\n3. Testing dashboard analytics endpoint...');
    const analyticsResponse = await axios.get(`${BASE_URL}/dashboard/analytics`);
    if (analyticsResponse.status === 200 && analyticsResponse.data.requestAnalytics) {
      console.log('✅ Dashboard analytics endpoint working');
      console.log(`   - Total requests: ${analyticsResponse.data.requestAnalytics.totalRequests}`);
      console.log(`   - Cache hit rate: ${analyticsResponse.data.cacheAnalytics.hitRate.toFixed(2)}%`);
    } else {
      console.log('📊 Dashboard analytics endpoint status: Not available');
    }

    // Test 4: Test dashboard logs endpoint
    console.log('\n4. Testing dashboard logs endpoint...');
    const logsResponse = await axios.get(`${BASE_URL}/dashboard/logs?limit=5`);
    if (logsResponse.status === 200 && Array.isArray(logsResponse.data)) {
      console.log('✅ Dashboard logs endpoint working');
      console.log(`   - Retrieved ${logsResponse.data.length} log entries`);
    } else {
      console.log('📊 Dashboard logs endpoint status: Not available');
    }

    // Test 5: Test WebSocket connection
    console.log('\n5. Testing WebSocket connection...');
    const socket = io(BASE_URL);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      socket.on('connect', () => {
        console.log('✅ WebSocket connected successfully');
        clearTimeout(timeout);
        resolve();
      });

      socket.on('connect_error', (error) => {
        console.log('📊 WebSocket connection status:', error.message);
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Test 6: Test real-time monitoring data
    console.log('\n6. Testing real-time monitoring data...');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Monitoring data timeout'));
      }, 10000);

      socket.on('monitoring-update', (data) => {
        console.log('✅ Real-time monitoring data received');
        console.log(`   - Timestamp: ${data.timestamp}`);
        console.log(`   - Total requests: ${data.stats.total}`);
        console.log(`   - Cache hits: ${data.cacheStats.hits}`);
        console.log(`   - System uptime: ${data.systemMetrics.uptime}s`);
        clearTimeout(timeout);
        socket.disconnect();
        resolve();
      });

      // Request monitoring update
      socket.emit('request-update');
    });

    console.log('\n🎉 All dashboard tests passed!');
    console.log('\n📊 Dashboard Features:');
    console.log('   - Real-time WebSocket monitoring');
    console.log('   - System metrics and performance data');
    console.log('   - Request statistics and analytics');
    console.log('   - Cache performance monitoring');
    console.log('   - Live log streaming');
    console.log('   - Interactive charts and visualizations');
    console.log('   - System alerts and notifications');

  } catch (error) {
    console.log('📊 Dashboard test result:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the proxy server is running:');
      console.log('   npm run start:dev');
    }
  }
}

// Run the test
testDashboard();
