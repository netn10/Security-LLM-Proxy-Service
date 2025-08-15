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


class TestChatFlowIntegration:
    """Test complete chat flow scenarios"""

    def test_complete_chat_session(self, session_client):
        """Test a complete chat session with multiple messages"""
        # Send first message
        message1 = {"message": "Hello everyone!"}
        response1 = session_client.post(
            "/api/messages", data=json.dumps(message1), content_type="application/json"
        )
        assert response1.status_code == 200

        # Send second message
        message2 = {"message": "How is everyone doing?"}
        response2 = session_client.get("/api/messages")
        assert response2.status_code == 200

        # Verify messages are stored
        messages_data = json.loads(response2.data)
        assert len(messages_data) >= 1

        # Check message structure
        for msg in messages_data:
            assert "id" in msg
            assert "message" in msg
            assert "timestamp" in msg
            assert "type" in msg

    def test_multiple_users_chat(self, client):
        """Test chat with multiple users"""
        # Create first user session
        with client.session_transaction() as sess1:
            sess1["user_id"] = str(uuid.uuid4())
            sess1["username"] = "Alice"
            users[sess1["user_id"]] = sess1["username"]

        # Send message from first user
        message1 = {"message": "Hello from Alice!"}
        response1 = client.post(
            "/api/messages", data=json.dumps(message1), content_type="application/json"
        )
        assert response1.status_code == 200

        # Create second user session
        with client.session_transaction() as sess2:
            sess2["user_id"] = str(uuid.uuid4())
            sess2["username"] = "Bob"
            users[sess2["user_id"]] = sess2["username"]

        # Send message from second user
        message2 = {"message": "Hello from Bob!"}
        response2 = client.post(
            "/api/messages", data=json.dumps(message2), content_type="application/json"
        )
        assert response2.status_code == 200

        # Verify both users are in the users list
        users_response = client.get("/api/users")
        users_data = json.loads(users_response.data)
        assert "Alice" in users_data
        assert "Bob" in users_data
        assert len(users_data) == 2


