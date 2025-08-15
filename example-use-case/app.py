from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import openai
import anthropic
import os
from dotenv import load_dotenv
from datetime import datetime
import uuid
import json
import ast
from pathlib import Path
import random


# Load environment variables from the current directory's .env file
current_dir = Path(__file__).parent
load_dotenv(current_dir / ".env")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY") or "your-secret-key-here"
socketio = SocketIO(app, cors_allowed_origins="*")

# Configure OpenAI client to use Lasso proxy (include /v1 in base_url)
openai_client = openai.OpenAI(
    api_key=os.getenv("OPENAI_API_KEY") or "sk-client-placeholder",
    base_url="http://localhost:3000/openai/v1",
)

# Configure Anthropic client to use Lasso proxy
anthropic_client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY") or "sk-client-placeholder",
    base_url="http://localhost:3000/anthropic",
)


# In-memory storage for messages and users
messages = []
users = {}  # user_id -> username
active_sessions = {}  # session_id -> user_id
user_sessions = {}  # user_id -> session_id


def extract_error_message(error: Exception) -> str:
    """Best-effort extraction of a human-friendly error message from SDK/HTTP errors.

    Prefers an `{"error": {"message": ...}}` JSON body if available. Falls back to the
    exception's string message.
    """
    # 1) SDKs often expose an HTTP response with a JSON body
    response = getattr(error, "response", None)
    if response is not None:
        # httpx.Response or similar
        try:
            body = response.json()
            if isinstance(body, dict):
                err_block = body.get("error")
                if isinstance(err_block, dict) and "message" in err_block:
                    return str(err_block.get("message"))
                # Sometimes message is top-level
                if "message" in body:
                    return str(body.get("message"))
        except Exception:
            pass

        try:
            # As a fallback, try text then JSON parse
            text = response.text
            if text:
                try:
                    body = json.loads(text)
                    if isinstance(body, dict):
                        err_block = body.get("error")
                        if isinstance(err_block, dict) and "message" in err_block:
                            return str(err_block.get("message"))
                        if "message" in body:
                            return str(body.get("message"))
                except Exception:
                    pass
        except Exception:
            pass

    # 2) Some SDK errors expose a structured body directly
    body = getattr(error, "body", None)
    if isinstance(body, dict):
        err_block = body.get("error")
        if isinstance(err_block, dict) and "message" in err_block:
            return str(err_block.get("message"))
        if "message" in body:
            return str(body.get("message"))

    # 3) Attempt to extract a Python-dict-like payload from the exception string
    #    e.g. "Error code: 403 - {'error': {'message': '...'}}"
    try:
        s = str(error)
        brace_index = s.find("{")
        if brace_index != -1:
            maybe_dict = s[brace_index:]
            parsed = ast.literal_eval(maybe_dict)
            if isinstance(parsed, dict):
                err_block = parsed.get("error")
                if isinstance(err_block, dict) and "message" in err_block:
                    return str(err_block.get("message"))
                if "message" in parsed:
                    return str(parsed.get("message"))
    except Exception:
        pass

    # 4) Last resort: string form of the error
    return str(error)


def generate_unique_username():
    """Generate a unique username for new users"""
    existing_usernames = set(users.values())
    base_name = "User"
    counter = 1

    while f"{base_name}_{counter}" in existing_usernames:
        counter += 1

    return f"{base_name}_{counter}"


@app.route("/")
def index():
    """Main chat interface"""
    if "user_id" not in session:
        session["user_id"] = str(uuid.uuid4())
        session["username"] = generate_unique_username()
        users[session["user_id"]] = session["username"]

    return render_template(
        "index.html", username=session["username"], messages=messages[-50:]
    )  # Show last 50 messages


@app.route("/api/messages", methods=["GET"])
def get_messages():
    """Get all messages"""
    return jsonify(messages)


