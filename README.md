# Lasso Security LLM Proxy Service

A secure and transparent intermediary for LLM applications that intercepts, inspects, and modifies outgoing requests before forwarding them to official LLM provider APIs.

## Features

### Phase 1: Basic Endpoint Setup & Request Forwarding ✅
- **Catch-all endpoints** for OpenAI (`/openai/*`) and Anthropic (`/anthropic/*`)
- **Request forwarding** to official provider APIs with proper authentication
- **Header management** and response proxying
- **CORS support** for client applications

### Phase 2: Data Sanitization & Proxying ✅
- **Email address detection** and anonymization with `EMAIL_PH` placeholder
- **IP address detection** (IPv4) with `IP_ADDRESS_PH` placeholder (Bonus)
- **IBAN detection** with `IBAN_PH` placeholder (Bonus)
- **Reusable parsing system** for easy extension of new patterns
- **Selective sanitization** only for `/chat/completions` and `/messages` endpoints

### Phase 3: Conditional Blocking & Secure Caching ✅
- **Time-based blocking** - requests blocked when seconds are 1, 2, 7, or 8
- **Secure caching** - identical sanitized requests served from cache
- **Configurable TTL** for cached responses
- **Cache key generation** based on provider, path, and sanitized body

### Phase 4: Persistence & Logging ✅
- **PostgreSQL database** for request logging
- **Asynchronous logging** to avoid latency impact
- **Comprehensive audit trail** with timestamps, providers, and actions
- **Monitoring endpoints** for statistics and log viewing
- **Action tracking**: proxied, blocked_time, blocked_financial, served_from_cache

### Phase 5: LLM-Based Policy Enforcement ✅ (Bonus)
- **Financial content detection** using LLM classification
- **Automatic blocking** of financial-related requests
- **Lightweight classification** using GPT-3.5-turbo
- **Configurable policy enforcement** per endpoint

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start PostgreSQL database:**
   ```bash
   npm run docker:up
   ```

3. **Setup database and run migrations:**
   ```bash
   npm run db:setup
   ```

4. **Configure environment:**
   ```bash
   # Copy the example configuration
   cp config.env .env
   
   # Edit .env with your actual API keys
   OPENAI_API_KEY=your_actual_openai_key
   ANTHROPIC_API_KEY=your_actual_anthropic_key
   ```

5. **Start the development server:**
   ```bash
   npm run start:dev
   ```

   **Or use the combined command:**
   ```bash
   npm run start:with-db
   ```

5. **The proxy will be available at:**
   - OpenAI endpoint: `http://localhost:3000/openai/*`
   - Anthropic endpoint: `http://localhost:3000/anthropic/*`
   - Health check: `http://localhost:3000/health`
   - Statistics: `http://localhost:3000/stats`
   - Logs: `http://localhost:3000/logs`

## Usage

### Configure your LLM SDK

Point your LLM SDK's `baseURL` to the proxy:

**OpenAI SDK:**
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3000/openai',
  apiKey: 'your-client-api-key', // This will be replaced by the proxy
});
```

**Anthropic SDK:**
```javascript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  baseURL: 'http://localhost:3000/anthropic',
  apiKey: 'your-client-api-key', // This will be replaced by the proxy
});
```

### Data Sanitization

The proxy automatically sanitizes sensitive data in requests to:
- `/chat/completions` (OpenAI)
- `/messages` (Anthropic)

**Example sanitization:**
```json
// Original request
{
  "messages": [
    {
      "role": "user", 
      "content": "Send an email to john.doe@example.com about the server 192.168.1.1"
    }
  ]
}

// Sanitized request sent to provider
{
  "messages": [
    {
      "role": "user",
      "content": "Send an email to EMAIL_PH about the server IP_ADDRESS_PH"
    }
  ]
}
```

### Time-Based Blocking

Requests are automatically blocked when the current time's seconds value is 1, 2, 7, or 8:

```json
{
  "error": {
    "message": "Request blocked due to time-based policy",
    "code": "TIME_BLOCKED"
  }
}
```

### Financial Content Blocking

Requests containing financial content are automatically blocked:

```json
{
  "error": {
    "message": "Request blocked due to financial content policy",
    "code": "FINANCIAL_BLOCKED"
  }
}
```

### Caching

Identical sanitized requests are served from cache for improved performance. Cache TTL is configurable (default: 5 minutes).

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `PORT` | Server port | `3000` |
| `OPENAI_API_URL` | OpenAI base URL | `https://api.openai.com` |
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `ANTHROPIC_API_URL` | Anthropic base URL | `https://api.anthropic.com` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Required |
| `ENABLE_DATA_SANITIZATION` | Enable/disable sanitization | `true` |
| `ENABLE_TIME_BASED_BLOCKING` | Enable/disable time blocking | `true` |
| `ENABLE_CACHING` | Enable/disable caching | `true` |
| `ENABLE_POLICY_ENFORCEMENT` | Enable/disable financial blocking | `true` |
| `CACHE_TTL` | Cache TTL in seconds | `300` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | Database username | `lasso_user` |
| `DB_PASSWORD` | Database password | `lasso_password` |
| `DB_DATABASE` | Database name | `lasso_proxy` |
| `DB_CONNECTION_LIMIT` | Connection pool limit | `10` |
| `DB_ACQUIRE_TIMEOUT` | Connection acquire timeout (ms) | `60000` |
| `DB_TIMEOUT` | Query timeout (ms) | `60000` |
| `DB_RETRY_ATTEMPTS` | Connection retry attempts | `3` |
| `DB_RETRY_DELAY` | Retry delay between attempts (ms) | `3000` |
| `NODE_ENV` | Environment (development/production) | `development` |