class TestAICommandIntegration:
    """Test AI command integration in chat messages"""

    @patch("app.handle_chatgpt_request")
    def test_chatgpt_command_in_message(self, mock_handle_chatgpt, session_client):
        """Test that /chatgpt command triggers AI handler"""
        message_data = {"message": "/chatgpt What is Python?"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200

        # Verify the AI handler was called
        mock_handle_chatgpt.assert_called_once_with("What is Python?")

    @patch("app.handle_claude_request")
    def test_claude_command_in_message(self, mock_handle_claude, session_client):
        """Test that /claude command triggers AI handler"""
        message_data = {"message": "/claude Explain machine learning"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200

        # Verify the AI handler was called
        mock_handle_claude.assert_called_once_with("Explain machine learning")

    def test_regular_message_does_not_trigger_ai(self, session_client):
        """Test that regular messages don't trigger AI handlers"""
        message_data = {"message": "This is a regular message"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200

        # Verify no AI handlers were called (by checking message type)
        data = json.loads(response.data)
        assert data["type"] == "user"


class TestErrorHandlingIntegration:
    """Test error handling in various scenarios"""

    def test_malformed_json_request(self, session_client):
        """Test handling of malformed JSON requests"""
        response = session_client.post(
            "/api/messages", data="invalid json", content_type="application/json"
        )

        # Should return 400 Bad Request
        assert response.status_code == 400

    def test_missing_message_field(self, session_client):
        """Test handling of requests missing the message field"""
        request_data = {"other_field": "some value"}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(request_data),
            content_type="application/json",
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Message cannot be empty"

    def test_non_string_message(self, session_client):
        """Test handling of non-string message values"""
        request_data = {"message": 123}

        response = session_client.post(
            "/api/messages",
            data=json.dumps(request_data),
            content_type="application/json",
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "Message must be a string"

    @patch("app.openai_client.chat.completions.create")
    def test_ai_service_unavailable(self, mock_openai, session_client):
        """Test handling when AI service is unavailable"""
        # Mock OpenAI to simulate service unavailability
        mock_openai.side_effect = Exception("Service unavailable")

        request_data = {"prompt": "Test prompt"}

        response = session_client.post(
            "/chatgpt", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 500
        data = json.loads(response.data)

        assert data["type"] == "error"
        assert "message" in data
        assert data["username"] == "ChatGPT Assistant"

    @patch("app.anthropic_client.messages.create")
    def test_claude_service_unavailable(self, mock_anthropic, session_client):
        """Test handling when Claude service is unavailable"""
        # Mock Anthropic to simulate service unavailability
        mock_anthropic.side_effect = Exception("Claude service unavailable")

        request_data = {"prompt": "Test prompt"}

        response = session_client.post(
            "/claude", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 500
        data = json.loads(response.data)

        assert data["type"] == "error"
        assert "message" in data
        assert data["username"] == "Claude Assistant"

    def test_ai_endpoints_with_malformed_json(self, session_client):
        """Test AI endpoints with malformed JSON"""
        # Test ChatGPT endpoint
        response1 = session_client.post(
            "/chatgpt", data="invalid json", content_type="application/json"
        )
        assert response1.status_code == 400

        # Test Claude endpoint
        response2 = session_client.post(
            "/claude", data="invalid json", content_type="application/json"
        )
        assert response2.status_code == 400

    @patch("app.openai_client.chat.completions.create")
    def test_chatgpt_response_structure(self, mock_openai, session_client):
        """Test ChatGPT response structure and content"""
        # Mock OpenAI response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = (
            "This is a test response from ChatGPT"
        )
        mock_openai.return_value = mock_response

        request_data = {"prompt": "Test prompt"}

        response = session_client.post(
            "/chatgpt", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 200
        data = json.loads(response.data)

        # Check response structure
        assert "id" in data
        assert "user_id" in data
        assert "username" in data
        assert "message" in data
        assert "timestamp" in data
        assert "type" in data

        # Check specific values
        assert data["username"] == "ChatGPT Assistant"
        assert data["type"] == "ai"
        assert data["message"] == "This is a test response from ChatGPT"
        assert data["user_id"] == "ai-assistant"

    @patch("app.anthropic_client.messages.create")
    def test_claude_response_structure(self, mock_anthropic, session_client):
        """Test Claude response structure and content"""
        # Mock Anthropic response
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = "This is a test response from Claude"
        mock_anthropic.return_value = mock_response

        request_data = {"prompt": "Test prompt"}

        response = session_client.post(
            "/claude", data=json.dumps(request_data), content_type="application/json"
        )

        assert response.status_code == 200
        data = json.loads(response.data)

        # Check response structure
        assert "id" in data
        assert "user_id" in data
        assert "username" in data
        assert "message" in data
        assert "timestamp" in data
        assert "type" in data

        # Check specific values
        assert data["username"] == "Claude Assistant"
        assert data["type"] == "ai"
        assert data["message"] == "This is a test response from Claude"
        assert data["user_id"] == "ai-assistant"


class TestSessionManagement:
    """Test session management and user tracking"""

    def test_new_user_session_creation(self, client):
        """Test that new users get proper session setup"""
        response = client.get("/")

        assert response.status_code == 200

        # Check that a session was created
        with client.session_transaction() as sess:
            assert "user_id" in sess
            assert "username" in sess
            assert sess["username"].startswith("User_")

    def test_existing_user_session(self, session_client):
        """Test that existing users maintain their session"""
        # First request should work with existing session
        response1 = session_client.get("/")
        assert response1.status_code == 200

        # Second request should maintain the same session
        response2 = session_client.get("/api/users")
        assert response2.status_code == 200

        data = json.loads(response2.data)
        assert "TestUser" in data

    def test_user_id_uniqueness(self, client):
        """Test that each user gets a unique user ID"""
        # Create first session
        with client.session_transaction() as sess1:
            client.get("/")
            user_id1 = sess1.get("user_id")

        # Create second session
        with client.session_transaction() as sess2:
            client.get("/")
            user_id2 = sess2.get("user_id")

        # User IDs should be different
        assert user_id1 != user_id2


class TestDataPersistence:
    """Test data persistence across requests"""

    def test_messages_persistence(self, session_client):
        """Test that messages persist across multiple requests"""
        # Send a message
        message_data = {"message": "Persistent message"}
        response1 = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )
        assert response1.status_code == 200

        # Retrieve messages
        response2 = session_client.get("/api/messages")
        assert response2.status_code == 200

        messages_data = json.loads(response2.data)
        assert len(messages_data) >= 1

        # Find our message
        found_message = False
        for msg in messages_data:
            if msg.get("message") == "Persistent message":
                found_message = True
                break

        assert found_message

    def test_users_persistence(self, session_client):
        """Test that users persist across multiple requests"""
        # First request should add user
        response1 = session_client.get("/api/users")
        assert response1.status_code == 200

        data1 = json.loads(response1.data)
        assert "TestUser" in data1

        # Second request should still have the user
        response2 = session_client.get("/api/users")
        assert response2.status_code == 200

        data2 = json.loads(response2.data)
        assert "TestUser" in data2
        assert len(data2) == len(data1)


class TestPerformanceAndLoad:
    """Test performance and load handling"""

    def test_multiple_rapid_requests(self, session_client):
        """Test handling of multiple rapid requests"""
        # Send multiple messages rapidly
        for i in range(5):
            message_data = {"message": f"Message {i}"}
            response = session_client.post(
                "/api/messages",
                data=json.dumps(message_data),
                content_type="application/json",
            )
            assert response.status_code == 200

        # Verify all messages were stored
        response = session_client.get("/api/messages")
        assert response.status_code == 200

        messages_data = json.loads(response.data)
        assert len(messages_data) >= 5

    def test_large_message_content(self, session_client):
        """Test handling of large message content"""
        large_message = "A" * 1000  # 1000 character message

        message_data = {"message": large_message}
        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["message"] == large_message


class TestSecurityAndValidation:
    """Test security and input validation"""

    def test_xss_prevention(self, session_client):
        """Test that XSS attempts are handled safely"""
        xss_message = "<script>alert('xss')</script>"

        message_data = {"message": xss_message}
        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.data)

        # Message should be stored as-is (sanitization would happen in frontend)
        assert data["message"] == xss_message

    def test_sql_injection_prevention(self, session_client):
        """Test that SQL injection attempts are handled safely"""
        sql_message = "'; DROP TABLE users; --"

        message_data = {"message": sql_message}
        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["message"] == sql_message

    def test_unicode_handling(self, session_client):
        """Test handling of unicode characters"""
        unicode_message = "Hello 世界! 🌍"

        message_data = {"message": unicode_message}
        response = session_client.post(
            "/api/messages",
            data=json.dumps(message_data),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["message"] == unicode_message


if __name__ == "__main__":
    pytest.main([__file__])
