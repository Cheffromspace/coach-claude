import pytest
from unittest.mock import Mock, AsyncMock, patch
import anthropic
from mcp_client.processing.query_processor import QueryProcessor

# Mock classes for Anthropic API responses
class MockContent:
    def __init__(self, type, **kwargs):
        self.type = type
        for key, value in kwargs.items():
            setattr(self, key, value)

class MockMessage:
    def __init__(self, id, content, role, model, type, usage):
        self.id = id
        # Convert content list of dicts to list of MockContent objects
        self.content = [
            MockContent(**item) if isinstance(item, dict) else item 
            for item in content
        ]
        self.role = role
        self.model = model
        self.type = type
        self.usage = usage

@pytest.fixture
def mock_server_manager():
    manager = Mock()
    manager.check_servers_health = AsyncMock()
    manager.get_all_tools = AsyncMock(return_value=[
        {
            "name": "test_tool",
            "description": "A test tool",
            "parameters": {"type": "object", "properties": {}}
        }
    ])
    manager.call_tool = AsyncMock()
    return manager

@pytest.fixture
def mock_anthropic():
    with patch.dict('os.environ', {'ANTHROPIC_API_KEY': 'test-key'}):
        client = Mock(spec=anthropic.Anthropic)
        client.messages = Mock()
        client.messages.create = AsyncMock()
        return client

@pytest.fixture
def query_processor(mock_server_manager, mock_anthropic):
    with patch.dict('os.environ', {'ANTHROPIC_API_KEY': 'test-key'}):
        return QueryProcessor(mock_server_manager, mock_anthropic)

@pytest.mark.asyncio
async def test_query_processor_init(mock_server_manager):
    """Test QueryProcessor initialization."""
    with patch.dict('os.environ', {'ANTHROPIC_API_KEY': 'test-key'}):
        processor = QueryProcessor(mock_server_manager)
        assert processor.server_manager == mock_server_manager
        assert processor.max_iterations == 10
        assert processor.api_timeout == 30

@pytest.mark.asyncio
async def test_basic_query_processing(query_processor, mock_anthropic):
    """Test basic query processing without tool calls."""
    # Setup mock response
    mock_response = MockMessage(
        id="msg_123",
        content=[{"type": "text", "text": "Test response"}],
        role="assistant",
        model="claude-3-5-sonnet-20241022",
        type="message",
        usage={"input_tokens": 10, "output_tokens": 20}
    )
    mock_anthropic.messages.create.return_value = mock_response

    # Process query
    result = await query_processor.process_query("test query")

    # Verify calls and response
    assert mock_anthropic.messages.create.called
    assert "[Initial Thinking]" in result
    assert "Test response" in result

@pytest.mark.asyncio
async def test_query_processing_with_tool_call(query_processor, mock_anthropic, mock_server_manager):
    """Test query processing with tool calls."""
    # Setup mock responses
    tool_response = MockMessage(
        id="msg_tool",
        content=[{"type": "text", "text": "Tool result"}],
        role="assistant",
        model="claude-3-5-sonnet-20241022",
        type="message",
        usage={"input_tokens": 10, "output_tokens": 20}
    )
    mock_server_manager.call_tool.return_value = tool_response

    # First response with tool call
    first_response = MockMessage(
        id="msg_1",
        content=[
            {"type": "text", "text": "Thinking about using tool"},
            {"type": "tool_use", "name": "test_tool", "input": {"param": "value"}, "id": "tool_1"}
        ],
        role="assistant",
        model="claude-3-5-sonnet-20241022",
        type="message",
        usage={"input_tokens": 10, "output_tokens": 20}
    )
    # Final response without tool call
    final_response = MockMessage(
        id="msg_2",
        content=[{"type": "text", "text": "Final response"}],
        role="assistant",
        model="claude-3-5-sonnet-20241022",
        type="message",
        usage={"input_tokens": 10, "output_tokens": 20}
    )
    
    mock_anthropic.messages.create.side_effect = [first_response, final_response]

    # Process query
    result = await query_processor.process_query("test query")

    # Verify calls
    assert mock_server_manager.call_tool.called
    assert mock_anthropic.messages.create.call_count == 2
    assert "Tool result" in result
    assert "Final response" in result