## Monitoring & Logging

### Health Check
```bash
curl http://localhost:3000/health
```

### Statistics
```bash
curl http://localhost:3000/stats
```

### Recent Logs
```bash
curl http://localhost:3000/logs?limit=10
```

### Logs by Action
```bash
curl http://localhost:3000/logs/proxied
curl http://localhost:3000/logs/blocked_time
curl http://localhost:3000/logs/blocked_financial
curl http://localhost:3000/logs/served_from_cache
```

## Architecture

```
Client Application
       ↓
   Lasso Proxy
   ├── Request Interception
   ├── Time-based Blocking (Phase 3)
   ├── Data Sanitization (Phase 2)
   ├── Financial Content Detection (Phase 5)
   ├── Cache Check (Phase 3)
   ├── Request Logging (Phase 4)
   ├── Header Management
   └── Response Forwarding
       ↓
Official LLM Provider API
```

## Development

**Build the project:**
```bash
npm run build
```

**Run in production:**
```bash
npm run start:prod
```

**Run tests:**
```bash
npm test
```

**Database management:**
```bash
# Start database
npm run docker:up

# Stop database
npm run docker:down

# Setup database and run migrations
npm run db:setup

# Run migrations only
npm run db:migrate
```

## Security Features

- **Automatic API key management** - Client keys are replaced with configured provider keys
- **Data sanitization** - Sensitive information is anonymized before sending to providers
- **Time-based blocking** - Requests blocked during specific time windows
- **Financial content blocking** - LLM-based detection and blocking of financial topics
- **Selective processing** - Only specified endpoints undergo processing
- **Extensible pattern matching** - Easy to add new data types for sanitization
- **Comprehensive logging** - All requests logged with actions and timestamps
- **Secure caching** - Identical requests served from cache for performance

## Extending Sanitization

You can easily add new sanitization patterns:

```typescript
// In DataSanitizationService
this.addPattern('ssn', /\b\d{3}-\d{2}-\d{4}\b/g, 'SSN_PH');
```

## Database Schema

The `request_logs` table stores:
- `id`: Unique identifier (UUID)
- `timestamp`: Request timestamp
- `provider`: LLM provider (openai/anthropic)
- `anonymizedPayload`: Sanitized request payload
- `action`: Request action (proxied/blocked_time/blocked_financial/served_from_cache)
- `endpoint`: Request endpoint
- `responseTime`: Response time in milliseconds
- `errorMessage`: Error message if applicable

## PostgreSQL Setup

### Development Setup
The application uses PostgreSQL for production-ready database storage. For development:

1. **Start PostgreSQL container:**
   ```bash
   npm run docker:up
   ```

2. **Run database setup:**
   ```bash
   npm run db:setup
   ```

3. **Verify connection:**
   ```bash
   curl http://localhost:3000/health
   ```

### Production Setup
For production deployment:

1. **Set environment variables:**
   ```bash
   NODE_ENV=production
   DB_HOST=your-production-db-host
   DB_PORT=5432
   DB_USERNAME=your-db-user
   DB_PASSWORD=your-secure-password
   DB_DATABASE=lasso_proxy
   ```

2. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

3. **Start the application:**
   ```bash
   npm run start:prod
   ```

### Database Migration
The application includes automatic migration support:

- **Development**: Tables are auto-created (`synchronize: true`)
- **Production**: Use manual migrations (`synchronize: false`)

To run migrations manually:
```bash
npm run db:migrate
```

### Connection Pooling
The application is configured with connection pooling for production:

- **Connection Limit**: 10 (configurable via `DB_CONNECTION_LIMIT`)
- **Acquire Timeout**: 60 seconds
- **Query Timeout**: 60 seconds
- **Retry Logic**: 3 attempts with 3-second delays

## Troubleshooting

### Database Connection Issues
1. **Check PostgreSQL is running:**
   ```bash
   docker ps | grep postgres
   ```

2. **Verify environment variables:**
   ```bash
   cat .env | grep DB_
   ```

3. **Test database connection:**
   ```bash
   npm run db:setup
   ```

### Migration Issues
1. **Check migration files exist:**
   ```bash
   ls src/database/migrations/
   ```

2. **Run setup with verbose output:**
   ```bash
   DEBUG=* npm run db:setup
   ```

## License

ISC
