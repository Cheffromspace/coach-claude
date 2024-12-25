"""Standardized mock implementations for testing."""
from unittest.mock import AsyncMock, MagicMock
import asyncio
from typing import List, Dict, Any, Optional

class MockStdioClient:
    """Standardized mock stdio client."""
    def __init__(self, stdio=None, write=None):
        self.stdio = stdio or AsyncMock()
        self.write = write or AsyncMock()
        
    async def __aenter__(self):
        return self.stdio, self.write
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

class MockSession:
    """Standardized mock session with proper async context manager."""
    def __init__(self, tools=None):
        self.session = AsyncMock()
        self.session.initialize = AsyncMock(return_value={"version": "1.0.0", "success": True})
        
        # Create proper tool response objects
        class Tool:
            def __init__(self, name, description, input_schema):
                self.name = name
                self.description = description
                self.inputSchema = input_schema

        class ToolsResponse:
            def __init__(self, tools):
                self.tools = [Tool(**t) if isinstance(t, dict) else t for t in (tools or [
                    {
                        "name": "default-tool",
                        "description": "Default tool for testing",
                        "input_schema": {"type": "object"}
                    }
                ])]

        self.session.list_tools = AsyncMock(return_value=ToolsResponse(tools))
        self.session.connected = True
        self.session.call_tool = AsyncMock(return_value={"result": "success"})

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

class ToolSession(MockSession):
    """Enhanced mock session for tool-related testing."""
    def __init__(self, tools: Optional[List[Dict[str, Any]]] = None):
        """Initialize ToolSession with optional tool configurations."""
        self.session = AsyncMock()
        self.session.initialize = AsyncMock(return_value={"version": "1.0.0", "success": True})
        
        self._tools = tools or [{
            "name": "test-tool",
            "description": "Test tool",
            "input_schema": {"type": "object"}
        }]
        
        # Create proper tool response objects
        class Tool:
            def __init__(self, name, description, input_schema):
                self.name = name
                self.description = description
                self.inputSchema = input_schema

        class ToolsResponse:
            def __init__(self, tools):
                self.tools = [Tool(**t) if isinstance(t, dict) else t for t in tools]

        self.session.list_tools = AsyncMock(return_value=ToolsResponse(self._tools))
        self.session.connected = True
        self.session.call_tool = AsyncMock(side_effect=self._handle_tool_call)
    
    async def _handle_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Handle tool calls with proper validation."""
        tool = next((t for t in self._tools if t["name"] == tool_name), None)
        if not tool:
            raise ValueError(f"Tool {tool_name} not found")
        return {
            "result": "success",
            "tool": tool_name,
            "args": arguments
        }

class MockProcess:
    """Standardized mock process with configurable termination behavior."""
    def __init__(self, terminate_delay=0.1, terminates_successfully=True):
        self.is_terminated = False
        self.terminate_delay = terminate_delay
        self.terminates_successfully = terminates_successfully
        
        # Setup mock methods
        self.poll = MagicMock(side_effect=self._check_poll)
        self.terminate = AsyncMock(side_effect=self._delayed_terminate)
        self.kill = AsyncMock(side_effect=self._handle_kill)

    def _check_poll(self):
        """Check if process has terminated."""
        return 0 if self.is_terminated else None

    async def _delayed_terminate(self):
        """Simulate delayed process termination."""
        if self.terminates_successfully:
            await asyncio.sleep(self.terminate_delay)
            self.is_terminated = True
        else:
            raise Exception("Terminate failed")

    async def _handle_kill(self):
        """Handle process kill."""
        self.is_terminated = True
