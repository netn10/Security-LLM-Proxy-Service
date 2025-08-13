# Lasso Security LLM Proxy Service - Usage Guide

## 🚀 Quick Start

### 1. Installation & Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Configure environment
cp config.env .env
# Edit .env with your API keys

# Start the server
npm run start:dev
```

### 2. Configure Your LLM SDK

**OpenAI SDK:**
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3000/openai',
  apiKey: 'your-client-api-key', // Will be replaced by proxy
});
```

**Anthropic SDK:**
```javascript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  baseURL: 'http://localhost:3000/anthropic',
  apiKey: 'your-client-api-key', // Will be replaced by proxy
});
```

## 🔧 Configuration

### Environment Variables

```bash
# API Configuration
PORT=3000
OPENAI_API_KEY=your_actual_openai_key
ANTHROPIC_API_KEY=your_actual_anthropic_key

# Security Features
ENABLE_DATA_SANITIZATION=true
ENABLE_TIME_BASED_BLOCKING=true
ENABLE_POLICY_ENFORCEMENT=true

# Caching
ENABLE_CACHING=true
CACHE_TTL=300
```

### Feature Toggles

You can enable/disable individual features:

```bash
# Disable data sanitization
ENABLE_DATA_SANITIZATION=false

# Disable time-based blocking
ENABLE_TIME_BASED_BLOCKING=false

# Disable financial content blocking
ENABLE_POLICY_ENFORCEMENT=false

# Disable caching
ENABLE_CACHING=false
```

## 🧹 Data Sanitization Examples

### Before Sanitization
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Send an email to john.doe@example.com about the server at 192.168.1.1 and my IBAN DE89370400440532013000"
    }
  ]
}
```

### After Sanitization
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Send an email to EMAIL_PH about the server at IP_ADDRESS_PH and my IBAN IBAN_PH"
    }
  ]
}
```

### Supported Patterns
- **Email addresses**: `user@domain.com` → `EMAIL_PH`
- **IP addresses**: `192.168.1.1` → `IP_ADDRESS_PH`
- **IBAN numbers**: `DE89370400440532013000` → `IBAN_PH`

## ⏰ Time-Based Blocking

Requests are automatically blocked when the current time's seconds value is 1, 2, 7, or 8.

**Example blocked response:**
```json
{
  "error": {
    "message": "Request blocked due to time-based policy",
    "code": "TIME_BLOCKED"
  }
}
```

**Check current status:**
```bash
curl http://localhost:3000/health
```

## 💰 Financial Content Blocking

Requests containing financial content are automatically blocked using LLM classification.

**Example financial request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Help me with my investment portfolio and stock trading strategy"
    }
  ]
}
```

**Blocked response:**
```json
{
  "error": {
    "message": "Request blocked due to financial content policy",
    "code": "FINANCIAL_BLOCKED"
  }
}
```

## 💾 Caching

Identical sanitized requests are automatically served from cache for improved performance.

**Cache behavior:**
- First request: Forwarded to provider
- Subsequent identical requests: Served from cache
- Cache TTL: Configurable (default: 5 minutes)
- Cache key: Based on provider, path, and sanitized body

## 📊 Monitoring & Logging

### Health Check
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "Lasso Security LLM Proxy",
  "timestamp": "2025-08-13T14:31:36.513Z",
  "endpoints": {
    "openai": "/openai/*",
    "anthropic": "/anthropic/*"
  },
  "features": {
    "dataSanitization": true,
    "timeBasedBlocking": true,
    "caching": true,
    "policyEnforcement": true,
    "logging": true
  }
}
```

### Statistics
```bash
curl http://localhost:3000/stats
```

**Response:**
```json
{
  "total": 150,
  "byAction": {
    "proxied": 120,
    "blocked_time": 5,
    "blocked_financial": 3,
    "served_from_cache": 22
  },
  "byProvider": {
    "openai": 100,
    "anthropic": 50
  }
}
```

### Recent Logs
```bash
curl http://localhost:3000/logs?limit=10
```

