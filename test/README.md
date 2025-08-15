# Lasso Proxy Test Suite

Comprehensive tests for the Lasso Proxy application covering database operations, API endpoints, data sanitization, and integration scenarios.

## 🚀 Quick Start

### Run All Tests
```bash
# Using npm script (recommended)
npm run test:all

# Using Node.js directly
node test/run-all-tests.js

# Platform-specific scripts
# Windows: test/run-tests.bat
# Unix/Linux/macOS: ./test/run-tests.sh
```

### Prerequisites
- **Node.js** (v14 or higher)
- **PostgreSQL** database running
- **Lasso Proxy server** running (optional, but recommended)

### Setup
1. Install dependencies: `npm install`
2. Set up database: `npm run db:setup`
3. Start the server: `npm run start:dev` (in a separate terminal)

## 📋 Test Categories

### Jest Tests
- **`database.test.js`** - Database connection and schema validation
  - PostgreSQL connection testing
  - Table structure validation
  - Data insertion and retrieval
  - Index and constraint verification

### Node.js Integration Tests
- **`test-core-functionality.js`** - Comprehensive end-to-end tests
  - Health check validation
  - Data sanitization for OpenAI and Anthropic
  - Financial content blocking
  - Time-based restrictions

- **`test-proxy.js`** - Proxy-specific functionality
  - Request routing and header handling
  - Response processing

- **`test-sanitization.js`** - Data sanitization tests
  - Email, IP, IBAN, and credit card detection
  - Mixed sensitive data handling

- **`test-false-positives.js`** - False positive validation
  - Ensures legitimate content isn't blocked
  - Edge cases and boundary conditions

- **`test-dashboard.js`** - Dashboard functionality
  - WebSocket connections and real-time updates
  - Data visualization

- **`test-rate-limiting.js`** - Rate limiting functionality
  - Token bucket algorithm testing
  - IP-based rate limiting

## 🧪 Individual Test Execution

```bash
# Jest tests only
npm run test:db

# Individual Node.js tests
node test/test-core-functionality.js
node test/test-sanitization.js
node test/test-dashboard.js
node test/test-rate-limiting.js
```

## ⚙️ Test Configuration

### Environment Variables
Tests use environment variables from `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=lasso_user
DB_PASSWORD=lasso_password
DB_DATABASE=lasso_proxy
```

### Test Settings
- **Base URL**: `http://localhost:3000`
- **Timeout**: 30 seconds per test
- **Retries**: 3 attempts for server health check

## 🔍 Understanding Test Results

### Expected Behaviors
- **403 errors are expected** - indicate security features are working
- **429 errors are expected** - indicate rate limiting is working
- **404 responses** are normal when API keys aren't configured
- **Time-based blocking** varies depending on current time

### Success Indicators
- ✅ All tests pass
- Server health check successful
- Database operations complete
- No error messages in output

### Failure Indicators
- ❌ Test failures
- Server connection refused
- Database errors
- Timeout errors

## 🛠️ Troubleshooting

### Common Issues

1. **Server not running**
   ```
   ❌ Server is not running or not healthy
   Please start the server with: npm run start:dev
   ```

2. **Database connection failed**
   ```
   ❌ Database Tests (Jest) FAIL
   Error: connect ECONNREFUSED 127.0.0.1:5432
   ```
   Solution: Start PostgreSQL and run `npm run db:setup`

3. **Missing dependencies**
   ```
   ❌ Module not found: Can't resolve 'axios'
   ```
   Solution: Run `npm install`

### Debug Mode
```bash
# Debug Jest tests
npm run test:debug

# Debug Node.js tests with verbose output
DEBUG=* node test/test-core-functionality.js
```

## 📊 Test Results Interpretation

### ✅ PASS (with 403/429 errors)
- **Status**: Test passed successfully
- **Meaning**: Security features are working as designed
- **Action**: No action needed - this is correct behavior

### ❌ FAIL (with 403/429 errors)
- **Status**: Test actually failed for a different reason
- **Meaning**: Look for other error messages, not the 403/429
- **Action**: Check the specific error details

## 🚀 Performance Notes

- Full test suite takes approximately 2-5 minutes
- Individual tests take 10-30 seconds each
- Database tests are the fastest
- Integration tests may take longer depending on server response time

## 🤝 Contributing

When adding new tests:

1. Follow the existing naming convention
2. Include proper error handling
3. Add descriptive console output
4. Update this README with test description
5. Ensure tests are independent and can run in any order

## 📖 Related Documentation

- [403-ERROR-EXPLANATION.md](../403-ERROR-EXPLANATION.md) - Understanding expected 403 errors
- [Main README.md](../README.md) - Project overview and setup
