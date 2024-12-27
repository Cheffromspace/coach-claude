"""
MCP Chat Package

A modular chat interface system with conversation management, caching, and NLP capabilities.
"""

from .chat import MCPChatInterface
from .interface.console import ConsoleInterface
from .processing.message_processor import MessageProcessor
from .session.session_manager import SessionManager, ConversationSession
from .cache.cache_manager import CacheManager
from .prompts.prompt_manager import SystemPromptManager, PromptTemplate
from .nlp.context_analyzer import analyze_message_context

__version__ = '0.2.0'

__all__ = [
    'MCPChatInterface',
    'ConsoleInterface',
    'MessageProcessor',
    'SessionManager',
    'ConversationSession',
    'CacheManager',
    'SystemPromptManager',
    'PromptTemplate',
    'analyze_message_context'
]
