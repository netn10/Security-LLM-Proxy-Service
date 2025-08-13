/**
 * Demonstration script showing data sanitization in action
 * This shows how the proxy would sanitize data before sending to LLM providers
 */

const axios = require('axios');

const PROXY_BASE_URL = 'http://localhost:3000';

async function demonstrateSanitization() {
  console.log('🎭 Lasso Proxy Data Sanitization Demo\n');
  
  // Test data with various sensitive information
  const testData = {
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant.'
      },
      {
        role: 'user',
        content: `
          Hello! I need help with the following:
          
          1. Send an email to john.doe@example.com and admin@company.org
          2. Check the servers at 192.168.1.100, 10.0.0.1, and 255.255.255.0
          3. Process payment to IBAN GB82WEST12345698765432
          4. Also handle FR1420041010050500013M02606 and DE89370400440532013000
          5. Contact support@help.com if there are issues
          
          The main server IP is 172.16.0.1 and backup is at 203.0.113.1
        `
      }
    ],
    max_tokens: 100,
    temperature: 0.7
  };

  console.log('📤 Original Request Data:');
  console.log('─'.repeat(80));
  console.log(JSON.stringify(testData, null, 2));
  console.log('─'.repeat(80));

  // Count sensitive data in original
  const originalText = JSON.stringify(testData);
  const emailCount = (originalText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []).length;
  const ipCount = (originalText.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g) || []).length;
  const ibanCount = (originalText.match(/\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/g) || []).length;

  console.log('\n🔍 Detected Sensitive Data in Original:');
  console.log(`   📧 Email addresses: ${emailCount}`);
  console.log(`   🌐 IP addresses: ${ipCount}`);
  console.log(`   🏦 IBAN numbers: ${ibanCount}`);
  console.log(`   📊 Total sensitive items: ${emailCount + ipCount + ibanCount}`);

  console.log('\n🔄 Sending request through Lasso Proxy...');
  console.log('   (This will timeout due to missing API keys, but shows sanitization)');

  try {
    // This will timeout, but the server logs will show the sanitized data
    await axios.post(
      `${PROXY_BASE_URL}/openai/v1/chat/completions`,
      testData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer demo-key'
        },
        timeout: 3000 // Short timeout since we expect it to fail
      }
    );
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('⏱️  Request timed out as expected (no valid API key)');
    } else {
      console.log('❌ Request failed:', error.message);
    }
  }

  console.log('\n📋 What the proxy does:');
  console.log('   1. ✅ Receives your request with sensitive data');
  console.log('   2. 🔍 Detects email addresses, IP addresses, and IBANs');
  console.log('   3. 🔒 Replaces them with placeholders (EMAIL_PH, IP_ADDRESS_PH, IBAN_PH)');
  console.log('   4. 📤 Forwards sanitized request to OpenAI/Anthropic');
  console.log('   5. 📥 Returns the response to you');

  console.log('\n🎯 Example of sanitized content that would be sent:');
  console.log('─'.repeat(80));
  
  // Simulate the sanitization
  let sanitizedContent = testData.messages[1].content;
  sanitizedContent = sanitizedContent.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'EMAIL_PH');
  sanitizedContent = sanitizedContent.replace(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, 'IP_ADDRESS_PH');
  sanitizedContent = sanitizedContent.replace(/\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/g, 'IBAN_PH');
  
  console.log(sanitizedContent);
  console.log('─'.repeat(80));

  console.log('\n✨ Your sensitive data is protected while still getting AI assistance!');
}

// Check if server is running first
async function checkServer() {
  try {
    const response = await axios.get(`${PROXY_BASE_URL}/health`, { timeout: 2000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function runDemo() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Lasso Proxy server is not running.');
    console.log('   Start it with: npm run start:dev');
    console.log('   Or use: node start.js');
    return;
  }

  await demonstrateSanitization();
}

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { demonstrateSanitization };
