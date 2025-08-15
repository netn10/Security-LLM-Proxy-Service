#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  retries: 3
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class TestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0
    };
    this.startTime = Date.now();
    this.testCounts = {
      jest: 0,
      integration: 0,
      html: 0
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logHeader(message) {
    this.log(`\n${'='.repeat(60)}`, 'cyan');
    this.log(`  ${message}`, 'bright');
    this.log(`${'='.repeat(60)}`, 'cyan');
  }

  logTestResult(testName, passed, error = null, testCount = 1) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? 'green' : 'red';
    this.log(`${status} ${testName} (${testCount} test${testCount !== 1 ? 's' : ''})`, color);

    if (error) {
      this.log(`   Error: ${error}`, 'red');
      
      // Explain common error patterns
      if (error.includes('403')) {
        this.log('   💡 403 errors are expected security responses:', 'yellow');
        this.log('      - Time-based blocking: Requests blocked during specific seconds', 'yellow');
        this.log('      - Financial content blocking: Requests with financial terms blocked', 'yellow');
        this.log('      - This indicates security features are working correctly', 'yellow');
      } else if (error.includes('429')) {
        this.log('   💡 429 errors indicate rate limiting is active', 'yellow');
        this.log('      - This is expected behavior for security', 'yellow');
      }
    }

    if (passed) {
      this.results.passed += testCount;
    } else {
      this.results.failed += testCount;
    }
    this.results.total += testCount;
  }

  // Count Jest tests in a file
  countJestTests(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const testMatches = content.match(/test\(/g);
      const describeMatches = content.match(/describe\(/g);

      // Count individual test() calls
      const testCount = testMatches ? testMatches.length : 0;

      // If there are describe blocks, we might have nested tests
      // For now, we'll count test() calls as individual tests
      return testCount;
    } catch (error) {
      return 0;
    }
  }

  // Count integration test functions in a file
  countIntegrationTests(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Count async function test* patterns
      const asyncTestMatches = content.match(/async function test[A-Z]/g);
      const testMatches = content.match(/function test[A-Z]/g);

      let count = 0;
      if (asyncTestMatches) count += asyncTestMatches.length;
      if (testMatches) count += testMatches.length;

      // Also count any other test-like functions
      const otherTestMatches = content.match(/async function [a-zA-Z]*[Tt]est/g);
      if (otherTestMatches) count += otherTestMatches.length;

      return count;
    } catch (error) {
      return 0;
    }
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        shell: true,
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject({ stdout, stderr, code });
        }
      });

      child.on('error', (error) => {
        reject({ error: error.message });
      });
    });
  }

  async checkServerHealth() {
    this.log('\n🏥 Checking server health...', 'blue');

    for (let i = 0; i < TEST_CONFIG.retries; i++) {
      try {
        const response = await axios.get(`${TEST_CONFIG.baseUrl}/health`, {
          timeout: 5000
        });

        if (response.status === 200) {
          this.log('✅ Server is running and healthy', 'green');
          return true;
        }
      } catch (error) {
        this.log(`⚠️  Attempt ${i + 1}/${TEST_CONFIG.retries}: Server not ready (${error.message})`, 'yellow');

        if (i < TEST_CONFIG.retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    this.log('❌ Server is not running or not healthy', 'red');
    this.log('   Please start the server with: npm run start:dev', 'yellow');
    return false;
  }

  async runJestTests() {
    this.logHeader('RUNNING JEST TESTS');

    const jestTestFile = path.join(__dirname, 'database.test.js');
    const testCount = this.countJestTests(jestTestFile);
    this.testCounts.jest = testCount;

    try {
      const result = await this.runCommand('npm', ['run', 'test:db']);
      this.logTestResult('Database Tests (Jest)', true, null, testCount);
      this.log(result.stdout, 'reset');
    } catch (error) {
      this.logTestResult('Database Tests (Jest)', false, error.stderr || error.error, testCount);
    }
  }

  async runNodeIntegrationTests() {
    this.logHeader('RUNNING NODE.JS INTEGRATION TESTS');

    const testFiles = [
      'test-api-key.js',
      'test-core-functionality.js',
      'test-proxy.js',
      'test-sanitization.js',
      'test-false-positives.js',
      'test-dashboard.js',
      'test-simple-endpoint.js',
      'test-route-pattern.js',
      'test-sanitization-only.js',
      'test-sensitive-data.js',
    ];

    for (const testFile of testFiles) {
      const testPath = path.join(__dirname, testFile);

      if (!fs.existsSync(testPath)) {
        this.log(`⚠️  Test file not found: ${testFile}`, 'yellow');
        this.results.skipped++;
        this.results.total++;
        continue;
      }

      const testCount = this.countIntegrationTests(testPath);
      this.testCounts.integration += testCount;

      try {
        this.log(`\n🧪 Running ${testFile}...`, 'blue');
        const result = await this.runCommand('node', [testPath]);
        this.logTestResult(testFile, true, null, testCount);

        // Show test output if it contains important information
        if (result.stdout.includes('✅') || result.stdout.includes('❌')) {
          this.log(result.stdout, 'reset');
        }
      } catch (error) {
        this.logTestResult(testFile, false, error.stderr || error.error, testCount);
      }
    }
  }

  async runAllTests() {
    this.logHeader('LASSO PROXY - COMPREHENSIVE TEST SUITE');
    this.log(`Started at: ${new Date().toLocaleString()}`, 'blue');

    // Check server health first
    const serverHealthy = await this.checkServerHealth();
    if (!serverHealthy) {
      this.log('\n⚠️  Some tests may fail without a running server', 'yellow');
    }

    // Run Jest tests
    await this.runJestTests();

    // Run Node.js integration tests
    await this.runNodeIntegrationTests();

    // Print summary
    this.printSummary();
  }

  printSummary() {
    const duration = Date.now() - this.startTime;

    this.logHeader('TEST SUMMARY');
    this.log(`Total Tests: ${this.results.total}`, 'bright');
    this.log(`  - Jest Tests: ${this.testCounts.jest}`, 'blue');
    this.log(`  - Integration Tests: ${this.testCounts.integration}`, 'blue');
    this.log(`Passed: ${this.results.passed}`, 'green');
    this.log(`Failed: ${this.results.failed}`, 'red');
    this.log(`Skipped: ${this.results.skipped}`, 'yellow');
    this.log(`Duration: ${(duration / 1000).toFixed(2)}s`, 'blue');

    if (this.results.failed === 0) {
      this.log('\n🎉 All tests completed successfully!', 'green');
    } else {
      this.log(`\n⚠️  ${this.results.failed} test(s) failed`, 'red');
    }

    this.log('\n' + '='.repeat(60), 'cyan');
  }
}

// Main execution
async function main() {
  const runner = new TestRunner();

  try {
    await runner.runAllTests();
  } catch (error) {
    console.error('Test runner error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = TestRunner;
