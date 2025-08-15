const axios = require('axios');
require('dotenv').config({ path: '.env' });
const { getDefaultModel } = require('./utils/model-config');

const BASE_URL = 'http://localhost:3000';

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
    name: 'Banking assistance request',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'I need help with my banking',
        },
      ],
    },
  },
  {
    name: 'Account management request',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'Can you help me manage my account?',
        },
      ],
    },
  },
  {
    name: 'Financial advice request',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'I need financial advice',
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
  {
    name: 'Credit card help',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'I need help with my credit card',
        },
      ],
    },
  },
  {
    name: 'Money management',
    data: {
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'user',
          content: 'Help me manage my money',
        },
      ],
    },
  },
];

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
];

async function checkServerStatus() {
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    console.log('✅ Server is running and healthy');
    return true;
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log(`   Error: ${error.message}`);
    console.log('   Please start the server with: npm run start:dev');
    return false;
  }
}

async function testFinancialDetection() {
  console.log('🔒 Testing Tightened Financial Content Detection\n');
  
  // Check environment configuration
  console.log('📋 Environment Configuration:');
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   ENABLE_POLICY_ENFORCEMENT: ${process.env.ENABLE_POLICY_ENFORCEMENT || 'true (default)'}`);
  console.log(`   FINANCIAL_DETECTION_STRICT: ${process.env.FINANCIAL_DETECTION_STRICT || 'true (default)'}`);
  console.log('');

  let financialBlocked = 0;
  let financialAllowed = 0;
  let nonFinancialBlocked = 0;
  let totalTests = 0;

  // Test financial content (should be blocked)
  console.log('📋 Testing Financial Content (should be BLOCKED):');
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

      const wasBlocked = response.status === 403 && 
        response.data?.error?.code === 'FINANCIAL_BLOCKED';
      
      const status = wasBlocked ? '✅ BLOCKED' : '❌ ALLOWED (FALSE NEGATIVE)';
      
      console.log(`${status} ${testCase.name}`);
      console.log(`   Content: "${testCase.data.messages[0].content}"`);
      
      if (wasBlocked) {
        financialBlocked++;
      } else {
        financialAllowed++;
      }
      
      totalTests++;
      
    } catch (error) {
      console.log(`❌ ERROR ${testCase.name}: ${error.message}`);
    }
  }

  console.log('\n📋 Testing Non-Financial Content (should NOT be blocked):');
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
      
      const status = wasBlocked ? '❌ BLOCKED (FALSE POSITIVE)' : '✅ ALLOWED';
      
      console.log(`${status} ${testCase.name}`);
      console.log(`   Content: "${testCase.data.messages[0].content}"`);
      
      if (wasBlocked) {
        nonFinancialBlocked++;
      }
      
      totalTests++;
      
    } catch (error) {
      console.log(`❌ ERROR ${testCase.name}: ${error.message}`);
    }
  }

  console.log('\n📊 Financial Detection Test Results:');
  console.log('=' .repeat(60));
  console.log(`Total tests: ${totalTests}`);
  console.log(`Financial content blocked: ${financialBlocked}/${FINANCIAL_TEST_CASES.length}`);
  console.log(`Financial content allowed (false negatives): ${financialAllowed}`);
  console.log(`Non-financial content blocked (false positives): ${nonFinancialBlocked}`);
  
  const successRate = (financialBlocked / FINANCIAL_TEST_CASES.length) * 100;
  console.log(`\n🎯 Success Rate: ${successRate.toFixed(1)}%`);
  
  if (financialAllowed > 0) {
    console.log('\n⚠️  WARNING: Some financial content was not blocked!');
    console.log('   This indicates the detection needs to be tightened further.');
  }
  
  if (nonFinancialBlocked > 0) {
    console.log('\n⚠️  WARNING: Some non-financial content was blocked!');
    console.log('   This indicates the detection might be too strict.');
  }
  
  if (financialAllowed === 0 && nonFinancialBlocked === 0) {
    console.log('\n🎉 PERFECT: All tests passed! Financial detection is working correctly.');
  }
}

async function main() {
  console.log('🚀 Starting Financial Content Detection Tests\n');
  
  const serverRunning = await checkServerStatus();
  if (!serverRunning) {
    process.exit(1);
  }
  
  await testFinancialDetection();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testFinancialDetection };
