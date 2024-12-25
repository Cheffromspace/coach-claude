"""Tests for the message processor module."""
import pytest
from mcp_client.processing.message_processor import MessageProcessor
from unittest.mock import MagicMock, AsyncMock

@pytest.fixture
def mock_server_manager():
    """Mock server manager fixture."""
    manager = MagicMock()
    manager.get_server = MagicMock(return_value=MagicMock())
    return manager

@pytest.fixture
def mock_query_processor():
    """Mock query processor fixture."""
    processor = MagicMock()
    processor.process_query = AsyncMock(return_value="Query response")
    return processor

@pytest.mark.asyncio
async def test_message_processor_init(mock_server_manager, mock_query_processor):
    """Test MessageProcessor initialization."""
    processor = MessageProcessor(mock_server_manager, mock_query_processor)
    assert processor._server_manager == mock_server_manager
    assert processor._query_processor == mock_query_processor

@pytest.mark.asyncio
async def test_message_processor_process_query(mock_server_manager, mock_query_processor):
    """Test processing a general query."""
    processor = MessageProcessor(mock_server_manager, mock_query_processor)
    query = "test query"
    context = [{"role": "user", "content": "previous message"}]
    
    response = await processor.process_query(query, context)
    assert response == "Query response"
    mock_query_processor.process_query.assert_called_once_with(query, context)

@pytest.mark.asyncio
async def test_message_processor_handle_tool_request(mock_server_manager, mock_query_processor):
    """Test handling a tool request message."""
    processor = MessageProcessor(mock_server_manager, mock_query_processor)
    message = {
        "type": "tool_request",
        "server": "test-server",
        "tool": "test_tool",
        "params": {"param1": "value1"}
    }
    
    mock_server = MagicMock()
    mock_server.call_tool = AsyncMock(return_value={"status": "success"})
    mock_server_manager.get_server.return_value = mock_server
    
    response = await processor.handle_message(message)
    assert response["status"] == "success"
    mock_server_manager.get_server.assert_called_once_with("test-server")
    mock_server.call_tool.assert_called_once_with("test_tool", {"param1": "value1"})

@pytest.mark.asyncio
async def test_message_processor_handle_resource_request(mock_server_manager, mock_query_processor):
    """Test handling a resource request message."""
    processor = MessageProcessor(mock_server_manager, mock_query_processor)
    message = {
        "type": "resource_request",
        "server": "test-server",
        "uri": "test://resource"
    }
    
    mock_server = MagicMock()
    mock_server.get_resource = AsyncMock(return_value={"content": "test data"})
    mock_server_manager.get_server.return_value = mock_server
    
    response = await processor.handle_message(message)
    assert response["content"] == "test data"
    mock_server_manager.get_server.assert_called_once_with("test-server")
    mock_server.get_resource.assert_called_once_with("test://resource")

@pytest.mark.asyncio
async def test_message_processor_error_handling(mock_server_manager, mock_query_processor):
    """Test error handling in message processing."""
    processor = MessageProcessor(mock_server_manager, mock_query_processor)
    mock_server_manager.get_server.side_effect = Exception("Test error")
    message = {
        "type": "tool_request",
        "server": "test-server",
        "tool": "test_tool",
        "params": {}
    }
    
    with pytest.raises(Exception) as exc_info:
        await processor.handle_message(message)
    assert str(exc_info.value) == "Test error"

@pytest.mark.asyncio
async def test_message_processor_invalid_message(mock_server_manager, mock_query_processor):
    """Test handling invalid message format."""
    processor = MessageProcessor(mock_server_manager, mock_query_processor)
    invalid_message = {"invalid": "message"}
    
    with pytest.raises(ValueError) as exc_info:
        await processor.handle_message(invalid_message)
    assert "Invalid message format" in str(exc_info.value)

@pytest.mark.asyncio
async def test_message_processor_server_error(mock_server_manager, mock_query_processor):
    """Test handling server errors."""
    processor = MessageProcessor(mock_server_manager, mock_query_processor)
    message = {
        "type": "tool_request",
        "server": "test-server",
        "tool": "test_tool",
        "params": {}
    }
    
    mock_server = MagicMock()
    mock_server.call_tool = AsyncMock(return_value={"status": "error", "message": "Server error"})
    mock_server_manager.get_server.return_value = mock_server
    
    response = await processor.handle_message(message)
    assert response["status"] == "error"
    assert response["message"] == "Server error"
