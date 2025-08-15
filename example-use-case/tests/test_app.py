import pytest
import json
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock
from app import app, messages, users, active_sessions, user_sessions


@pytest.fixture
def client():
    """Create a test client for the Flask app"""
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.test_client() as client:
        with app.app_context():
            # Clear global state before each test
            messages.clear()
            users.clear()
            active_sessions.clear()
            user_sessions.clear()
            yield client


@pytest.fixture
def session_client(client):
    """Create a test client with session support"""
    with client.session_transaction() as sess:
        sess["user_id"] = str(uuid.uuid4())
        sess["username"] = "TestUser"
        users[sess["user_id"]] = sess["username"]
    return client


@pytest.fixture(autouse=True)
def mock_proxy_processing():
    """Mock the proxy processing to allow all messages during testing"""
    with patch("app.process_message_through_proxy") as mock_process:
        # By default, allow all messages to pass through
        mock_process.return_value = {
            "allowed": True,
            "proxy_response": None,
            "llm_used": "Test",
        }
        yield mock_process


@pytest.fixture(autouse=True)
def mock_ai_clients():
    """Mock AI client calls to prevent actual API requests during testing"""
    with patch("app.openai_client") as mock_openai, patch(
        "app.anthropic_client"
    ) as mock_anthropic:
        # Mock OpenAI response
        mock_openai_response = MagicMock()
        mock_openai_response.choices = [MagicMock()]
        mock_openai_response.choices[0].message.content = "Test response from ChatGPT"
        mock_openai.chat.completions.create.return_value = mock_openai_response

        # Mock Anthropic response
        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock()]
        mock_anthropic_response.content[0].text = "Test response from Claude"
        mock_anthropic.messages.create.return_value = mock_anthropic_response

        yield mock_openai, mock_anthropic


class TestMessageHandling:
    """Test message handling functionality"""

    def test_send_message_success(self, session_client):
        """Test successful message sending"""
        message_data = {"message": "Hello, world!"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.data)

        # Check response structure
        assert "id" in data
        assert data["message"] == "Hello, world!"
        assert data["type"] == "user"
        assert "timestamp" in data

        # Check that message was added to global messages list
        assert len(messages) == 1
        assert messages[0]["message"] == "Hello, world!"

    def test_send_empty_message(self, session_client):
        """Test sending empty message returns error"""
        message_data = {"message": ""}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Message cannot be empty"

    def test_send_whitespace_message(self, session_client):
        """Test sending whitespace-only message returns error"""
        message_data = {"message": "   "}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Message cannot be empty"

    def test_get_messages(self, session_client):
        """Test retrieving messages"""
        # Add some test messages
        test_messages = [
            {
                "id": str(uuid.uuid4()),
                "message": "Test 1",
                "timestamp": datetime.now().isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "message": "Test 2",
                "timestamp": datetime.now().isoformat(),
            },
        ]
        messages.extend(test_messages)

        response = session_client.get("/api/messages")

        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2
        assert data[0]["message"] == "Test 1"
        assert data[1]["message"] == "Test 2"


class TestAPIEndpoints:
    """Test various API endpoints"""

    def test_index_route(self, client):
        """Test main index route"""
        response = client.get("/")
        assert response.status_code == 200
        assert b"username" in response.data or b"User_" in response.data

    def test_get_users(self, session_client):
        """Test getting users list"""
        response = session_client.get("/api/users")

        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert "TestUser" in data

    def test_get_status(self, session_client):
        """Test status endpoint"""
        response = session_client.get("/api/status")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert data["status"] == "online"
        assert "users_count" in data
        assert "messages_count" in data
        assert data["lasso_proxy_configured"] == True
        assert "timestamp" in data

    def test_debug_users(self, session_client):
        """Test debug users endpoint"""
        response = session_client.get("/api/debug/users")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert "users_dict" in data
        assert "active_sessions" in data
        assert "user_sessions" in data
        assert "total_users" in data
        assert "total_active_sessions" in data
        assert "total_user_sessions" in data


