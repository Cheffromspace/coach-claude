import logging
import asyncio
from typing import Dict, Optional, Any
from enum import Enum
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class MessageError(Exception):
    """Base class for message processing errors."""
    pass

class ValidationError(MessageError):
    """Error raised when message validation fails."""
    pass

class ServerError(MessageError):
    """Error raised when server operations fail."""
    pass

class MessageType(Enum):
    TOOL_REQUEST = "tool_request"
    RESOURCE_REQUEST = "resource_request"

@dataclass
class MessageContext:
    """Context information for message processing."""
    timestamp: datetime
    retry_count: int = 0
    max_retries: int = 2
    last_error: Optional[Exception] = None

class MessageProcessor:
    """Handles MCP protocol messages for tool and resource requests with robust error handling."""
    
    def __init__(self, server_manager, query_processor):
        """Initialize MessageProcessor with server manager and query processor."""
        self._server_manager = server_manager
        self._query_processor = query_processor
        self._message_contexts = {}  # Track message processing context
        self._error_counts = {}  # Track error frequencies
        self._cleanup_interval = 300  # Clean up old contexts every 5 minutes
        self._last_cleanup = datetime.now()

    async def process_query(self, query: str, context=None):
        """Process a general query using the query processor with error handling."""
        try:
            return await self._query_processor.process_query(query, context)
        except Exception as e:
            logger.error(f"Query processing error: {str(e)}", exc_info=True)
            raise MessageError(f"Failed to process query: {str(e)}")

    def _validate_message(self, message: Any) -> None:
        """Validate message format and required fields."""
        if not isinstance(message, dict):
            raise ValidationError("Message must be a dictionary")

        if "type" not in message:
            raise ValidationError("Missing 'type' field")
        if message["type"] not in [t.value for t in MessageType]:
            raise ValidationError(f"Unknown message type: {message['type']}")

        if "server" not in message:
            raise ValidationError("Missing 'server' field")

        if message["type"] == MessageType.TOOL_REQUEST.value:
            if "tool" not in message:
                raise ValidationError("Tool request missing 'tool' field")
        elif message["type"] == MessageType.RESOURCE_REQUEST.value:
            if "uri" not in message:
                raise ValidationError("Resource request missing 'uri' field")

    async def _verify_server_health(self, server_name: str) -> None:
        """Verify server health before processing message."""
        try:
            if not await self._server_manager._check_server_health(server_name):
                raise ServerError(f"Server '{server_name}' is unhealthy")
        except Exception as e:
            raise ServerError(f"Failed to verify server health: {str(e)}")

    async def _cleanup_old_contexts(self) -> None:
        """Clean up old message contexts and error counts."""
        now = datetime.now()
        if (now - self._last_cleanup) > timedelta(seconds=self._cleanup_interval):
            cutoff = now - timedelta(minutes=30)
            self._message_contexts = {
                k: v for k, v in self._message_contexts.items()
                if v.timestamp > cutoff
            }
            self._error_counts = {
                k: v for k, v in self._error_counts.items()
                if v["timestamp"] > cutoff
            }
            self._last_cleanup = now

    def _should_retry(self, error: Exception, context: MessageContext) -> bool:
        """Determine if operation should be retried based on error type and context."""
        if context.retry_count >= context.max_retries:
            return False
            
        # Retry on connection/timeout errors
        if isinstance(error, (asyncio.TimeoutError, ConnectionError)):
            return True
            
        # Retry on certain server errors
        if isinstance(error, ServerError):
            return "unhealthy" in str(error).lower()
            
        return False

    async def handle_message(self, message: Dict) -> Dict:
        """Handle incoming MCP messages with comprehensive error handling and retry logic."""
        message_id = id(message)
        if message_id not in self._message_contexts:
            self._message_contexts[message_id] = MessageContext(timestamp=datetime.now())
        context = self._message_contexts[message_id]

        try:
            # Validate message format
            self._validate_message(message)
            
            server_name = message["server"]
            message_type = message["type"]
            
            # Verify server health
            await self._verify_server_health(server_name)
            
            # Process message based on type
            try:
                if message_type == MessageType.TOOL_REQUEST.value:
                    tool_name = message["tool"]
                    params = message.get("params", {})
                    response = await self._server_manager.call_tool(tool_name, params)
                    if not response:
                        raise ServerError(f"Tool '{tool_name}' call failed")
                    return response
                    
                elif message_type == MessageType.RESOURCE_REQUEST.value:
                    uri = message["uri"]
                    response = await self._server_manager.get_resource(uri)
                    if not response:
                        raise ServerError(f"Failed to get resource: {uri}")
                    return response
                    
            except Exception as e:
                # Track error frequency
                error_key = f"{server_name}:{message_type}"
                if error_key not in self._error_counts:
                    self._error_counts[error_key] = {"count": 0, "timestamp": datetime.now()}
                self._error_counts[error_key]["count"] += 1
                
                # Check if we should retry
                if self._should_retry(e, context):
                    context.retry_count += 1
                    context.last_error = e
                    logger.warning(f"Retrying message (attempt {context.retry_count})")
                    return await self.handle_message(message)
                    
                raise

        except MessageError as e:
            logger.error(f"Message processing error: {str(e)}")
            raise
            
        except Exception as e:
            logger.error(f"Unexpected error processing message: {str(e)}", exc_info=True)
            raise MessageError(f"Message processing failed: {str(e)}")
            
        finally:
            # Clean up old contexts periodically
            await self._cleanup_old_contexts()
