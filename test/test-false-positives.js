const axios = require('axios');
require('dotenv').config({ path: '.env' });
const { getDefaultModel } = require('./utils/model-config');

const BASE_URL = 'http://localhost:3000';

// Test cases that should NOT be blocked (non-financial content)
const NON_FINANCIAL_TEST_CASES = [
  {
    name: 'General conversation',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'Hello, how are you today? I need help with my homework.',
        },
      ],
    },
  },
  {
    name: 'Business discussion without transactions',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'I need help writing a business plan for my startup. What should I include?',
        },
      ],
    },
  },
  {
    name: 'General economic discussion',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'Can you explain how inflation affects the economy?',
        },
      ],
    },
  },
  {
    name: 'Price discussion without financial services',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'What is the price of a new iPhone? I want to buy one.',
        },
      ],
    },
  },
  {
    name: 'Short content (should be allowed)',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'Hi',
        },
      ],
    },
  },
];

// Test cases that SHOULD be blocked (financial content)
const FINANCIAL_TEST_CASES = [
  {
    name: 'Bank account help request',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'help me with my bank account',
        },
      ],
    },
  },
  {
    name: 'Investment advice',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'I want to invest $10,000 in stocks. What should I buy?',
        },
      ],
    },
  },
  {
    name: 'Loan application',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'I need help filling out a mortgage application form.',
        },
      ],
    },
  },
];

// Check if server is running
async function checkServerStatus() {
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    console.log('✅ Server is running and healthy');
    console.log(`   Service: ${response.data.service}`);
    console.log(`   Endpoints: ${JSON.stringify(response.data.endpoints)}`);
    console.log(`   Features: ${JSON.stringify(response.data.features)}`);
    return true;
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log(`   Error: ${error.message}`);
    console.log('   Please start the server with: npm run start:dev');
    return false;
  }
}