class TestAIEndpoints:
    """Test AI-related endpoints"""

    @patch("app.openai_client.chat.completions.create")
    def test_chatgpt_request_success(self, mock_openai, session_client):
        """Test successful ChatGPT request"""
        # Mock OpenAI response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Hello from ChatGPT!"
        mock_openai.return_value = mock_response

        request_data = {"prompt": "Hello, ChatGPT!"}

        response = session_client.post(
            "/chatgpt", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 200
        data = json.loads(response.data)

        assert data["message"] == "Hello from ChatGPT!"
        assert data["username"] == "ChatGPT Assistant"
        assert data["type"] == "ai"

        # Verify OpenAI was called correctly
        mock_openai.assert_called_once()
        call_args = mock_openai.call_args
        assert call_args[1]["model"] == "gpt-3.5-turbo"
        assert call_args[1]["max_tokens"] == 150

    def test_chatgpt_empty_prompt(self, session_client):
        """Test ChatGPT request with empty prompt"""
        request_data = {"prompt": ""}

        response = session_client.post(
            "/chatgpt", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Prompt cannot be empty"

    def test_chatgpt_non_string_prompt(self, session_client):
        """Test ChatGPT request with non-string prompt"""
        request_data = {"prompt": 123}

        response = session_client.post(
            "/chatgpt", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Prompt must be a string"

    @patch("app.anthropic_client.messages.create")
    def test_claude_request_success(self, mock_anthropic, session_client):
        """Test successful Claude request"""
        # Mock Anthropic response
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = "Hello from Claude!"
        mock_anthropic.return_value = mock_response

        request_data = {"prompt": "Hello, Claude!"}

        response = session_client.post(
            "/claude", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 200
        data = json.loads(response.data)

        assert data["message"] == "Hello from Claude!"
        assert data["username"] == "Claude Assistant"
        assert data["type"] == "ai"

        # Verify Anthropic was called correctly
        mock_anthropic.assert_called_once()
        call_args = mock_anthropic.call_args
        assert call_args[1]["model"] == "claude-3-haiku-20240307"
        assert call_args[1]["max_tokens"] == 150

    def test_claude_empty_prompt(self, session_client):
        """Test Claude request with empty prompt"""
        request_data = {"prompt": ""}

        response = session_client.post(
            "/claude", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Prompt cannot be empty"

    def test_claude_non_string_prompt(self, session_client):
        """Test Claude request with non-string prompt"""
        request_data = {"prompt": 123}

        response = session_client.post(
            "/claude", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Prompt must be a string"

    @patch("app.openai_client.chat.completions.create")
    def test_chatgpt_error_handling(self, mock_openai, session_client):
        """Test ChatGPT error handling"""
        # Mock OpenAI to raise an exception
        mock_openai.side_effect = Exception("API Error")

        request_data = {"prompt": "Test prompt"}

        response = session_client.post(
            "/chatgpt", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 500
        data = json.loads(response.data)

        assert data["type"] == "error"
        assert data["username"] == "ChatGPT Assistant"
        assert "message" in data

    @patch("app.anthropic_client.messages.create")
    def test_claude_error_handling(self, mock_anthropic, session_client):
        """Test Claude error handling"""
        # Mock Anthropic to raise an exception
        mock_anthropic.side_effect = Exception("Claude API Error")

        request_data = {"prompt": "Test prompt"}

        response = session_client.post(
            "/claude", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 500
        data = json.loads(response.data)

        assert data["type"] == "error"
        assert data["username"] == "Claude Assistant"
        assert "message" in data

    def test_chatgpt_missing_prompt_field(self, session_client):
        """Test ChatGPT request with missing prompt field"""
        request_data = {"other_field": "some value"}

        response = session_client.post(
            "/chatgpt", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Prompt cannot be empty"

    def test_claude_missing_prompt_field(self, session_client):
        """Test Claude request with missing prompt field"""
        request_data = {"other_field": "some value"}

        response = session_client.post(
            "/claude", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Prompt cannot be empty"

    def test_chatgpt_whitespace_prompt(self, session_client):
        """Test ChatGPT request with whitespace-only prompt"""
        request_data = {"prompt": "   "}

        response = session_client.post(
            "/chatgpt", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Prompt cannot be empty"

    def test_claude_whitespace_prompt(self, session_client):
        """Test Claude request with whitespace-only prompt"""
        request_data = {"prompt": "   "}

        response = session_client.post(
            "/claude", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Prompt cannot be empty"

    @patch("app.openai_client.chat.completions.create")
    def test_chatgpt_large_prompt(self, mock_openai, session_client):
        """Test ChatGPT request with large prompt"""
        # Mock OpenAI response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Response to large prompt"
        mock_openai.return_value = mock_response

        large_prompt = "A" * 1000  # 1000 character prompt
        request_data = {"prompt": large_prompt}

        response = session_client.post(
            "/chatgpt", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["message"] == "Response to large prompt"

        # Verify the large prompt was passed correctly
        mock_openai.assert_called_once()
        call_args = mock_openai.call_args
        assert call_args[1]["messages"][1]["content"] == large_prompt

    @patch("app.anthropic_client.messages.create")
    def test_claude_large_prompt(self, mock_anthropic, session_client):
        """Test Claude request with large prompt"""
        # Mock Anthropic response
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = "Response to large prompt"
        mock_anthropic.return_value = mock_response

        large_prompt = "A" * 1000  # 1000 character prompt
        request_data = {"prompt": large_prompt}

        response = session_client.post(
            "/claude", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["message"] == "Response to large prompt"

        # Verify the large prompt was passed correctly
        mock_anthropic.assert_called_once()
        call_args = mock_anthropic.call_args
        assert large_prompt in call_args[1]["messages"][0]["content"]

    @patch("app.openai_client.chat.completions.create")
    def test_chatgpt_unicode_prompt(self, mock_openai, session_client):
        """Test ChatGPT request with unicode prompt"""
        # Mock OpenAI response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Unicode response"
        mock_openai.return_value = mock_response

        unicode_prompt = "Hello 世界! 🌍"
        request_data = {"prompt": unicode_prompt}

        response = session_client.post(
            "/chatgpt", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["message"] == "Unicode response"

        # Verify unicode prompt was handled correctly
        mock_openai.assert_called_once()
        call_args = mock_openai.call_args
        assert call_args[1]["messages"][1]["content"] == unicode_prompt

    @patch("app.anthropic_client.messages.create")
    def test_claude_unicode_prompt(self, mock_anthropic, session_client):
        """Test Claude request with unicode prompt"""
        # Mock Anthropic response
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = "Unicode response"
        mock_anthropic.return_value = mock_response

        unicode_prompt = "Hello 世界! 🌍"
        request_data = {"prompt": unicode_prompt}

        response = session_client.post(
            "/claude", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["message"] == "Unicode response"

        # Verify unicode prompt was handled correctly
        mock_anthropic.assert_called_once()
        call_args = mock_anthropic.call_args
        assert unicode_prompt in call_args[1]["messages"][0]["content"]


class TestAICommandHandlers:
    """Test AI command handlers triggered by chat messages"""

    @patch("app.handle_chatgpt_request")
    def test_chatgpt_command_handler(self, mock_handle_chatgpt, session_client):
        """Test that /chatgpt command triggers the handler"""
        message_data = {"message": "/chatgpt What is Python?"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200

        # Verify the handler was called with the correct prompt
        mock_handle_chatgpt.assert_called_once_with("What is Python?")

    @patch("app.handle_claude_request")
    def test_claude_command_handler(self, mock_handle_claude, session_client):
        """Test that /claude command triggers the handler"""
        message_data = {"message": "/claude Explain machine learning"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200

        # Verify the handler was called with the correct prompt
        mock_handle_claude.assert_called_once_with("Explain machine learning")

    @patch("app.handle_chatgpt_request")
    def test_chatgpt_command_with_complex_prompt(
        self, mock_handle_chatgpt, session_client
    ):
        """Test /chatgpt command with complex prompt"""
        complex_prompt = "Write a Python function that sorts a list of dictionaries by a specific key"
        message_data = {"message": f"/chatgpt {complex_prompt}"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        mock_handle_chatgpt.assert_called_once_with(complex_prompt)

    @patch("app.handle_claude_request")
    def test_claude_command_with_complex_prompt(
        self, mock_handle_claude, session_client
    ):
        """Test /claude command with complex prompt"""
        complex_prompt = (
            "Explain the difference between supervised and unsupervised learning"
        )
        message_data = {"message": f"/claude {complex_prompt}"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        mock_handle_claude.assert_called_once_with(complex_prompt)

    def test_regular_message_does_not_trigger_ai(self, session_client):
        """Test that regular messages don't trigger AI handlers"""
        message_data = {"message": "This is a regular message without AI commands"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["type"] == "user"

    def test_message_with_chatgpt_in_text_but_not_command(self, session_client):
        """Test message containing 'chatgpt' but not as a command"""
        message_data = {"message": "I heard about chatgpt but I'm not sure what it is"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["type"] == "user"

    def test_message_with_claude_in_text_but_not_command(self, session_client):
        """Test message containing 'claude' but not as a command"""
        message_data = {"message": "Claude is another AI assistant like ChatGPT"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["type"] == "user"

    @patch("app.handle_chatgpt_request")
    def test_chatgpt_command_case_insensitive(
        self, mock_handle_chatgpt, session_client
    ):
        """Test that /chatgpt command is case insensitive"""
        message_data = {"message": "/CHATGPT What is Python?"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        mock_handle_chatgpt.assert_called_once_with("What is Python?")

    @patch("app.handle_claude_request")
    def test_claude_command_case_insensitive(self, mock_handle_claude, session_client):
        """Test that /claude command is case insensitive"""
        message_data = {"message": "/CLAUDE Explain machine learning"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        mock_handle_claude.assert_called_once_with("Explain machine learning")


class TestAIHandlerFunctions:
    """Test the internal AI handler functions"""

    @patch("app.openai_client.chat.completions.create")
    def test_handle_chatgpt_request_success(self, mock_openai, session_client):
        """Test successful ChatGPT handler function"""
        # Mock OpenAI response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Python is a programming language"
        mock_openai.return_value = mock_response

        from app import handle_chatgpt_request, messages

        # Clear messages for clean test
        initial_message_count = len(messages)

        # Call the handler function directly
        handle_chatgpt_request("What is Python?")

        # Verify OpenAI was called correctly
        mock_openai.assert_called_once()
        call_args = mock_openai.call_args
        assert call_args[1]["model"] == "gpt-3.5-turbo"
        assert call_args[1]["max_tokens"] == 150
        assert call_args[1]["messages"][1]["content"] == "What is Python?"

        # Verify message was added to global messages
        assert len(messages) == initial_message_count + 1
        last_message = messages[-1]
        assert last_message["message"] == "Python is a programming language"
        assert last_message["username"] == "ChatGPT Assistant"
        assert last_message["type"] == "ai"
        assert last_message["user_id"] == "ai-assistant"
        assert "id" in last_message
        assert "timestamp" in last_message

    @patch("app.anthropic_client.messages.create")
    def test_handle_claude_request_success(self, mock_anthropic, session_client):
        """Test successful Claude handler function"""
        # Mock Anthropic response
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = "Machine learning is a subset of AI"
        mock_anthropic.return_value = mock_response

        from app import handle_claude_request, messages

        # Clear messages for clean test
        initial_message_count = len(messages)

        # Call the handler function directly
        handle_claude_request("What is machine learning?")

        # Verify Anthropic was called correctly
        mock_anthropic.assert_called_once()
        call_args = mock_anthropic.call_args
        assert call_args[1]["model"] == "claude-3-haiku-20240307"
        assert call_args[1]["max_tokens"] == 150
        assert "What is machine learning?" in call_args[1]["messages"][0]["content"]

        # Verify message was added to global messages
        assert len(messages) == initial_message_count + 1
        last_message = messages[-1]
        assert last_message["message"] == "Machine learning is a subset of AI"
        assert last_message["username"] == "Claude Assistant"
        assert last_message["type"] == "ai"
        assert last_message["user_id"] == "ai-assistant"
        assert "id" in last_message
        assert "timestamp" in last_message

    @patch("app.openai_client.chat.completions.create")
    def test_handle_chatgpt_request_error(self, mock_openai, session_client):
        """Test ChatGPT handler function with error"""
        # Mock OpenAI to raise an exception
        mock_openai.side_effect = Exception("API Error")

        from app import handle_chatgpt_request, messages

        # Clear messages for clean test
        initial_message_count = len(messages)

        # Call the handler function directly
        handle_chatgpt_request("What is Python?")

        # Verify error message was added to global messages
        assert len(messages) == initial_message_count + 1
        last_message = messages[-1]
        assert last_message["username"] == "ChatGPT Assistant"
        assert last_message["type"] == "error"
        assert last_message["user_id"] == "ai-assistant"
        assert "message" in last_message
        assert "id" in last_message
        assert "timestamp" in last_message

    @patch("app.anthropic_client.messages.create")
    def test_handle_claude_request_error(self, mock_anthropic, session_client):
        """Test Claude handler function with error"""
        # Mock Anthropic to raise an exception
        mock_anthropic.side_effect = Exception("Claude API Error")

        from app import handle_claude_request, messages

        # Clear messages for clean test
        initial_message_count = len(messages)

        # Call the handler function directly
        handle_claude_request("What is machine learning?")

        # Verify error message was added to global messages
        assert len(messages) == initial_message_count + 1
        last_message = messages[-1]
        assert last_message["username"] == "Claude Assistant"
        assert last_message["type"] == "error"
        assert last_message["user_id"] == "ai-assistant"
        assert "message" in last_message
        assert "id" in last_message
        assert "timestamp" in last_message


class TestBackwardCompatibility:
    """Test backward compatibility endpoints"""

    def test_api_ai_endpoint(self, session_client):
        """Test deprecated /api/ai endpoint redirects to ChatGPT"""
        request_data = {"prompt": "Test prompt"}

        with patch("app.chatgpt_request") as mock_chatgpt:
            mock_chatgpt.return_value = ({}, 200)

            response = session_client.post(
                "/api/ai",
                data=json.dumps(request_data),
                content_type="application/json",
            )

            mock_chatgpt.assert_called_once()

    def test_api_chatgpt_endpoint(self, session_client):
        """Test backward-compatible /api/chatgpt endpoint"""
        request_data = {"prompt": "Test prompt"}

        with patch("app.chatgpt_request") as mock_chatgpt:
            mock_chatgpt.return_value = ({}, 200)

            response = session_client.post(
                "/api/chatgpt",
                data=json.dumps(request_data),
                content_type="application/json",
            )

            mock_chatgpt.assert_called_once()

    def test_api_anthropic_endpoint(self, session_client):
        """Test backward-compatible /api/anthropic endpoint"""
        request_data = {"prompt": "Test prompt"}

        with patch("app.claude_request") as mock_claude:
            mock_claude.return_value = ({}, 200)

            response = session_client.post(
                "/api/anthropic",
                data=json.dumps(request_data),
                content_type="application/json",
            )

            mock_claude.assert_called_once()


class TestUtilityFunctions:
    """Test utility functions"""

    def test_extract_error_message_from_json_response(self):
        """Test error message extraction from JSON response"""
        from app import extract_error_message

        # Mock error with JSON response
        mock_error = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"error": {"message": "Rate limit exceeded"}}
        mock_error.response = mock_response

        result = extract_error_message(mock_error)
        assert result == "Rate limit exceeded"

    def test_extract_error_message_from_string(self):
        """Test error message extraction from string error"""
        from app import extract_error_message

        # Test with string error
        error = Exception("Simple error message")
        result = extract_error_message(error)
        assert result == "Simple error message"

    def test_generate_unique_username(self):
        """Test unique username generation"""
        from app import generate_unique_username

        # Clear users dict
        users.clear()

        # Generate first username
        username1 = generate_unique_username()
        assert username1 == "User_1"

        # Add a user
        users["user1"] = username1

        # Generate second username
        username2 = generate_unique_username()
        assert username2 == "User_2"

        # Add another user
        users["user2"] = username2

        # Generate third username
        username3 = generate_unique_username()
        assert username3 == "User_3"


if __name__ == "__main__":
    pytest.main([__file__])
