"""Mock classes and utilities for testing."""
from typing import Dict, Any
from unittest.mock import MagicMock

class MockMcpServer:
    """Mock MCP server for testing."""
    
    def __init__(self, name: str = "test-server"):
        self.name = name
        self.connected = False
        self.tools = {}
        self.resources = {}
        
    async def connect(self):
        """Mock connect method."""
        self.connected = True
        
    async def disconnect(self):
        """Mock disconnect method."""
        self.connected = False
        
    def register_tool(self, name: str, handler: callable):
        """Register a mock tool."""
        self.tools[name] = handler
        
    def register_resource(self, uri: str, data: Any):
        """Register a mock resource."""
        self.resources[uri] = data

class MockTransport:
    """Mock transport for testing MCP communication."""
    
    def __init__(self):
        self.sent_messages = []
        self.responses = {}
        
    async def send_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Mock sending a message."""
        self.sent_messages.append(message)
        return self.responses.get(message.get("type"), {"status": "success"})
        
    def set_response(self, message_type: str, response: Dict[str, Any]):
        """Set a mock response for a message type."""
        self.responses[message_type] = response
