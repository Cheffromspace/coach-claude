"""Unit tests for the server manager module."""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
from mcp import ClientSession
from mcp_client.server.server_manager import ServerManager

@pytest.fixture
def mock_exit_stack():
    """Mock AsyncExitStack for testing."""
    stack = AsyncMock()
    
    async def mock_enter_context(context):
        # Handle stdio_client context manager
        if hasattr(context, '__call__'):  # stdio_client function
            stdio = AsyncMock()
            write = AsyncMock()
            return (stdio, write)
            
        return context
    
    stack.enter_async_context = AsyncMock(side_effect=mock_enter_context)
    stack.aclose = AsyncMock()
    return stack

@pytest.fixture
def mock_config():
    """Mock configuration for testing."""
    return {
        "mcpServers": {
            "test-server": {
                "command": "node",
                "args": ["test-server.js"],
                "env": {}
            },
            "test-server1": {
                "command": "node",
                "args": ["test-server1.js"],
                "env": {}
            },
            "test-server2": {
                "command": "node",
                "args": ["test-server2.js"],
                "env": {}
            }
        }
    }

@pytest.mark.asyncio
async def test_server_manager_initialization(mock_config, mock_exit_stack):
    """Test ServerManager initialization."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    assert manager.servers == {}
    assert manager.config == mock_config
    assert manager.connected_servers == set()
    assert manager.max_retries == 3
    assert manager.retry_delay == 1
    assert manager.server_processes == {}
    assert manager.last_health_checks == {}

@pytest.mark.asyncio
async def test_get_server_env():
    """Test environment variable generation for different commands."""
    manager = ServerManager({}, AsyncMock())
    
    # Test npm environment
    npm_env = manager._get_server_env('npm')
    assert npm_env['NODE_ENV'] == 'development'
    assert 'PATH' in npm_env
    
    # Test non-node command environment
    other_env = manager._get_server_env('python')
    assert other_env == {}

@pytest.mark.asyncio
async def test_connect_to_server_success(mock_config, mock_exit_stack):
    """Test successful server connection."""
    session = AsyncMock()
    session.initialize = AsyncMock(return_value={"version": "1.0.0"})
    tools_response = AsyncMock()
    tools_response.tools = []
    session.list_tools = AsyncMock(return_value=tools_response)
    session.connected = True
    
    with patch('mcp_client.server.server_manager.ClientSession', return_value=session):
        manager = ServerManager(mock_config, mock_exit_stack)
        success = await manager.connect_to_server("test-server")
    
    assert success is True
    assert "test-server" in manager.servers
    assert "test-server" in manager.connected_servers
    assert "test-server" in manager.last_health_checks
    
    session = manager.servers["test-server"]
    assert session.connected
    assert session.initialize.called
    assert session.list_tools.called

@pytest.fixture
def mock_session():
    """Create a mock ClientSession."""
    session = AsyncMock()
    session.initialize = AsyncMock(return_value={"version": "1.0.0"})
    tools_response = AsyncMock()
    tools_response.tools = []
    session.list_tools = AsyncMock(return_value=tools_response)
    session.connected = True
    return session

@pytest.mark.asyncio
async def test_connect_to_server_retry_logic(mock_config, mock_exit_stack, mock_session):
    """Test connection retry logic."""
    attempt_count = 0
    
    def mock_client_session(*args, **kwargs):
        nonlocal attempt_count
        attempt_count += 1
        if attempt_count <= 2:
            raise ConnectionError("Simulated connection failure")
        return mock_session
    
    with patch('mcp_client.server.server_manager.ClientSession', side_effect=mock_client_session):
        manager = ServerManager(mock_config, mock_exit_stack)
        success = await manager.connect_to_server("test-server")
        assert success is True
        assert attempt_count == 3

@pytest.mark.asyncio
async def test_connect_to_server_timeout(mock_config, mock_exit_stack):
    """Test connection timeout."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    # Simulate slow connection
    async def slow_enter_context(*args, **kwargs):
        await asyncio.sleep(2)
        raise ConnectionError("Timeout")
    
    mock_exit_stack.enter_async_context = AsyncMock(side_effect=slow_enter_context)
    
    success = await manager.connect_to_server("test-server", timeout=1)
    assert success is False

