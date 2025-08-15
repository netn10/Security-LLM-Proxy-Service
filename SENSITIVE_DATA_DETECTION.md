# Sensitive Data Detection

## Overview

The Lasso Proxy now includes automatic detection of sensitive data patterns in requests and returns a 403 Forbidden error when such data is detected. This security feature helps prevent the transmission of personal and sensitive information through the proxy.

## Detected Data Types

The system currently detects and blocks the following types of sensitive data:

- **Email Addresses**: Any valid email format (e.g., `user@domain.com`)
- **IBAN Numbers**: International Bank Account Numbers (e.g., `DE89370400440532013000`)
- **IPv4 Addresses**: IP addresses in standard format (e.g., `192.168.1.100`)

## How It Works

1. **Detection**: When a request is made to supported endpoints (like `/chat/completions`), the system uses LLM-based detection to identify sensitive data patterns in the request payload.

2. **Blocking**: If sensitive data is detected, the request is immediately blocked with a 403 Forbidden response.

3. **Logging**: All blocked requests are logged with the action type `BLOCKED_SENSITIVE_DATA`.

4. **Monitoring**: Blocked requests are broadcast to the monitoring dashboard for real-time visibility.

## Response Format

When sensitive data is detected, the proxy returns a 403 response with the following structure:

```json
{
  "error": {
    "message": "Your request contains sensitive data that is not allowed: email, iban. For security reasons, this type of content is blocked. Please remove any sensitive information such as email addresses, IBAN numbers, IP addresses, or other personal identifiers from your request.",
    "code": "SENSITIVE_DATA_BLOCKED",
    "details": {
      "detected_types": ["email", "iban"],
      "suggestion": "Remove all sensitive data from your request before resubmitting.",
      "blocked_data_types": [
        "Email addresses",
        "IBAN numbers",
        "IP addresses",
        "Credit card numbers",
        "Social security numbers",
        "Phone numbers",
        "Personal identifiers"
      ],
      "allowed_content": [
        "General text and content",
        "Non-personal information",
        "Public data",
        "Anonymized content"
      ]
    }
  }
}
```

## Configuration

The sensitive data detection can be controlled via environment variables:

- `ENABLE_DATA_SANITIZATION`: Set to `true` (default) to enable detection
- `OPENAI_API_KEY`: Required for LLM-based detection
- `OPENAI_API_URL`: OpenAI API endpoint (default: `https://api.openai.com`)

## Supported Endpoints

Sensitive data detection is currently applied to:
- `/proxy/openai/v1/chat/completions`
- `/proxy/anthropic/v1/messages`

## Testing

You can test the sensitive data detection using the provided test file:

```bash
node test/test-sensitive-data.js
```

This test includes various scenarios:
- Email address detection
- IBAN number detection
- IP address detection
- Multiple sensitive data types
- Clean content (should pass)

## Example Usage

### Request with Email (Will be blocked)
```bash
curl -X POST http://localhost:3000/proxy/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-key" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Please help me with my email: john.doe@example.com"
      }
    ]
  }'
```

**Response**: 403 Forbidden with detailed error message

### Request without Sensitive Data (Will pass)
```bash
curl -X POST http://localhost:3000/proxy/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-key" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you today?"
      }
    ]
  }'
```

**Response**: Normal proxy response

## Security Benefits

- **Data Protection**: Prevents accidental transmission of sensitive information
- **Compliance**: Helps meet data protection requirements
- **Audit Trail**: All blocked requests are logged for compliance purposes
- **Real-time Monitoring**: Dashboard provides visibility into blocked requests

## Future Enhancements

The system is designed to be easily extensible. Additional sensitive data types can be added by:
1. Updating the LLM detection prompt
2. Adding new placeholder mappings
3. Extending the exception handling

## Troubleshooting

If you're getting unexpected 403 errors:
1. Check the error response for specific detected data types
2. Review your request payload for any sensitive information
3. Ensure the detection is working as expected by testing with known patterns
4. Check the server logs for detailed information about blocked requests
