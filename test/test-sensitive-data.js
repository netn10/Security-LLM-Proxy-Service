const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testSensitiveDataDetection() {
  console.log('🧪 Testing sensitive data detection and 403 responses...\n');

  const testCases = [
    {
      name: 'Email detection',
      payload: {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Please help me with my email: john.doe@example.com'
          }
        ]
      }
    },
    {
      name: 'IBAN detection',
      payload: {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'My bank account is DE89370400440532013000'
          }
        ]
      }
    },
    {
      name: 'IP address detection',
      payload: {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'The server IP is 192.168.1.100'
          }
        ]
      }
    },
    {
      name: 'Multiple sensitive data types',
      payload: {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Contact me at user@domain.com and my IBAN is GB82WEST12345698765432'
          }
        ]
      }
    },
    {
      name: 'Clean content (should pass)',
      payload: {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you today?'
          }
        ]
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📝 Testing: ${testCase.name}`);
    
    try {
              const response = await axios.post(
          `${BASE_URL}/openai/v1/chat/completions`,
          testCase.payload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-key'
            }
          }
        );
      
      console.log(`✅ PASS: ${testCase.name} - Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data, null, 2)}\n`);
    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;
        
        if (status === 403) {
          console.log(`✅ PASS: ${testCase.name} - Correctly blocked with 403`);
          console.log(`   Error Code: ${data.error?.code}`);
          console.log(`   Message: ${data.error?.message}`);
          if (data.error?.details?.detected_types) {
            console.log(`   Detected Types: ${data.error.details.detected_types.join(', ')}`);
          }
        } else {
          console.log(`❌ FAIL: ${testCase.name} - Unexpected status ${status}`);
          console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
        }
      } else {
        console.log(`❌ FAIL: ${testCase.name} - Network error: ${error.message}`);
      }
      console.log('');
    }
  }
}

async function runTests() {
  try {
    await testSensitiveDataDetection();
    console.log('🎉 All tests completed!');
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { testSensitiveDataDetection };