async function testFalsePositives() {
  console.log('🧪 Testing Financial Content Detection for False Positives\n');
  
  // Check environment configuration
  console.log('📋 Environment Configuration:');
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   ENABLE_POLICY_ENFORCEMENT: ${process.env.ENABLE_POLICY_ENFORCEMENT || 'true (default)'}`);
  console.log(`   FINANCIAL_DETECTION_STRICT: ${process.env.FINANCIAL_DETECTION_STRICT || 'true (default)'}`);
  console.log('');

  let nonFinancialBlocked = 0;
  let financialAllowed = 0;
  let totalTests = 0;
  let apiErrors = 0;

  // Test non-financial content (should NOT be blocked)
  console.log('📋 Testing Non-Financial Content (should NOT be blocked):');
  console.log('=' .repeat(60));
  
  for (const testCase of NON_FINANCIAL_TEST_CASES) {
    try {
      const response = await axios.post(
        `${BASE_URL}/openai/v1/chat/completions`,
        testCase.data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer fake-key',
          },
          validateStatus: () => true,
        }
      );

      const wasBlocked = response.status === 403 && 
        response.data?.error?.code === 'FINANCIAL_BLOCKED';
      
      const status = wasBlocked ? '✅ BLOCKED (FALSE POSITIVE)' : '✅ ALLOWED';
      
      console.log(`${status} ${testCase.name}`);
      
      // If 403, post full message
      if (response.status === 403) {
        console.log(`   Full 403 Error: ${JSON.stringify(response.data, null, 2)}`);
      }
      
      if (wasBlocked) {
        nonFinancialBlocked++;
      }
      
      totalTests++;
      
    } catch (error) {
      console.log(`❌ ERROR ${testCase.name}: ${error.message}`);
    }
  }

  console.log('\n📋 Testing Financial Content (should be blocked):');
  console.log('=' .repeat(60));
  
  for (const testCase of FINANCIAL_TEST_CASES) {
    try {
      const response = await axios.post(
        `${BASE_URL}/openai/v1/chat/completions`,
        testCase.data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer fake-key',
          },
          validateStatus: () => true,
        }
      );

             // Check if the response indicates financial content was blocked
       const wasBlocked = response.status === 403 && 
         response.data?.error?.code === 'FINANCIAL_BLOCKED';
      
       // Check if there was an API error that prevented financial detection
       const hasApiError = response.data?.error?.code === 'invalid_api_key' || 
                          response.data?.error?.message?.includes('Incorrect API key');
      
               let status;
        if (hasApiError) {
          status = '⚠️  SKIPPED (API Key Error)';
          console.log(`   API Error: ${response.data.error.message}`);
          apiErrors++;
        } else if (wasBlocked) {
          status = '✅ BLOCKED';
        } else {
          status = '❌ ALLOWED (FALSE NEGATIVE)';
          financialAllowed++;
        }
      
       console.log(`${status} ${testCase.name}`);
      
      // If 403, post full message
      if (response.status === 403) {
        console.log(`   Full 403 Error: ${JSON.stringify(response.data, null, 2)}`);
      }
      
      totalTests++;
      
    } catch (error) {
      console.log(`❌ ERROR ${testCase.name}: ${error.message}`);
    }
  }

  console.log('\n📊 False Positive Test Results:');
  console.log('=' .repeat(60));
  console.log(`Total tests: ${totalTests}`);
  console.log(`Non-financial content blocked (false positives): ${nonFinancialBlocked}`);
  console.log(`Financial content allowed (false negatives): ${financialAllowed}`);
  
  // Check if there are API key issues
  const hasApiKeyIssues = process.env.OPENAI_API_KEY && 
    (process.env.OPENAI_API_KEY.includes('your_') || 
     process.env.OPENAI_API_KEY.includes('fake') ||
     process.env.OPENAI_API_KEY.includes('placeholder'));
  
  // Check if we had API errors during testing
  const hadApiErrors = apiErrors > 0;
  
  if (hasApiKeyIssues || hadApiErrors) {
    console.log('\n⚠️  CONFIGURATION ISSUE:');
    console.log('   The OPENAI_API_KEY appears to be invalid or causing API errors.');
    console.log('   Please set a valid OpenAI API key in your .env file to test financial content detection.');
    console.log('   Get your API key from: https://platform.openai.com/account/api-keys');
    console.log('   Current API key format: ' + (process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : 'Not set'));
  } else if (nonFinancialBlocked === 0 && financialAllowed === 0) {
    console.log('🎉 Perfect! No false positives or false negatives detected!');
  } else if (nonFinancialBlocked === 0) {
    console.log('✅ Good! No false positives, but some false negatives.');
  } else if (financialAllowed === 0) {
    console.log('⚠️  Some false positives detected, but no false negatives.');
  } else {
    console.log('❌ Both false positives and false negatives detected.');
  }
}

async function testRateLimiting() {
  console.log('\n🧪 Testing Rate Limiting...\n');

  try {
    // Test 1: Make multiple rapid requests to trigger rate limiting
    console.log('📊 Test 1: Making rapid requests to trigger rate limiting...');
    
    const requests = [];
    const numRequests = 50; // This should trigger rate limiting
    
    for (let i = 0; i < numRequests; i++) {
      requests.push(
        axios.post(`${BASE_URL}/openai/v1/chat/completions`, {
          model: getDefaultModel('openai'),
          messages: [{ role: 'user', content: `Rate limit test message ${i}` }]
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
          validateStatus: () => true
        }).catch(error => ({
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        }))
      );
    }

    const results = await Promise.all(requests);
    
    let successCount = 0;
    let rateLimitedCount = 0;
    let otherErrors = 0;

    results.forEach((result, index) => {
      if (result.status === 429) {
        rateLimitedCount++;
        console.log(`   Request ${index + 1}: Rate limited (429)`);
      } else if (result.status === 200) {
        successCount++;
        console.log(`   Request ${index + 1}: Success`);
      } else {
        otherErrors++;
        console.log(`   Request ${index + 1}: Error ${result.status} - ${result.message}`);
      }
    });

    console.log(`\n📈 Rate Limiting Results:`);
    console.log(`   Successful requests: ${successCount}`);
    console.log(`   Rate limited requests: ${rateLimitedCount}`);
    console.log(`   Other errors: ${otherErrors}`);

    // Test 2: Check rate limit status via dashboard API
    console.log('\n📊 Test 2: Checking rate limit status...');
    
    try {
      const rateLimitStats = await axios.get(`${BASE_URL}/dashboard/rate-limits`);
      console.log('   Rate limit stats:', JSON.stringify(rateLimitStats.data, null, 2));
    } catch (error) {
      console.log('   Error getting rate limit stats:', error.message);
    }

    // Test 3: Wait and test token refill
    console.log('\n📊 Test 3: Waiting for token refill...');
    console.log('   Waiting 5 seconds for tokens to refill...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('   Making a few more requests after refill...');
    
    const refillResults = [];
    for (let i = 0; i < 5; i++) {
      try {
        const response = await axios.post(`${BASE_URL}/openai/v1/chat/completions`, {
          model: getDefaultModel('openai'),
          messages: [{ role: 'user', content: `Refill test ${i}` }]
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
          validateStatus: () => true
        });
        refillResults.push({ status: response.status, success: true });
      } catch (error) {
        refillResults.push({ 
          status: error.response?.status, 
          success: false, 
          message: error.message 
        });
      }
    }

    const refillSuccess = refillResults.filter(r => r.success).length;
    const refillRateLimited = refillResults.filter(r => r.status === 429).length;
    
    console.log(`   After refill: ${refillSuccess} successful, ${refillRateLimited} rate limited`);

    // Test 4: Test different endpoints with different token costs
    console.log('\n📊 Test 4: Testing different endpoints...');
    
    const endpoints = [
      { path: '/openai/v1/chat/completions', method: 'POST', tokens: 10 },
      { path: '/anthropic/v1/messages', method: 'POST', tokens: 10 }
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`   Testing ${endpoint.method} ${endpoint.path} (cost: ${endpoint.tokens} tokens)`);
        
        let requestData;
        if (endpoint.method === 'POST') {
          if (endpoint.path.includes('/openai/')) {
            requestData = {
              model: getDefaultModel('openai'),
              messages: [{ role: 'user', content: 'Test message' }]
            };
          } else if (endpoint.path.includes('/anthropic/')) {
            requestData = {
              model: getDefaultModel('anthropic'),
              max_tokens: 1000,
              messages: [{ role: 'user', content: 'Test message' }]
            };
          }
        }
        
        const response = await axios({
          method: endpoint.method,
          url: `${BASE_URL}${endpoint.path}`,
          data: requestData,
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
          validateStatus: () => true
        });
        
        if (response.status === 429) {
          console.log(`     ⚠️  Rate limited (429)`);
        } else if (response.status === 200) {
          console.log(`     ✅ Success (${response.status})`);
        } else {
          console.log(`     ❌ Error: ${response.status}`);
          if (response.status === 403) {
            console.log(`      Full 403 Error: ${JSON.stringify(response.data, null, 2)}`);
          }
        }
      } catch (error) {
        console.log(`     ❌ Error: ${error.response?.status} - ${error.message}`);
      }
    }

    // Test 5: Check analytics
    console.log('\n📊 Test 5: Checking analytics...');
    
    try {
      const analytics = await axios.get(`${BASE_URL}/dashboard/analytics`);
      console.log('   Analytics data received');
      
      if (analytics.data.rateLimitAnalytics) {
        console.log('   Rate limiting analytics:', JSON.stringify(analytics.data.rateLimitAnalytics, null, 2));
      }
    } catch (error) {
      console.log('   Error getting analytics:', error.message);
    }

    console.log('\n✅ Rate limiting tests completed!');

  } catch (error) {
    console.error('❌ Rate limiting test failed:', error.message);
  }
}

// Run both tests
async function runAllTests() {
  // First check if server is running
  const serverRunning = await checkServerStatus();
  if (!serverRunning) {
    console.log('\n❌ Cannot run tests - server is not running');
    console.log('   Please start the server with: npm run start:dev');
    return;
  }

  console.log('\n' + '='.repeat(60));
  await testFalsePositives();
  console.log('\n' + '='.repeat(60));
  await testRateLimiting();
}

// Run all tests
runAllTests().catch(console.error);
