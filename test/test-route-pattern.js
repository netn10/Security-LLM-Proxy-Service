const axios = require('axios');
const { getDefaultModel } = require('./utils/model-config');


/**
 * Test the core route patterns that our proxy uses
 * Focuses on OpenAI and Anthropic endpoints that support sanitization and policy enforcement
 */

const LASSO_PROXY_URL = 'http://localhost:3000';

async function testRoutePatterns() {
  console.log('🧪 Testing Core Route Patterns\n');

  const testPaths = [
    '/openai/v1/chat/completions',  // OpenAI chat completions - supports sanitization & policy
    '/anthropic/v1/messages'        // Anthropic messages - supports sanitization & policy
  ];

  for (const path of testPaths) {
    console.log(`📝 Testing path: ${path}`);
    
    try {
      const response = await axios.post(
        `${LASSO_PROXY_URL}${path}`,
        {
          model: path.includes('openai') ? getDefaultModel('openai') : getDefaultModel('anthropic'),
          messages: [
            {
              role: "user",
              content: "Hello"
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': path.includes('openai') ? 'Bearer test-key' : undefined,
            'x-api-key': path.includes('anthropic') ? 'test-key' : undefined
          }
        }
      );

      console.log(`   ✅ SUCCESS - Status: ${response.status}`);
    } catch (error) {
      console.log(`   📊 Result - Status: ${error.response?.status || 'No response'}`);
      if (error.response?.status === 404) {
        console.log(`   📍 404 - Route not found`);
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        console.log(`   🔐 Auth failed (expected) - Route is working`);
      } else {
        console.log(`   📊 Other result: ${error.message}`);
      }
    }
  }

  // Test with GET request to see if the route is registered
  console.log('\n📝 Testing GET request to see if route is registered...');
  try {
    const response = await axios.get(`${LASSO_PROXY_URL}/openai/v1/chat/completions`);
    console.log('✅ GET request worked');
  } catch (error) {
    console.log('📊 GET request result:', error.response?.status || error.message);
  }

  // Check what routes are actually registered
  console.log('\n📝 Checking registered routes...');
  try {
    const healthResponse = await axios.get(`${LASSO_PROXY_URL}/health`);
    console.log('📋 Registered endpoints:', healthResponse.data.endpoints);
  } catch (error) {
    console.log('📊 Could not check health endpoint:', error.message);
  }
}

// Run the test
testRoutePatterns().catch(console.error);