def process_message_through_proxy(message_text):
    """Process message through Lasso proxy to leverage all security features"""
    try:
        # Use a simple content generation request to trigger proxy security checks
        # The proxy will apply rate limiting, sensitive data detection, time blocking, etc.
        use_chatgpt = random.choice([True, False])

        if use_chatgpt:
            # Route through OpenAI proxy endpoint
            openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant. Simply acknowledge receipt of the user's message with a brief, positive response.",
                    },
                    {
                        "role": "user",
                        "content": message_text,
                    },
                ],
                max_tokens=50,
            )
            # If we get here, the proxy allowed the request
            return {"allowed": True, "proxy_response": None, "llm_used": "ChatGPT"}
        else:
            # Route through Anthropic proxy endpoint
            anthropic_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=50,
                messages=[
                    {
                        "role": "user",
                        "content": f"Simply acknowledge this message briefly: {message_text}",
                    }
                ],
            )
            # If we get here, the proxy allowed the request
            return {"allowed": True, "proxy_response": None, "llm_used": "Claude"}

    except Exception as e:
        # Parse proxy-specific errors
        error_message = extract_error_message(e)
        error_lower = error_message.lower()

        # Detect specific proxy blocks
        llm_name = "ChatGPT" if use_chatgpt else "Claude"

        if "rate limit" in error_lower or "too many requests" in error_lower:
            return {
                "allowed": False,
                "block_type": "rate_limit",
                "message": "Message rate limit exceeded. Please slow down your messaging.",
                "proxy_response": error_message,
                "llm_used": llm_name,
            }
        elif (
            "sensitive data" in error_lower
            or "email" in error_lower
            or "iban" in error_lower
        ):
            return {
                "allowed": False,
                "block_type": "sensitive_data",
                "message": "Message contains sensitive information that cannot be shared in chat.",
                "proxy_response": error_message,
                "llm_used": llm_name,
            }
        elif (
            "financial" in error_lower
            or "blocked" in error_lower
            and "financial" in error_lower
        ):
            return {
                "allowed": False,
                "block_type": "financial_content",
                "message": "Message contains financial content that is not allowed in chat.",
                "proxy_response": error_message,
                "llm_used": llm_name,
            }
        elif "time" in error_lower and "blocked" in error_lower:
            return {
                "allowed": False,
                "block_type": "time_blocked",
                "message": "Chat is currently blocked during this time period.",
                "proxy_response": error_message,
                "llm_used": llm_name,
            }
        elif "403" in error_lower or "forbidden" in error_lower:
            return {
                "allowed": False,
                "block_type": "policy_violation",
                "message": "Message violates content policy and cannot be sent.",
                "proxy_response": error_message,
                "llm_used": llm_name,
            }
        else:
            # Unknown error - log it but allow the message
            print(f"Unknown proxy error: {error_message}")
            return {"allowed": True, "proxy_response": None, "llm_used": llm_name}


def censor_message(message_text):
    """Censor a message by replacing most content with asterisks while preserving structure"""
    # Replace most characters with asterisks, keep some for readability
    words = message_text.split()
    censored_words = []

    for word in words:
        if len(word) <= 2:
            # Keep very short words as-is (like "a", "is", "to", etc.)
            censored_words.append(word)
        elif len(word) <= 4:
            # For short words, keep first character and replace rest with asterisks
            censored = word[0] + "*" * (len(word) - 1)
            censored_words.append(censored)
        else:
            # For longer words, keep first and last character, replace middle with asterisks
            censored = word[0] + "*" * (len(word) - 2) + word[-1]
            censored_words.append(censored)

    censored_text = " ".join(censored_words)

    # Add a note indicating the message was censored
    return f"[CENSORED] {censored_text}"


def generate_proxy_response(block_type, detailed_reason):
    """Return the proxy's own error message directly"""
    # The proxy already provides detailed, appropriate error messages
    # Just return what the proxy gave us
    return detailed_reason


