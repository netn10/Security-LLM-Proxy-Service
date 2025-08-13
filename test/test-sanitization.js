/**
 * Test script for data sanitization functionality
 * Run with: node test/test-sanitization.js
 */

// Simple mock of the DataSanitizationService for testing
class DataSanitizationService {
  constructor() {
    this.patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
      iban: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/g,
    };

    this.placeholders = {
      email: 'EMAIL_PH',
      ipv4: 'IP_ADDRESS_PH',
      iban: 'IBAN_PH',
    };
  }

  sanitizeData(data) {
    if (!data) return data;
    const sanitizedData = JSON.parse(JSON.stringify(data));
    return this.sanitizeRecursive(sanitizedData);
  }

  sanitizeRecursive(obj) {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeRecursive(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeRecursive(value);
      }
      return sanitized;
    }

    return obj;
  }

  sanitizeString(text) {
    let sanitized = text;
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const placeholder = this.placeholders[type];
      sanitized = sanitized.replace(pattern, placeholder);
    }
    return sanitized;
  }

  getSanitizationStats(originalData, sanitizedData) {
    const originalText = JSON.stringify(originalData);
    
    const emailsFound = (originalText.match(this.patterns.email) || []).length;
    const ipAddressesFound = (originalText.match(this.patterns.ipv4) || []).length;
    const ibansFound = (originalText.match(this.patterns.iban) || []).length;

    return {
      emailsFound,
      ipAddressesFound,
      ibansFound,
      totalSanitized: emailsFound + ipAddressesFound + ibansFound,
    };
  }
}

function runSanitizationTests() {
  console.log('🧪 Testing Data Sanitization Service\n');
  
  const sanitizer = new DataSanitizationService();
  
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
      expected: 'All placeholders'
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
      expected: 'No changes'
    }
  ];

  let passedTests = 0;
  
  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log('📤 Input:', JSON.stringify(testCase.input, null, 2));
    
    const sanitized = sanitizer.sanitizeData(testCase.input);
    const stats = sanitizer.getSanitizationStats(testCase.input, sanitized);
    
    console.log('📥 Output:', JSON.stringify(sanitized, null, 2));
    console.log('📊 Stats:', stats);
    
    // Check if sanitization occurred as expected
    const sanitizedText = JSON.stringify(sanitized);
    let testPassed = false;
    
    switch (testCase.name) {
      case 'Email sanitization':
        testPassed = sanitizedText.includes('EMAIL_PH') && !sanitizedText.includes('@');
        break;
      case 'IP address sanitization':
        testPassed = sanitizedText.includes('IP_ADDRESS_PH') && !sanitizedText.includes('192.168.1.1');
        break;
      case 'IBAN sanitization':
        testPassed = sanitizedText.includes('IBAN_PH') && !sanitizedText.includes('GB82WEST');
        break;
      case 'Mixed sensitive data':
        testPassed = sanitizedText.includes('EMAIL_PH') && 
                    sanitizedText.includes('IP_ADDRESS_PH') && 
                    sanitizedText.includes('IBAN_PH');
        break;
      case 'No sensitive data':
        testPassed = JSON.stringify(testCase.input) === JSON.stringify(sanitized);
        break;
    }
    
    console.log(testPassed ? '✅ PASSED' : '❌ FAILED');
    if (testPassed) passedTests++;
    console.log('─'.repeat(50));
  });
  
  console.log(`\n📋 Test Summary: ${passedTests}/${testCases.length} tests passed`);
  
  if (passedTests === testCases.length) {
    console.log('🎉 All sanitization tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check the implementation.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runSanitizationTests();
}

module.exports = { runSanitizationTests };