@pytest.mark.asyncio
async def test_query_processing_max_iterations(query_processor, mock_anthropic, mock_server_manager):
    """Test query processing reaches max iterations."""
    # Setup mock response that always includes a tool call
    tool_response = MockMessage(
        id="msg_tool",
        content=[
            {"type": "text", "text": "Using tool"},
            {"type": "tool_use", "name": "test_tool", "input": {"param": "value"}, "id": "tool_1"}
        ],
        role="assistant",
        model="claude-3-5-sonnet-20241022",
        type="message",
        usage={"input_tokens": 10, "output_tokens": 20}
    )
    mock_anthropic.messages.create.return_value = tool_response
    
    tool_result = MockMessage(
        id="msg_result",
        content=[{"type": "text", "text": "Tool result"}],
        role="assistant",
        model="claude-3-5-sonnet-20241022",
        type="message",
        usage={"input_tokens": 10, "output_tokens": 20}
    )
    mock_server_manager.call_tool.return_value = tool_result

    # Process query
    result = await query_processor.process_query("test query")

    # Verify max iterations reached (initial call + max_iterations)
    assert mock_anthropic.messages.create.call_count == query_processor.max_iterations + 1
    assert "Reached maximum number of tool call iterations" in result

@pytest.mark.asyncio
async def test_query_processing_tool_error(query_processor, mock_anthropic, mock_server_manager):
    """Test query processing handles tool execution errors."""
    # Setup mock response with tool call
    mock_response = MockMessage(
        id="msg_1",
        content=[
            {"type": "text", "text": "Using tool"},
            {"type": "tool_use", "name": "test_tool", "input": {"param": "value"}, "id": "tool_1"}
        ],
        role="assistant",
        model="claude-3-5-sonnet-20241022",
        type="message",
        usage={"input_tokens": 10, "output_tokens": 20}
    )
    mock_anthropic.messages.create.return_value = mock_response
    
    # Setup tool to raise exception
    mock_server_manager.call_tool.side_effect = Exception("Tool error")

    # Process query
    result = await query_processor.process_query("test query")

    # Verify error handling
    assert "Error executing tool test_tool: Tool error" in result

@pytest.mark.asyncio
async def test_query_processing_with_context(query_processor, mock_anthropic):
    """Test query processing with initial context."""
    # Setup context
    context = [
        {"role": "user", "content": "Previous message"},
        {"role": "assistant", "content": "Previous response"}
    ]
    
    # Setup mock response
    mock_response = MockMessage(
        id="msg_1",
        content=[{"type": "text", "text": "Response with context"}],
        role="assistant",
        model="claude-3-5-sonnet-20241022",
        type="message",
        usage={"input_tokens": 10, "output_tokens": 20}
    )
    mock_anthropic.messages.create.return_value = mock_response

    # Process query with context
    result = await query_processor.process_query("test query", context=context)

    # Verify context was used
    call_args = mock_anthropic.messages.create.call_args[1]
    messages = call_args["messages"]
    assert len(messages) == 3  # 2 context messages + 1 new query
    assert messages[0]["content"] == "Previous message"
    assert "Response with context" in result

@pytest.mark.asyncio
async def test_query_processing_tool_not_found(query_processor, mock_anthropic, mock_server_manager):
    """Test handling of tool not found scenario."""
    # Setup mock response with tool call
    mock_response = MockMessage(
        id="msg_1",
        content=[
            {"type": "text", "text": "Using tool"},
            {"type": "tool_use", "name": "nonexistent_tool", "input": {"param": "value"}, "id": "tool_1"}
        ],
        role="assistant",
        model="claude-3-5-sonnet-20241022",
        type="message",
        usage={"input_tokens": 10, "output_tokens": 20}
    )
    mock_anthropic.messages.create.return_value = mock_response
    
    # Setup tool call to return None (not found)
    mock_server_manager.call_tool.return_value = None

    # Process query
    result = await query_processor.process_query("test query")

    # Verify error handling
    assert "Tool nonexistent_tool not found in any connected server" in result

@pytest.mark.asyncio
async def test_health_check_interval(query_processor, mock_anthropic, mock_server_manager):
    """Test health check interval is respected."""
    # Setup mock response
    mock_response = MockMessage(
        id="msg_1",
        content=[{"type": "text", "text": "Test response"}],
        role="assistant",
        model="claude-3-5-sonnet-20241022",
        type="message",
        usage={"input_tokens": 10, "output_tokens": 20}
    )
    mock_anthropic.messages.create.return_value = mock_response

    # Process query with custom health check interval
    await query_processor.process_query("test query", health_check_interval=30)

    # Verify health check was called with correct interval
    mock_server_manager.check_servers_health.assert_called_once_with(30)
    
    # Verify API call includes tools
    call_kwargs = mock_anthropic.messages.create.call_args[1]
    assert "tools" in call_kwargs
    assert call_kwargs["tools"] == mock_server_manager.get_all_tools.return_value
