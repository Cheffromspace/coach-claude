"""Global pytest fixtures and configuration."""
import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
import pytest_asyncio

@pytest_asyncio.fixture
def mock_mcp_client():
    """Fixture providing a mock MCP client for testing."""
    client = MagicMock()
    client.connect = MagicMock(return_value=None)
    client.disconnect = MagicMock(return_value=None)
    client.send_message = MagicMock(return_value={"status": "success"})
    return client

@pytest_asyncio.fixture
def mock_config():
    """Fixture providing mock configuration for testing."""
    return {
        "mcpServers": {
            "test-server": {
                "command": "node",
                "args": ["test-server.js"],
                "env": {}
            }
        }
    }

@pytest_asyncio.fixture
async def mock_anthropic_response():
    """Fixture providing a mock Anthropic API response."""
    from anthropic.types import Message, ContentBlock
    return Message(
        id="msg_test",
        content=[ContentBlock(type="text", text="Test response")],
        role="assistant",
        model="claude-3-5-sonnet-20241022"
    )

@pytest.fixture(scope="function")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()