@app.route("/api/messages", methods=["POST"])
def send_message():
    """Send a new message"""
    data = request.get_json()
    message_value = data.get("message", "")

    # Ensure message is a string
    if not isinstance(message_value, str):
        return jsonify({"error": "Message must be a string"}), 400

    message_text = message_value.strip()

    if not message_text:
        return jsonify({"error": "Message cannot be empty"}), 400

    # Check if message contains AI trigger (existing functionality)
    if message_text.lower().startswith("/chatgpt "):
        ai_prompt = message_text[9:]  # Remove '/chatgpt ' prefix
        handle_chatgpt_request(ai_prompt)
        return jsonify({"status": "AI request processed"})
    elif message_text.lower().startswith("/claude "):
        ai_prompt = message_text[8:]  # Remove '/claude ' prefix
        handle_claude_request(ai_prompt)
        return jsonify({"status": "AI request processed"})

    # Process message through Lasso proxy security checks
    proxy_result = process_message_through_proxy(message_text)

    if proxy_result["allowed"]:
        # Message passed all proxy security checks - send as-is
        message = {
            "id": str(uuid.uuid4()),
            "user_id": session.get("user_id"),
            "username": session.get("username"),
            "message": message_text,
            "timestamp": datetime.now().isoformat(),
            "type": "user",
        }

        messages.append(message)
        socketio.emit("new_message", message)

        return jsonify(message)
    else:
        # Message was blocked by proxy - censor the message and store it
        block_type = proxy_result.get("block_type", "unknown")
        block_message = proxy_result.get(
            "message", "Message blocked by security system"
        )
        detailed_reason = proxy_result.get("proxy_response", "")
        llm_used = proxy_result.get("llm_used", "Security System")

        # Censor the original message instead of deleting it
        censored_text = censor_message(message_text)

        # Create the censored user message
        censored_message = {
            "id": str(uuid.uuid4()),
            "user_id": session.get("user_id"),
            "username": session.get("username"),
            "message": censored_text,
            "timestamp": datetime.now().isoformat(),
            "type": "user_censored",
            "original_blocked": True,
            "block_type": block_type,
        }

        messages.append(censored_message)
        socketio.emit("new_message", censored_message)

        # Generate appropriate system response based on block type
        system_response = generate_proxy_response(block_type, detailed_reason)

        # Create system message explaining the block
        system_message = {
            "id": str(uuid.uuid4()),
            "user_id": "proxy-security",
            "username": f"🛡️ {llm_used}",
            "message": system_response,
            "timestamp": datetime.now().isoformat(),
            "type": "security_block",
            "block_type": block_type,
            "reason": block_message,
        }

        messages.append(system_message)
        socketio.emit("new_message", system_message)

        # Return the censored message instead of an error
        return jsonify(censored_message)


@app.route("/chatgpt", methods=["POST"])
def chatgpt_request():
    """Handle ChatGPT (OpenAI) requests"""
    data = request.get_json()
    prompt_value = data.get("prompt", "")

    # Ensure prompt is a string
    if not isinstance(prompt_value, str):
        return jsonify({"error": "Prompt must be a string"}), 400

    prompt = prompt_value.strip()

    if not prompt:
        return jsonify({"error": "Prompt cannot be empty"}), 400

    try:
        # Use OpenAI through Lasso proxy
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant in a chat application. Keep responses concise and friendly.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=150,
        )

        ai_message = {
            "id": str(uuid.uuid4()),
            "user_id": "ai-assistant",
            "username": "ChatGPT Assistant",
            "message": response.choices[0].message.content,
            "timestamp": datetime.now().isoformat(),
            "type": "ai",
        }

        messages.append(ai_message)
        socketio.emit("new_message", ai_message)

        return jsonify(ai_message)

    except Exception as e:
        human_message = extract_error_message(e)
        error_message = {
            "id": str(uuid.uuid4()),
            "user_id": "ai-assistant",
            "username": "ChatGPT Assistant",
            "message": human_message,
            "timestamp": datetime.now().isoformat(),
            "type": "error",
        }

        messages.append(error_message)
        socketio.emit("new_message", error_message)

        return jsonify(error_message), 500