### Logs by Action
```bash
# Get proxied requests
curl http://localhost:3000/logs/proxied

# Get blocked requests
curl http://localhost:3000/logs/blocked_time
curl http://localhost:3000/logs/blocked_financial

# Get cached requests
curl http://localhost:3000/logs/served_from_cache
```

## 🧪 Testing

### Run Comprehensive Tests
```bash
npm run test:complete
```

### Test Individual Features
```bash
# Test sanitization
node test/test-sanitization.js

# Test proxy functionality
node test/test-proxy.js

# Demo sanitization
node test/demo-sanitization.js
```

## 🔒 Security Features

### 1. API Key Management
- Client API keys are automatically replaced with configured provider keys
- No sensitive keys are logged or exposed

### 2. Data Sanitization
- Sensitive information is anonymized before sending to providers
- Only affects specific endpoints (`/chat/completions`, `/messages`)
- Extensible pattern matching system

### 3. Content Filtering
- LLM-based detection of financial content
- Automatic blocking of prohibited content
- Lightweight classification for performance

### 4. Audit Logging
- All requests logged with timestamps and actions
- Asynchronous logging to avoid latency impact
- Comprehensive monitoring endpoints

## 📈 Performance Optimization

### 1. Caching Strategy
- Identical requests served from cache
- Configurable TTL for different use cases
- Automatic cache invalidation

### 2. Asynchronous Operations
- Database logging doesn't block requests
- Non-blocking policy enforcement
- Efficient request processing

### 3. Selective Processing
- Only specified endpoints undergo processing
- Minimal overhead for non-sensitive endpoints
- Configurable feature toggles

## 🚀 Production Deployment

### 1. Database Setup
```bash
# Use PostgreSQL for production
npm run docker:up

# Update app.module.ts to use PostgreSQL configuration
```

### 2. Environment Configuration
```bash
# Production environment variables
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=your_production_key
ANTHROPIC_API_KEY=your_production_key
```

### 3. Security Considerations
- Disable `synchronize: true` in TypeORM config
- Use HTTPS in production
- Set up proper logging and monitoring
- Configure rate limiting if needed

## 🔧 Extending the Service

### Adding New Sanitization Patterns
```typescript
// In DataSanitizationService
this.addPattern('ssn', /\b\d{3}-\d{2}-\d{4}\b/g, 'SSN_PH');
this.addPattern('credit_card', /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, 'CARD_PH');
```

### Adding New Providers
1. Update `proxy.service.ts` with provider configuration
2. Add provider-specific header handling
3. Update monitoring and logging

### Custom Policy Enforcement
1. Extend `PolicyEnforcementService`
2. Add new content classification rules
3. Update action types in `RequestAction` enum

## 🐛 Troubleshooting

### Common Issues

1. **Server won't start**
   - Check if port 3000 is available
   - Verify environment variables are set
   - Check database connection

2. **Requests failing**
   - Verify API keys are correct
   - Check if time-based blocking is active
   - Review logs for error messages

3. **Sanitization not working**
   - Ensure `ENABLE_DATA_SANITIZATION=true`
   - Check if endpoint is supported
   - Verify request format

4. **Caching not working**
   - Ensure `ENABLE_CACHING=true`
   - Check cache TTL configuration
   - Verify cache key generation

### Debug Mode
```bash
npm run start:debug
```

### View Logs
```bash
# Application logs
npm run start:dev

# Database logs
curl http://localhost:3000/logs
```

## 📚 API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/stats` | Request statistics |
| `GET` | `/logs` | Recent logs |
| `GET` | `/logs/:action` | Logs by action type |
| `ALL` | `/openai/*` | OpenAI proxy |
| `ALL` | `/anthropic/*` | Anthropic proxy |

### Request Actions

| Action | Description |
|--------|-------------|
| `proxied` | Request forwarded to provider |
| `blocked_time` | Request blocked by time policy |
| `blocked_financial` | Request blocked by content policy |
| `served_from_cache` | Request served from cache |

## 🎉 Success!

Your Lasso Security LLM Proxy Service is now fully operational with all security features enabled. The service provides enterprise-grade protection for your LLM applications while maintaining high performance and comprehensive monitoring capabilities.