@pytest.mark.asyncio
async def test_check_server_health(mock_config, mock_exit_stack):
    """Test server health check."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    # Create a mock session that will hang
    session = AsyncMock()
    tools_response = AsyncMock()
    tools_response.tools = []
    
    async def hanging_list_tools():
        await asyncio.sleep(5)  # Sleep longer than timeout to simulate hang
        return tools_response
    
    session.list_tools = AsyncMock(side_effect=hanging_list_tools)
    session.connected = True
    
    # Add session directly to avoid full connection process
    manager.servers["test-server"] = session
    manager.connected_servers.add("test-server")
    manager.last_health_checks["test-server"] = datetime.now() - timedelta(minutes=2)
    
    # Verify that a hanging health check causes a timeout
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(
            manager.check_servers_health(health_check_interval=60),
            timeout=2
        )
    
    # Verify the health check was attempted
    session.list_tools.assert_called_once()

@pytest.mark.asyncio
async def test_check_server_health_failure(mock_config, mock_exit_stack):
    """Test server health check failure."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    # Create a mock session with failure response
    session = AsyncMock()
    session.list_tools = AsyncMock(side_effect=Exception("Health check failed"))
    session.connected = True
    
    # Add session directly to avoid full connection process
    manager.servers["test-server"] = session
    manager.connected_servers.add("test-server")
    manager.last_health_checks["test-server"] = datetime.now() - timedelta(minutes=2)
    
    # Add timeout to prevent hanging
    try:
        with pytest.raises(ConnectionError, match="Server health check failed for test-server"):
            await asyncio.wait_for(
                manager.check_servers_health(),
                timeout=2
            )
    except asyncio.TimeoutError:
        pytest.fail("Health check timed out")

@pytest.mark.asyncio
async def test_get_all_tools(mock_config, mock_exit_stack):
    """Test getting tools from all servers."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    # Create a mock session with immediate response
    session = AsyncMock()
    mock_tool = MagicMock()
    mock_tool.name = "test-tool"
    mock_tool.description = "Test tool"
    mock_tool.inputSchema = {"type": "object"}
    tools_response = AsyncMock()
    tools_response.tools = [mock_tool]
    session.list_tools = AsyncMock(return_value=tools_response)
    session.connected = True
    
    # Add session directly to avoid full connection process
    manager.servers["test-server"] = session
    manager.connected_servers.add("test-server")
    
    # Add timeout to prevent hanging
    try:
        tools = await asyncio.wait_for(
            manager.get_all_tools(),
            timeout=2
        )
    except asyncio.TimeoutError:
        pytest.fail("Get all tools timed out")
    
    assert len(tools) == 1
    assert tools[0]["name"] == "test-tool"
    assert tools[0]["description"] == "Test tool"
    assert tools[0]["input_schema"] == {"type": "object"}

@pytest.mark.asyncio
async def test_call_tool(mock_config, mock_exit_stack):
    """Test calling a tool."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    # Create a mock session with immediate response
    session = AsyncMock()
    mock_tool = MagicMock()
    mock_tool.name = "test-tool"
    tools_response = AsyncMock()
    tools_response.tools = [mock_tool]
    session.list_tools = AsyncMock(return_value=tools_response)
    session.call_tool = AsyncMock(return_value={"result": "success"})
    session.connected = True
    
    # Add session directly to avoid full connection process
    manager.servers["test-server"] = session
    manager.connected_servers.add("test-server")
    
    # Add timeout to prevent hanging
    try:
        result = await asyncio.wait_for(
            manager.call_tool("test-tool", {"arg": "value"}),
            timeout=2
        )
    except asyncio.TimeoutError:
        pytest.fail("Call tool timed out")
    
    assert result == {"result": "success"}
    session.call_tool.assert_called_with("test-tool", {"arg": "value"})

