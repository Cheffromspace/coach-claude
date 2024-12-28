"""Processing module for MCP client functionality.

This module provides the core processing capabilities for the MCP client,
organized into several submodules:

Submodules:
- api: Claude API client and interactions
- cache: Cache metrics and reduction strategies
- message: Message formatting and context management
- tool: Tool execution and result handling

The main QueryProcessor class orchestrates these components to handle
queries, manage API interactions, and coordinate tool usage.
"""

from .api import ClaudeClient
from .cache import CacheMetrics, CacheStrategy
from .message import MessageFormatter
from .tool import ToolHandler
from .query_processor import QueryProcessor

__all__ = [
    'ClaudeClient',
    'CacheMetrics',
    'CacheStrategy',
    'MessageFormatter',
    'ToolHandler',
    'QueryProcessor'
]
