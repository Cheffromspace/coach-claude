import logging
from typing import Dict

logger = logging.getLogger(__name__)

class MessageProcessor:
    """Handles MCP protocol messages for tool and resource requests."""
    
    def __init__(self, server_manager, query_processor):
        """Initialize MessageProcessor with server manager and query processor."""
        self._server_manager = server_manager
        self._query_processor = query_processor

    async def process_query(self, query: str, context=None):
        """Process a general query using the query processor."""
        return await self._query_processor.process_query(query, context)

    async def handle_message(self, message: Dict) -> Dict:
        """Handle incoming MCP messages (tool requests and resource requests)."""
        try:
            if not isinstance(message, dict):
                raise ValueError("Invalid message format: message must be a dictionary")

            message_type = message.get("type")
            if not message_type:
                raise ValueError("Invalid message format: missing 'type' field")

            server_name = message.get("server")
            if not server_name:
                raise ValueError("Invalid message format: missing 'server' field")

            server = self._server_manager.get_server(server_name)
            if not server:
                raise KeyError(f"Server '{server_name}' not found")

            if message_type == "tool_request":
                tool_name = message.get("tool")
                params = message.get("params", {})
                if not tool_name:
                    raise ValueError("Invalid tool request: missing 'tool' field")
                return await server.call_tool(tool_name, params)

            elif message_type == "resource_request":
                uri = message.get("uri")
                if not uri:
                    raise ValueError("Invalid resource request: missing 'uri' field")
                return await server.get_resource(uri)

            else:
                raise ValueError(f"Unknown message type: {message_type}")

        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            raise
