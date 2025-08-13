/**
 * Simple test script to verify proxy functionality
 * Run with: node test/test-proxy.js
 */

const axios = require('axios');

const PROXY_BASE_URL = 'http://localhost:3000';

// Test data with sensitive information
const testData = {
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'user',
      content: 'Hello! My email is test@example.com and my server IP is 192.168.1.100. Also, here is an IBAN: GB82WEST12345698765432'
    }
  ],
  max_tokens: 50
};

async function testOpenAIProxy() {
  console.log('🧪 Testing OpenAI proxy...');
  console.log('📤 Original data:', JSON.stringify(testData, null, 2));
  
  try {
    const response = await axios.post(
      `${PROXY_BASE_URL}/openai/v1/chat/completions`,
      testData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key' // This will be replaced by the proxy
        },
        timeout: 10000,
        validateStatus: () => true // Accept all status codes for testing
      }
    );
    
    console.log('✅ OpenAI proxy response status:', response.status);
    console.log('📥 Response headers:', response.headers);
    
    if (response.status === 401) {
      console.log('🔑 Authentication required - configure OPENAI_API_KEY in config.env');
    }
    
  } catch (error) {
    console.error('❌ OpenAI proxy test failed:', error.message);
  }
}

async function testAnthropicProxy() {
  console.log('\n🧪 Testing Anthropic proxy...');
  
  const anthropicData = {
    model: 'claude-3-sonnet-20240229',
    max_tokens: 50,
    messages: [
      {
        role: 'user',
        content: 'Hello! My email is test@example.com and my server IP is 192.168.1.100'
      }
    ]
  };
  
  console.log('📤 Original data:', JSON.stringify(anthropicData, null, 2));
  
  try {
    const response = await axios.post(
      `${PROXY_BASE_URL}/anthropic/v1/messages`,
      anthropicData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key' // This will be replaced by the proxy
        },
        timeout: 10000,
        validateStatus: () => true // Accept all status codes for testing
      }
    );
    
    console.log('✅ Anthropic proxy response status:', response.status);
    console.log('📥 Response headers:', response.headers);
    
    if (response.status === 401) {
      console.log('🔑 Authentication required - configure ANTHROPIC_API_KEY in config.env');
    }
    
  } catch (error) {
    console.error('❌ Anthropic proxy test failed:', error.message);
  }
}

async function testHealthCheck() {
  console.log('\n🧪 Testing proxy health...');
  
  try {
    // Test if the server is running
    const response = await axios.get(`${PROXY_BASE_URL}/health`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      console.log('✅ Proxy server is running');
      console.log('📋 Server info:', response.data);
    } else {
      console.error('❌ Proxy server returned unexpected status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Proxy server is not running. Start it with: npm run start:dev');
    console.error('   Error:', error.message);
    return false;
  }
  
  return true;
}

async function runTests() {
  console.log('🚀 Starting Lasso Proxy Tests\n');
  
  const isHealthy = await testHealthCheck();
  
  if (isHealthy) {
    await testOpenAIProxy();
    await testAnthropicProxy();
    
    console.log('\n📋 Test Summary:');
    console.log('- Proxy server is running ✅');
    console.log('- Configure API keys in config.env for full functionality');
    console.log('- Check server logs to see sanitization in action');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testOpenAIProxy, testAnthropicProxy, testHealthCheck };