@pytest.mark.asyncio
async def test_call_tool_not_found(mock_config, mock_exit_stack):
    """Test calling a non-existent tool."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    # Create a mock session with immediate response
    session = AsyncMock()
    tools_response = AsyncMock()
    tools_response.tools = []  # Empty tools list
    session.list_tools = AsyncMock(return_value=tools_response)
    session.connected = True
    
    # Add session directly to avoid full connection process
    manager.servers["test-server"] = session
    manager.connected_servers.add("test-server")
    
    # Add timeout to prevent hanging
    try:
        result = await asyncio.wait_for(
            manager.call_tool("non-existent-tool", {}),
            timeout=2
        )
    except asyncio.TimeoutError:
        pytest.fail("Call tool timed out")
    
    assert result is None

@pytest.mark.asyncio
async def test_cleanup_server(mock_config, mock_exit_stack, mock_session):
    """Test server cleanup."""
    with patch('mcp_client.server.server_manager.ClientSession', return_value=mock_session):
        manager = ServerManager(mock_config, mock_exit_stack)
        await manager.connect_to_server("test-server")
        
        # Add mock process that terminates after a delay
        mock_process = MagicMock()
        is_terminated = False
        
        def check_poll():
            return 0 if is_terminated else None
            
        async def delayed_terminate():
            nonlocal is_terminated
            await asyncio.sleep(0.2)  # Terminate quickly
            is_terminated = True
            
        mock_process.poll = MagicMock(side_effect=check_poll)
        mock_process.terminate = AsyncMock(side_effect=delayed_terminate)
        mock_process.kill = MagicMock()
        manager.server_processes["test-server"] = mock_process
        
        # Add timeout to prevent hanging
        await asyncio.wait_for(
            manager.cleanup_server("test-server"),
            timeout=2
        )
        
        assert "test-server" not in manager.servers
        assert "test-server" not in manager.connected_servers
        assert "test-server" not in manager.server_processes
        mock_process.terminate.assert_called_once()
        # Kill should not be called since process terminated successfully
        mock_process.kill.assert_not_called()

@pytest.mark.asyncio
async def test_cleanup_all(mock_config, mock_exit_stack, mock_session):
    """Test cleanup of all servers."""
    # Setup mock processes with proper termination behavior
    def create_mock_process():
        process = MagicMock()
        is_terminated = False
        
        def check_poll():
            return 0 if is_terminated else None
            
        async def delayed_terminate():
            nonlocal is_terminated
            await asyncio.sleep(0.1)  # Quick termination for test
            is_terminated = True
            
        process.poll = MagicMock(side_effect=check_poll)
        process.terminate = AsyncMock(side_effect=delayed_terminate)
        process.kill = MagicMock()
        return process
    
    mock_process1 = create_mock_process()
    mock_process2 = create_mock_process()
    
    # Setup server manager with multiple mock processes
    with patch('mcp_client.server.server_manager.ClientSession', return_value=mock_session):
        manager = ServerManager(mock_config, mock_exit_stack)
        
        # Start multiple servers
        await manager.connect_to_server("test-server1")
        await manager.connect_to_server("test-server2")
        manager.server_processes["test-server1"] = mock_process1
        manager.server_processes["test-server2"] = mock_process2
        
        # Verify initial state
        assert len(manager.servers) == 2
        assert len(manager.server_processes) == 2
        
        # Add timeout to prevent hanging
        await asyncio.wait_for(
            manager.cleanup_all(),
            timeout=2
        )
        
        # Verify proper cleanup of all servers
        assert len(manager.servers) == 0
        assert len(manager.connected_servers) == 0
        assert len(manager.server_processes) == 0
        
        # Verify each process was terminated properly
        mock_process1.terminate.assert_called_once()
        mock_process2.terminate.assert_called_once()
        # Kill should not be called since processes terminated successfully
        mock_process1.kill.assert_not_called()
        mock_process2.kill.assert_not_called()

@pytest.mark.asyncio
async def test_cleanup_server_force_kill(mock_config, mock_exit_stack, mock_session):
    """Test server cleanup with force kill when terminate fails."""
    with patch('mcp_client.server.server_manager.ClientSession', return_value=mock_session):
        manager = ServerManager(mock_config, mock_exit_stack)
        await manager.connect_to_server("test-server")
        
        # Add mock process that never terminates
        mock_process = AsyncMock()
        mock_process.poll = MagicMock(return_value=None)  # Process never terminates
        mock_process.terminate = AsyncMock()  # Terminate does nothing
        mock_process.kill = MagicMock()  # Kill should be called
        manager.server_processes["test-server"] = mock_process
        
        await asyncio.wait_for(
            manager.cleanup_server("test-server"),
            timeout=2
        )
        
        assert "test-server" not in manager.servers
        assert "test-server" not in manager.connected_servers
        assert "test-server" not in manager.server_processes
        mock_process.terminate.assert_called_once()
        mock_process.kill.assert_called_once()  # Kill should be called since terminate failed

@pytest.mark.asyncio
async def test_start_server_not_in_config(mock_config, mock_exit_stack):
    """Test starting a server that's not in config."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    with pytest.raises(KeyError, match="Server 'non-existent' not found in configuration"):
        await manager.start_server("non-existent")

