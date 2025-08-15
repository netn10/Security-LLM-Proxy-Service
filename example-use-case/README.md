# NatiChat - Chat App with Lasso Proxy Security

A real-time chat application demonstrating full Lasso Proxy security integration with AI-powered content moderation.

## ✨ Features

- **Real-time Chat**: WebSocket-based messaging with typing indicators
- **AI Integration**: Direct access to ChatGPT and Claude via buttons or commands (`/chatgpt`, `/claude`)
- **Lasso Proxy Security**: Rate limiting, sensitive data detection, financial content filtering, time-based restrictions
- **Content Moderation**: AI-powered message screening with automatic censoring
- **Theme System**: Light/dark mode with CSS variables

## 🚀 Quick Start

### Prerequisites
- Python 3.7+
- Node.js (for Lasso Proxy)
- OpenAI/Anthropic API keys (optional)

### Installation

1. **Install dependencies:**
   ```bash
   cd example-use-case
   pip install -r requirements.txt
   ```

2. **Set up environment:**
   ```bash
   cp env.example .env
   # Add your API keys to .env
   ```

3. **Start Lasso Proxy (in another terminal):**
   ```bash
   # From root directory
   npm start
   ```

4. **Start NatiChat:**
   ```bash
   python app.py
   ```

5. **Open browser:** `http://localhost:5000`

## 🎯 Usage

- **Chat**: Type messages and press Enter
- **AI Commands**: Use `/chatgpt <prompt>` or `/claude <prompt>`
- **AI Buttons**: Click 🤖 for ChatGPT or 🧠 for Claude
- **Moderation**: Messages sent to the chat are routed through either ChatGPT or Claude, selected at random, via the proxy.

## 🧪 Testing

### Automated Tests
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Using test runner
python run_tests.py all
```

**Test Coverage**: 68 tests covering AI integration, message handling, security features, and edge cases.

### Manual Testing
```bash
# Test content moderation
python test_moderation.py
```

## 🔧 Configuration

### Environment Variables (.env)
```env
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Lasso Proxy Integration
- OpenAI: `http://localhost:3000/openai/v1`
- Anthropic: `http://localhost:3000/anthropic`

## 🏗️ Architecture

- **Frontend**: HTML5/CSS3, JavaScript with Socket.IO
- **Backend**: Flask with Socket.IO for real-time communication
- **AI Integration**: OpenAI and Anthropic SDKs
- **Security**: Full Lasso Proxy security stack integration

## 🔍 API Endpoints

- `GET /` - Chat interface
- `GET /api/messages` - Get messages
- `POST /api/messages` - Send message
- `POST /api/chatgpt` - ChatGPT request
- `POST /api/anthropic` - Claude request
- `GET /api/users` - Active users
- `GET /api/status` - Server status

## 🔒 Security Features

- Rate limiting via token bucket algorithm
- Sensitive data detection (emails, IBANs, IPs)
- Financial content filtering
- Time-based restrictions
- Data sanitization and anonymization
- Session-based user management

## 📝 License

Part of the Lasso Proxy example use case.
