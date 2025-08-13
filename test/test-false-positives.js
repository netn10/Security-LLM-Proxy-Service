const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test cases that should NOT be blocked (non-financial content)
const NON_FINANCIAL_TEST_CASES = [
  {
    name: 'General conversation',
    data: {
      model: 'gpt-3.5-turbo',
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
      model: 'gpt-3.5-turbo',
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
      model: 'gpt-3.5-turbo',
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
      model: 'gpt-3.5-turbo',
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
      model: 'gpt-3.5-turbo',
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
    name: 'Investment advice',
    data: {
      model: 'gpt-3.5-turbo',
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
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'I need help filling out a mortgage application form.',
        },
      ],
    },
  },
];

async function testFalsePositives() {
  console.log('🧪 Testing Financial Content Detection for False Positives\n');

  let nonFinancialBlocked = 0;
  let financialAllowed = 0;
  let totalTests = 0;

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
      
      const status = wasBlocked ? '❌ BLOCKED (FALSE POSITIVE)' : '✅ ALLOWED';
      
      console.log(`${status} ${testCase.name}`);
      
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

      const wasBlocked = response.status === 403 && 
        response.data?.error?.code === 'FINANCIAL_BLOCKED';
      
      const status = wasBlocked ? '✅ BLOCKED' : '❌ ALLOWED (FALSE NEGATIVE)';
      
      console.log(`${status} ${testCase.name}`);
      
      if (!wasBlocked) {
        financialAllowed++;
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
  
  if (nonFinancialBlocked === 0 && financialAllowed === 0) {
    console.log('🎉 Perfect! No false positives or false negatives detected!');
  } else if (nonFinancialBlocked === 0) {
    console.log('✅ Good! No false positives, but some false negatives.');
  } else if (financialAllowed === 0) {
    console.log('⚠️  Some false positives detected, but no false negatives.');
  } else {
    console.log('❌ Both false positives and false negatives detected.');
  }
}

// Run the test
testFalsePositives().catch(console.error);