@pytest.mark.asyncio
async def test_start_server_connection_failure(mock_config, mock_exit_stack):
    """Test start_server when connection fails."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    # Mock connect_to_server to fail
    manager.connect_to_server = AsyncMock(return_value=False)
    
    with pytest.raises(ConnectionError, match="Failed to connect to server 'test-server'"):
        await manager.start_server("test-server")

@pytest.mark.asyncio
async def test_check_server_health_timeout(mock_config, mock_exit_stack):
    """Test server health check timeout."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    # Create a mock session that will timeout
    session = AsyncMock()
    session.list_tools = AsyncMock(side_effect=asyncio.TimeoutError("Health check timed out"))
    session.connected = True
    
    # Add session directly
    manager.servers["test-server"] = session
    manager.connected_servers.add("test-server")
    manager.last_health_checks["test-server"] = datetime.now() - timedelta(minutes=2)
    
    # Verify health check returns false on timeout
    result = await manager._check_server_health("test-server")
    assert result is False
    session.list_tools.assert_called_once()

@pytest.mark.asyncio
async def test_check_server_health_missing_server(mock_config, mock_exit_stack):
    """Test health check for non-existent server."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    # Verify health check returns false for missing server
    result = await manager._check_server_health("non-existent")
    assert result is False

@pytest.mark.asyncio
async def test_connect_server_missing_args(mock_exit_stack):
    """Test connecting to a server with missing args in config."""
    invalid_config = {
        "mcpServers": {
            "test-server": {
                "command": "node"
                # Missing 'args' field
            }
        }
    }
    
    manager = ServerManager(invalid_config, mock_exit_stack)
    success = await manager.connect_to_server("test-server")
    assert success is False

@pytest.mark.asyncio
async def test_check_servers_health_mixed_status(mock_config, mock_exit_stack):
    """Test check_servers_health with mixed health status."""
    manager = ServerManager(mock_config, mock_exit_stack)
    
    # Create two mock sessions - one healthy, one unhealthy
    healthy_session = AsyncMock()
    healthy_session.list_tools = AsyncMock()
    healthy_session.connected = True
    
    unhealthy_session = AsyncMock()
    unhealthy_session.list_tools = AsyncMock(side_effect=Exception("Health check failed"))
    unhealthy_session.connected = True
    
    # Add sessions directly
    manager.servers["healthy-server"] = healthy_session
    manager.servers["unhealthy-server"] = unhealthy_session
    manager.connected_servers.add("healthy-server")
    manager.connected_servers.add("unhealthy-server")
    manager.last_health_checks["healthy-server"] = datetime.now() - timedelta(minutes=2)
    manager.last_health_checks["unhealthy-server"] = datetime.now() - timedelta(minutes=2)
    
    # Verify that check_servers_health raises error when any server is unhealthy
    with pytest.raises(ConnectionError, match="Server health check failed for unhealthy-server"):
        await manager.check_servers_health()
    
    # Verify both health checks were attempted
    healthy_session.list_tools.assert_called_once()
    unhealthy_session.list_tools.assert_called_once()

@pytest.mark.asyncio
async def test_connect_invalid_server_config(mock_exit_stack):
    """Test connecting to a server with invalid config."""
    invalid_config = {
        "mcpServers": {
            "test-server": {
                # Missing required 'command' field
                "args": ["test-server.js"]
            }
        }
    }
    
    manager = ServerManager(invalid_config, mock_exit_stack)
    success = await manager.connect_to_server("test-server")
    assert success is False

@pytest.mark.asyncio
async def test_cleanup_server_error_handling(mock_config, mock_exit_stack, mock_session):
    """Test error handling during server cleanup."""
    with patch('mcp_client.server.server_manager.ClientSession', return_value=mock_session):
        manager = ServerManager(mock_config, mock_exit_stack)
        await manager.connect_to_server("test-server")
        
        # Mock process that raises exception on terminate and kill
        mock_process = AsyncMock()
        mock_process.poll = AsyncMock(return_value=None)
        mock_process.terminate = AsyncMock(side_effect=Exception("Terminate failed"))
        mock_process.kill = AsyncMock(side_effect=Exception("Kill failed"))
        manager.server_processes["test-server"] = mock_process

        # Mock server deletion to raise exception
        manager.servers = MagicMock()
        manager.servers.__delitem__ = MagicMock(side_effect=Exception("Server deletion failed"))
        
        # Should handle all exceptions gracefully
        await manager.cleanup_server("test-server")
        
        # Verify cleanup attempts and error handling
        assert "test-server" not in manager.connected_servers
        assert "test-server" not in manager.server_processes
        mock_process.terminate.assert_called_once()
        mock_process.kill.assert_called_once()
        manager.servers.__delitem__.assert_called_once_with("test-server")

@pytest.mark.asyncio
async def test_stop_and_restart_server(mock_config, mock_exit_stack):
    """Test stopping and restarting a server."""
    # Setup mock process with proper termination behavior
    mock_process = MagicMock()
    is_terminated = False
    
    def check_poll():
        return 0 if is_terminated else None
        
    async def delayed_terminate():
        nonlocal is_terminated
        await asyncio.sleep(0.1)  # Quick termination for test
        is_terminated = True
        
    mock_process.poll = MagicMock(side_effect=check_poll)
    mock_process.terminate = AsyncMock(side_effect=delayed_terminate)
    mock_process.kill = MagicMock()
    
    # Create different sessions for start and restart
    initial_session = AsyncMock()
    initial_session.initialize = AsyncMock(return_value={"version": "1.0.0"})
    initial_tools_response = AsyncMock()
    initial_tools_response.tools = []
    initial_session.list_tools = AsyncMock(return_value=initial_tools_response)
    initial_session.connected = True
    
    restart_session = AsyncMock()
    restart_session.initialize = AsyncMock(return_value={"version": "1.0.0"})
    restart_tools_response = AsyncMock()
    restart_tools_response.tools = []
    restart_session.list_tools = AsyncMock(return_value=restart_tools_response)
    restart_session.connected = True
    
    # Setup server manager with mock process
    with patch('mcp_client.server.server_manager.ClientSession', side_effect=[initial_session, restart_session]):
        manager = ServerManager(mock_config, mock_exit_stack)
        
        # Start server
        await asyncio.wait_for(
            manager.connect_to_server("test-server"),
            timeout=2
        )
        manager.server_processes["test-server"] = mock_process
        original_session = manager.servers["test-server"]
        
        # Stop server with timeout
        await asyncio.wait_for(
            manager.stop_server("test-server"),
            timeout=2
        )
        assert "test-server" not in manager.servers
        assert "test-server" not in manager.connected_servers
        mock_process.terminate.assert_called_once()
        mock_process.kill.assert_not_called()
        
        # Restart server with timeout
        await asyncio.wait_for(
            manager.restart_server("test-server"),
            timeout=2
        )
        assert "test-server" in manager.servers
        assert "test-server" in manager.connected_servers
        assert manager.servers["test-server"] != original_session
