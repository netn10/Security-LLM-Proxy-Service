#!/usr/bin/env python3
"""
Test script for the new moderation feature in app.py
Tests both appropriate and inappropriate messages to verify the AI moderation works.
"""

import requests
import json
import time

BASE_URL = "http://localhost:5000"


def test_message_moderation():
    """Test the message moderation feature"""

    print("🧪 Testing Message Moderation Feature")
    print("=" * 50)

    # Test cases
    test_cases = [
        {
            "name": "Appropriate message",
            "message": "Hello everyone! How are you doing today?",
            "expected": "should be sent as-is",
        },
        {
            "name": "Another appropriate message",
            "message": "This is a friendly conversation about technology.",
            "expected": "should be sent as-is",
        },
        {
            "name": "Potentially inappropriate message",
            "message": "This message contains some strong language that might be flagged.",
            "expected": "might be censored",
        },
        {
            "name": "AI command (should bypass moderation)",
            "message": "/chatgpt explain quantum computing",
            "expected": "should trigger AI response",
        },
    ]

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. Testing: {test_case['name']}")
        print(f"   Message: '{test_case['message']}'")
        print(f"   Expected: {test_case['expected']}")

        try:
            response = requests.post(
                f"{BASE_URL}/api/messages",
                json={"message": test_case["message"]},
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                data = response.json()

                if "censored_message" in data:
                    print(f"   ✅ Result: Message was CENSORED")
                    print(f"      Censored: '{data['censored_message']['message']}'")
                    print(f"      Moderator: '{data['moderator_response']['message']}'")
                elif "status" in data and data["status"] == "AI request processed":
                    print(f"   ✅ Result: AI command processed")
                else:
                    print(f"   ✅ Result: Message sent as-is")
                    print(f"      Sent: '{data['message']}'")
            else:
                print(f"   ❌ Error: HTTP {response.status_code}")
                print(f"      Response: {response.text}")

        except requests.exceptions.ConnectionError:
            print(f"   ❌ Error: Could not connect to server at {BASE_URL}")
            print(f"      Make sure the Flask app is running!")
            break
        except Exception as e:
            print(f"   ❌ Error: {e}")

        # Small delay between tests
        time.sleep(1)

    print(f"\n" + "=" * 50)
    print("🎯 Test Summary:")
    print("- Appropriate messages should be sent as-is")
    print("- Inappropriate messages should be censored with AI moderation")
    print("- AI commands (/chatgpt, /claude) should bypass moderation")
    print("- Random AI selection (ChatGPT/Claude) for moderation")


def test_server_status():
    """Test if the server is running"""
    try:
        response = requests.get(f"{BASE_URL}/api/status")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Server is running")
            print(f"   Status: {data['status']}")
            print(f"   Users: {data['users_count']}")
            print(f"   Messages: {data['messages_count']}")
            print(f"   Lasso Proxy: {'✅' if data['lasso_proxy_configured'] else '❌'}")
            assert True  # Test passes if we reach here
        else:
            print(f"❌ Server returned status {response.status_code}")
            assert False, f"Server returned status {response.status_code}"
    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to server at {BASE_URL}")
        print(f"   Make sure to run: python app.py")
        assert False, "Could not connect to server"


if __name__ == "__main__":
    print("🚀 Lasso Proxy Moderation Test")
    print("Make sure both the Lasso proxy and Flask app are running!")
    print()

    if test_server_status():
        print()
        test_message_moderation()
    else:
        print("\n❌ Cannot run tests - server is not available")
        print("   Start the server with: python app.py")