@app.route("/claude", methods=["POST"])
def claude_request():
    """Handle Claude (Anthropic) requests"""
    data = request.get_json()
    prompt_value = data.get("prompt", "")

    # Ensure prompt is a string
    if not isinstance(prompt_value, str):
        return jsonify({"error": "Prompt must be a string"}), 400

    prompt = prompt_value.strip()

    if not prompt:
        return jsonify({"error": "Prompt cannot be empty"}), 400

    try:
        response = anthropic_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=150,
            messages=[
                {
                    "role": "user",
                    "content": f"Please respond to this chat message: {prompt}",
                }
            ],
        )

        ai_message = {
            "id": str(uuid.uuid4()),
            "user_id": "ai-assistant",
            "username": "Claude Assistant",
            "message": response.content[0].text.strip(),
            "timestamp": datetime.now().isoformat(),
            "type": "ai",
        }

        messages.append(ai_message)
        socketio.emit("new_message", ai_message)

        return jsonify(ai_message)

    except Exception as e:
        human_message = extract_error_message(e)
        error_message = {
            "id": str(uuid.uuid4()),
            "user_id": "ai-assistant",
            "username": "Claude Assistant",
            "message": human_message,
            "timestamp": datetime.now().isoformat(),
            "type": "error",
        }

        messages.append(error_message)
        socketio.emit("new_message", error_message)

        return jsonify(error_message), 500


