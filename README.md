# Security LLM Proxy Service

A secure and transparent intermediary for LLM applications that intercepts, inspects, and modifies outgoing requests before forwarding them to official LLM provider APIs.

## 📋 Requirements

### System Requirements
- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **Docker**: For PostgreSQL database
- **PostgreSQL**: Version 13 or higher (via Docker)

### API Keys Required
- **OpenAI API Key**: For OpenAI API access
- **Anthropic API Key**: For Anthropic API access


## 🚀 Quick Start

1. **Clone the repository (if not already done):**
   ```bash
   git clone https://github.com/netn10/Security-LLM-Proxy-Service.git
   cd Security-LLM-Proxy-Service
   ```

2. **Ensure Docker is running:**
   - Make sure Docker Desktop is started and running on your system
   - Verify Docker is accessible by running: `docker --version`

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start PostgreSQL database:**
   ```bash
   npm run docker:up
   ```

3. **Setup database:**
   ```bash
   npm run db:setup
   ```

4. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your API keys
   ```

5. **Start the server:**
   ```bash
   npm run start:dev
   ```

6. **Access the proxy:**
   - OpenAI: `http://localhost:3000/openai/*path`
   - Anthropic: `http://localhost:3000/anthropic/*path`
   - Dashboard: `http://localhost:3000/dashboard`

### Optional Steps

7. **Run tests to verify everything works:**
   ```bash
   npm run test:all
   ```

8. **Explore the dashboard:**
   - Open `http://localhost:3000/dashboard` in your browser
   - Monitor real-time requests and proxy performance
   - View analytics and security events

9. **Try the example Flask application:**
   ```bash
   cd example-use-case
   cp env.example .env
   # Edit .env with your API keys
   pip install -r requirements.txt
   python app.py
   ```
   - Access the chat interface at `http://localhost:5000`
   - Test the proxy with a real chat application
   - See [example-use-case/README.md](example-use-case/README.md) for detailed instructions

## ✨ Features

### 🔒 Security Features
- **Data Sanitization**: Automatically anonymizes emails, IPs, and IBANs
- **Time-based Blocking**: Blocks requests during specific time windows
- **Financial Content Detection**: LLM-based detection and blocking
- **Rate Limiting**: Token bucket algorithm with per-IP limits
- **API Key Management**: Secure handling of provider API keys

### 📊 Monitoring & Analytics
- **Real-time Dashboard**: WebSocket-powered monitoring interface
- **Request Logging**: Comprehensive audit trail with PostgreSQL
- **Cache Performance**: Intelligent caching with configurable TTL
- **Provider Analytics**: Usage distribution and performance metrics

### 🔧 Developer Experience
- **Provider Agnostic**: Easy to add new LLM providers
- **Feature Flags**: Enable/disable features via environment variables
- **Comprehensive Testing**: Full test suite with automated runners
- **Example Integration**: Complete Flask chat application

## 🏗️ Architecture

```
Client Application
       ↓
   Proxy
   ├── Rate Limiting
   ├── Time-based Blocking
   ├── Data Sanitization
   ├── Financial Content Detection
   ├── Cache Check
   ├── Request Logging
   └── Response Forwarding
       ↓
Official LLM Provider API
```

## 📋 Configuration

### Required Environment Variables
```env
# API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_DATABASE=proxy
```

### Optional Features
```env
# Feature Flags
ENABLE_DATA_SANITIZATION=true
ENABLE_TIME_BASED_BLOCKING=true
ENABLE_CACHING=true
ENABLE_POLICY_ENFORCEMENT=true
ENABLE_RATE_LIMITING=true

# Rate Limiting
RATE_LIMIT_MAX_TOKENS=100
RATE_LIMIT_REFILL_RATE=10
RATE_LIMIT_REFILL_INTERVAL=1000

# Cache
CACHE_TTL=300
```

## 🧪 Testing

### Run All Tests
```bash
npm run test:all
```

### Individual Test Suites
```bash
npm run test:core-functionality
npm run test:sanitization
npm run test:dashboard
npm run test:db
```

### Understanding Test Results
- **403 errors are expected** - indicate security features are working
- **429 errors are expected** - indicate rate limiting is working
- See [403-ERROR-EXPLANATION.md](403-ERROR-EXPLANATION.md) for details

## 📚 Usage Examples

### Configure LLM SDK
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3000/openai',
  apiKey: 'your-client-key', // Replaced by proxy
});
```

### Data Sanitization
```json
// Original request
{
  "messages": [{
    "role": "user",
    "content": "Email john@example.com about server 192.168.1.1"
  }]
}

// Sanitized request
{
  "messages": [{
    "role": "user", 
    "content": "Email EMAIL_PH about server IP_ADDRESS_PH"
  }]
}
```

## 🔧 Development

### Database Management
```bash
# Start database
npm run docker:up

# Setup database
npm run db:setup

# Reset database
npm run db:reset
```

### Build & Deploy
```bash
# Build
npm run build

# Production
npm run start:prod
```

## 📖 Documentation

- [EXTRA.md](EXTRA.md) - Extra features that were not in the assignment and more.
- [DATABASE_RESET.md](DATABASE_RESET.md) - Database management guide
- [test/README.md](test/README.md) - Testing documentation
- [config/README.md](config/README.md) - Model configuration guide
- [example-use-case/README.md](example-use-case/README.md) - Example integration

## 🤝 Contributing

1. Follow existing code patterns
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass

## 📄 License

This project is part of an assignment.
