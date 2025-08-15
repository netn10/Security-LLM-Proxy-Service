/**
 * Test script for LLM-based data sanitization functionality
 * Run with: node test/test-llm-sanitization.js
 */

const axios = require('axios');

// Mock LLM-based DataSanitizationService for testing
class LLMDataSanitizationService {
  constructor() {
    this.placeholders = {
      email: 'EMAIL_PH',
      ipv4: 'IP_ADDRESS_PH',
      iban: 'IBAN_PH',
    };
  }

  async sanitizeData(data) {
    if (!data) return data;
    const sanitizedData = JSON.parse(JSON.stringify(data));
    return await this.sanitizeRecursive(sanitizedData);
  }

  async sanitizeRecursive(obj) {
    if (typeof obj === 'string') {
      return await this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      const sanitizedArray = [];
      for (const item of obj) {
        sanitizedArray.push(await this.sanitizeRecursive(item));
      }
      return sanitizedArray;
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = await this.sanitizeRecursive(value);
      }
      return sanitized;
    }

    return obj;
  }

  async sanitizeString(text) {
    if (!text || text.length === 0) {
      return text;
    }

    try {
      // Simulate LLM detection (in real implementation, this would call OpenAI API)
      const detectedData = await this.detectSensitiveData(text);
      
      let sanitized = text;

      // Replace detected sensitive data with placeholders
      for (const [type, matches] of Object.entries(detectedData)) {
        const placeholder = this.placeholders[type];
        
        // Replace each detected item with placeholder
        for (const match of matches) {
          sanitized = sanitized.replace(match, placeholder);
        }
      }

      return sanitized;
    } catch (error) {
      console.error('❌ LLM-based sanitization failed:', error.message);
      return text;
    }
  }

  async detectSensitiveData(text) {
    // For testing purposes, we'll simulate LLM detection with regex patterns
    // In production, this would be an actual LLM API call
    
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const ipv4Pattern = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    const ibanPattern = /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/g;

    // Simulate async LLM processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      email: text.match(emailPattern) || [],
      ipv4: text.match(ipv4Pattern) || [],
      iban: text.match(ibanPattern) || [],
    };
  }

  getSanitizationStats(originalData, sanitizedData) {
    const sanitizedText = JSON.stringify(sanitizedData);

    // Count placeholders in sanitized text
    const emailsFound = (sanitizedText.match(/EMAIL_PH/g) || []).length;
    const ipAddressesFound = (sanitizedText.match(/IP_ADDRESS_PH/g) || []).length;
    const ibansFound = (sanitizedText.match(/IBAN_PH/g) || []).length;

    return {
      emailsFound,
      ipAddressesFound,
      ibansFound,
      totalSanitized: emailsFound + ipAddressesFound + ibansFound,
    };
  }
}

async function runLLMSanitizationTests() {
  console.log('🧪 Testing LLM-Based Data Sanitization Service\n');
  
  const sanitizer = new LLMDataSanitizationService();
  
  // Test cases
  const testCases = [
    {
      name: 'Email sanitization',
      input: {
        messages: [
          {
            role: 'user',
            content: 'Please send an email to john.doe@example.com and also to admin@test.org'
          }
        ]
      },
      expected: 'EMAIL_PH'
    },
    {
      name: 'IP address sanitization',
      input: {
        messages: [
          {
            role: 'user',
            content: 'The server at 192.168.1.1 is down, also check 10.0.0.1 and 255.255.255.0'
          }
        ]
      },
      expected: 'IP_ADDRESS_PH'
    },
    {
      name: 'IBAN sanitization',
      input: {
        messages: [
          {
            role: 'user',
            content: 'Transfer to IBAN GB82WEST12345698765432 and also to DE89370400440532013000'
          }
        ]
      },
      expected: 'IBAN_PH'
    },
    {
      name: 'Mixed sensitive data',
      input: {
        messages: [
          {
            role: 'user',
            content: 'Contact user@domain.com at server 192.168.0.100 for IBAN FR1420041010050500013M02606'
          }
        ]
      },
      expected: ['EMAIL_PH', 'IP_ADDRESS_PH', 'IBAN_PH']
    },
    {
      name: 'No sensitive data',
      input: {
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you today?'
          }
        ]
      },
      expected: null
    }
  ];

  let passedTests = 0;
  const totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`📝 Test: ${testCase.name}`);
    console.log(`📤 Input:`, JSON.stringify(testCase.input, null, 2));
    
    try {
      const result = await sanitizer.sanitizeData(testCase.input);
      console.log(`📥 Output:`, JSON.stringify(result, null, 2));
      
      const stats = sanitizer.getSanitizationStats(testCase.input, result);
      console.log(`📊 Stats:`, JSON.stringify(stats, null, 2));
      
      // Check if test passed
      let testPassed = false;
      const resultStr = JSON.stringify(result);
      
      if (Array.isArray(testCase.expected)) {
        // Multiple expected placeholders
        testPassed = testCase.expected.every(expected => resultStr.includes(expected));
      } else if (testCase.expected === null) {
        // No sensitive data expected
        testPassed = !resultStr.includes('EMAIL_PH') && !resultStr.includes('IP_ADDRESS_PH') && !resultStr.includes('IBAN_PH');
      } else {
        // Single expected placeholder
        testPassed = resultStr.includes(testCase.expected);
      }
      
      if (testPassed) {
        console.log('✅ PASSED');
        passedTests++;
      } else {
        console.log('❌ FAILED');
      }
      
    } catch (error) {
      console.log('❌ ERROR:', error.message);
    }
    
    console.log('──────────────────────────────────────────────────');
  }

  console.log(`📋 Test Summary: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All LLM-based sanitization tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check the implementation.');
  }
}

// Run the tests
runLLMSanitizationTests().catch(console.error);