def handle_chatgpt_request(prompt):
    """Handle ChatGPT requests triggered by /chatgpt command"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant in a chat application. Keep responses concise and friendly.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=150,
        )

        ai_message = {
            "id": str(uuid.uuid4()),
            "user_id": "ai-assistant",
            "username": "ChatGPT Assistant",
            "message": response.choices[0].message.content,
            "timestamp": datetime.now().isoformat(),
            "type": "ai",
        }

        messages.append(ai_message)
        socketio.emit("new_message", ai_message)

    except Exception as e:
        human_message = extract_error_message(e)
        error_message = {
            "id": str(uuid.uuid4()),
            "user_id": "ai-assistant",
            "username": "ChatGPT Assistant",
            "message": human_message,
            "timestamp": datetime.now().isoformat(),
            "type": "error",
        }

        messages.append(error_message)
        socketio.emit("new_message", error_message)


def handle_claude_request(prompt):
    """Handle Claude requests triggered by /claude command"""
    try:
        response = anthropic_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=150,
            messages=[
                {
                    "role": "user",
                    "content": f"Please respond to this chat message: {prompt}",
                }
            ],
        )

        ai_message = {
            "id": str(uuid.uuid4()),
            "user_id": "ai-assistant",
            "username": "Claude Assistant",
            "message": response.content[0].text.strip(),
            "timestamp": datetime.now().isoformat(),
            "type": "ai",
        }

        messages.append(ai_message)
        socketio.emit("new_message", ai_message)

    except Exception as e:
        human_message = extract_error_message(e)
        error_message = {
            "id": str(uuid.uuid4()),
            "user_id": "ai-assistant",
            "username": "Claude Assistant",
            "message": human_message,
            "timestamp": datetime.now().isoformat(),
            "type": "error",
        }

        messages.append(error_message)
        socketio.emit("new_message", error_message)


# Backward-compatible endpoints
@app.route("/api/ai", methods=["POST"])
def ai_request():
    """Deprecated: use /chatgpt or /claude. Defaults to ChatGPT."""
    return chatgpt_request()


@app.route("/api/chatgpt", methods=["POST"])
def api_chatgpt_request():
    """Backward-compatible: use /chatgpt instead."""
    return chatgpt_request()


@app.route("/api/anthropic", methods=["POST"])
def api_anthropic_request():
    """Backward-compatible: use /claude instead."""
    return claude_request()


@app.route("/api/users", methods=["GET"])
def get_users():
    """Get list of active users"""
    return jsonify(list(users.values()))


@app.route("/api/status", methods=["GET"])
def get_status():
    """Get application status"""
    return jsonify(
        {
            "status": "online",
            "users_count": len(users),
            "messages_count": len(messages),
            "lasso_proxy_configured": True,
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.route("/api/debug/users", methods=["GET"])
def debug_users():
    """Debug endpoint to show detailed user information"""
    return jsonify(
        {
            "users_dict": users,
            "active_sessions": active_sessions,
            "user_sessions": user_sessions,
            "total_users": len(users),
            "total_active_sessions": len(active_sessions),
            "total_user_sessions": len(user_sessions),
        }
    )


# Socket.IO events
@socketio.on("connect")
def handle_connect():
    """Handle client connection"""
    session_id = request.sid
    user_id = session.get("user_id")
    username = session.get("username")

    if user_id and username:
        # Ensure user is in the users dictionary
        if user_id not in users:
            users[user_id] = username

        # Store session mapping
        active_sessions[session_id] = user_id
        user_sessions[user_id] = session_id

        # Join the general room
        join_room("general")

        # Emit user joined event
        socketio.emit(
            "user_joined",
            {
                "user_id": user_id,
                "username": username,
                "timestamp": datetime.now().isoformat(),
            },
            room="general",
        )

        print(f"Client connected: {session_id} (User: {username})")
        emit("status", {"message": "Connected to chat server"})
    else:
        print(f"Client connected without session: {session_id}")


@socketio.on("disconnect")
def handle_disconnect():
    """Handle client disconnection"""
    session_id = request.sid
    user_id = active_sessions.get(session_id)

    if user_id:
        username = users.get(user_id)

        # Remove session mappings
        del active_sessions[session_id]
        if user_id in user_sessions:
            del user_sessions[user_id]

        # Check if user has other active sessions
        if user_id not in user_sessions:
            # User has no more active sessions, remove from users dict and emit user left event
            if user_id in users:
                del users[user_id]

            socketio.emit(
                "user_left",
                {
                    "user_id": user_id,
                    "username": username,
                    "timestamp": datetime.now().isoformat(),
                },
                room="general",
            )

            print(f"User disconnected: {username} (Session: {session_id})")
        else:
            print(f"Session disconnected: {session_id} (User: {username})")
    else:
        print(f"Unknown session disconnected: {session_id}")


@socketio.on("join")
def handle_join(data):
    """Handle user joining a room"""
    room = data.get("room", "general")
    join_room(room)
    emit("status", {"message": f"Joined room: {room}"}, room=room)


@socketio.on("leave")
def handle_leave(data):
    """Handle user leaving a room"""
    room = data.get("room", "general")
    leave_room(room)
    emit("status", {"message": f"Left room: {room}"}, room=room)


@socketio.on("typing")
def handle_typing():
    """Handle typing indicator"""
    username = session.get("username")
    if username:
        socketio.emit(
            "user_typing",
            {"username": username, "timestamp": datetime.now().isoformat()},
            room="general",
            include_self=False,
        )


@socketio.on("stop_typing")
def handle_stop_typing():
    """Handle stop typing indicator"""
    # This could be used to remove specific user from typing indicator
    pass


if __name__ == "__main__":
    print("🚀 Starting NatiChat App...")
    print("📡 Configured to use Lasso Proxy at http://localhost:3000")
    print("💬 Chat interface available at http://localhost:5000")
    print("🤖 AI commands: '/chatgpt <prompt>' or '/claude <prompt>'")
    print("🌙 Dark mode enabled by default")
    print("👥 Multi-user support with real-time user tracking")

    socketio.run(app, debug=False, host="0.0.0.0", port=5000)
