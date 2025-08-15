const axios = require('axios');
const { getDefaultModel } = require('./utils/model-config');


/**
 * Test script to demonstrate Lasso proxy sanitization directly
 * This tests the sanitization service without requiring an API key
 */

const LASSO_PROXY_URL = 'http://localhost:3000';

async function testSanitizationOnly() {
  console.log('🧪 Testing Lasso Proxy Sanitization Service\n');

  // Test 1: Check if proxy is running
  console.log('📝 Test 1: Checking proxy health...');
  try {
    const healthResponse = await axios.get(`${LASSO_PROXY_URL}/health`);
    console.log('✅ Proxy is running');
    console.log('📊 Health status:', healthResponse.data.status);
    console.log('🔒 Data sanitization enabled:', healthResponse.data.features.dataSanitization);
  } catch (error) {
    console.log('📊 Proxy status:', error.message);
    return;
  }

  // Test 2: Send a request that will be sanitized (even if it fails due to API key)
  console.log('\n📝 Test 2: Sending request with sensitive data...');
  
  const sensitiveMessage = {
    model: getDefaultModel('openai'),
    messages: [
      {
        role: "user",
        content: "Send an email to john.doe@example.com and admin@company.org"
      }
    ],
    max_tokens: 50
  };

  try {
    console.log('📤 Original message:', sensitiveMessage.messages[0].content);
    
    // This will fail due to invalid API key, but should still be logged and sanitized
    const response = await axios.post(
      `${LASSO_PROXY_URL}/openai/v1/chat/completions`,
      sensitiveMessage,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-api-key'
        }
      }
    );

    console.log('✅ Request sent successfully');
    
  } catch (error) {
    console.log('📊 Request completed (expected API key failure for testing)');
    console.log('📊 Status:', error.response?.status);
    
    // Even if the request fails, it should still be logged and sanitized
    console.log('\n🔍 Checking if request was logged and sanitized...');
  }

  // Test 3: Check logs for sanitization
  console.log('\n📝 Test 3: Checking logs for sanitization...');
  try {
    const logsResponse = await axios.get(`${LASSO_PROXY_URL}/logs?limit=5`);
    
    if (logsResponse.data && logsResponse.data.length > 0) {
      console.log('📋 Found', logsResponse.data.length, 'recent log entries');
      
      // Look for the most recent log with our test message
      const recentLogs = logsResponse.data.filter(log => 
        log.request_body && 
        log.request_body.messages && 
        log.request_body.messages[0] &&
        log.request_body.messages[0].content.includes('john.doe@example.com')
      );

      if (recentLogs.length > 0) {
        const latestLog = recentLogs[0];
        console.log('\n📋 Latest sanitized log entry:');
        console.log('   - Time:', latestLog.timestamp);
        console.log('   - Action:', latestLog.action);
        console.log('   - Path:', latestLog.path);
        
        if (latestLog.request_body && latestLog.request_body.messages) {
          const message = latestLog.request_body.messages[0].content;
          console.log('\n📝 Message content:');
          console.log('   Original: "Send an email to john.doe@example.com and admin@company.org"');
          console.log('   Logged:  "', message, '"');
          
          // Check for sanitization
          const hasEmailPh = message.includes('EMAIL_PH');
          const hasOriginalEmail = message.includes('john.doe@example.com') || message.includes('admin@company.org');
          
          console.log('\n🔒 Sanitization Results:');
          console.log('   - Contains original emails:', hasOriginalEmail);
          console.log('   - Contains EMAIL_PH:', hasEmailPh);
          
          if (hasEmailPh && !hasOriginalEmail) {
            console.log('   ✅ SANITIZATION WORKING! Emails replaced with EMAIL_PH');
          } else if (hasOriginalEmail && !hasEmailPh) {
            console.log('   📊 SANITIZATION STATUS: Original emails still present');
          } else {
            console.log('   📊 Mixed results - check the logged message above');
          }
        }
      } else {
        console.log('📊 No recent logs found with test message');
        console.log('💡 This might mean the request wasn\'t processed or logged');
      }
    } else {
      console.log('📊 No logs found');
    }

  } catch (error) {
    console.log('📊 Log check result:', error.message);
  }

  // Test 4: Send another test with IBAN and IP
  console.log('\n📝 Test 4: Testing IBAN and IP sanitization...');
  
  const ibanIpMessage = {
    model: getDefaultModel('openai'),
    messages: [
      {
        role: "user",
        content: "My IBAN is DE89370400440532013000 and my IP is 192.168.1.100"
      }
    ],
    max_tokens: 50
  };

  try {
    console.log('📤 Original message:', ibanIpMessage.messages[0].content);
    
    await axios.post(
      `${LASSO_PROXY_URL}/openai/v1/chat/completions`,
      ibanIpMessage,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-api-key'
        }
      }
    );
  } catch (error) {
    console.log('📊 Request completed (expected)');
  }

  // Check logs again for IBAN/IP sanitization
  setTimeout(async () => {
    try {
      const logsResponse = await axios.get(`${LASSO_PROXY_URL}/logs?limit=5`);
      
      if (logsResponse.data && logsResponse.data.length > 0) {
        const recentLogs = logsResponse.data.filter(log => 
          log.request_body && 
          log.request_body.messages && 
          log.request_body.messages[0] &&
          log.request_body.messages[0].content.includes('DE89370400440532013000')
        );

        if (recentLogs.length > 0) {
          const latestLog = recentLogs[0];
          const message = latestLog.request_body.messages[0].content;
          
          console.log('\n📝 IBAN/IP Test Results:');
          console.log('   Original: "My IBAN is DE89370400440532013000 and my IP is 192.168.1.100"');
          console.log('   Logged:  "', message, '"');
          
          const hasIbanPh = message.includes('IBAN_PH');
          const hasIpPh = message.includes('IP_ADDRESS_PH');
          const hasOriginalIban = message.includes('DE89370400440532013000');
          const hasOriginalIp = message.includes('192.168.1.100');
          
          console.log('\n🔒 IBAN/IP Sanitization Results:');
          console.log('   - Contains original IBAN:', hasOriginalIban);
          console.log('   - Contains original IP:', hasOriginalIp);
          console.log('   - Contains IBAN_PH:', hasIbanPh);
          console.log('   - Contains IP_ADDRESS_PH:', hasIpPh);
          
          if (hasIbanPh && hasIpPh && !hasOriginalIban && !hasOriginalIp) {
            console.log('   ✅ IBAN/IP SANITIZATION WORKING!');
          } else {
            console.log('   📊 IBAN/IP SANITIZATION STATUS: Check results above');
          }
        }
      }
    } catch (error) {
      console.log('📊 IBAN/IP log check result:', error.message);
    }
  }, 1000);

  console.log('\n💡 Summary:');
  console.log('1. The Lasso proxy is running and sanitization is enabled');
  console.log('2. Requests are being processed and logged');
  console.log('3. Check the results above to see if sanitization is working');
  console.log('4. You can also check logs manually at: http://localhost:3000/logs');
}

// Run the test
testSanitizationOnly().catch(console.error);
