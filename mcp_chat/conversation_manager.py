"""
Conversation Manager Module

Handles conversation sessions, context management, and tool orchestration for the MCP chat system.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
import json
import os
import uuid

@dataclass
class ToolUsage:
    """Tracks tool usage within a conversation"""
    tool_name: str
    timestamp: datetime
    success: bool
    context: Dict
    result: str

@dataclass
class ConversationSession:
    """Represents a single conversation session"""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    start_time: datetime = field(default_factory=datetime.now)
    last_active: datetime = field(default_factory=datetime.now)
    messages: List[Dict] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)
    tool_usage: List[ToolUsage] = field(default_factory=list)
    system_prompts: List[Dict] = field(default_factory=list)  # Now stores dicts with type, text, and cache_control

    def to_dict(self) -> Dict:
        """Convert session to dictionary for serialization"""
        return {
            'session_id': self.session_id,
            'start_time': self.start_time.isoformat(),
            'last_active': self.last_active.isoformat(),
            'messages': self.messages,
            'metadata': self.metadata,
            'tool_usage': [
                {
                    'tool_name': t.tool_name,
                    'timestamp': t.timestamp.isoformat(),
                    'success': t.success,
                    'context': t.context,
                    'result': t.result
                }
                for t in self.tool_usage
            ],
            'system_prompts': self.system_prompts
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'ConversationSession':
        """Create session from dictionary"""
        session = cls(
            session_id=data['session_id'],
            start_time=datetime.fromisoformat(data['start_time']),
            last_active=datetime.fromisoformat(data['last_active']),
            messages=data['messages'],
            metadata=data['metadata'],
            system_prompts=data['system_prompts']
        )
        session.tool_usage = [
            ToolUsage(
                tool_name=t['tool_name'],
                timestamp=datetime.fromisoformat(t['timestamp']),
                success=t['success'],
                context=t['context'],
                result=t['result']
            )
            for t in data['tool_usage']
        ]
        return session

class ConversationManager:
    """Manages conversation sessions and orchestrates interactions"""
    
    def __init__(self, storage_dir: str = 'chat_history'):
        self.storage_dir = storage_dir
        self.sessions_dir = os.path.join(storage_dir, 'sessions')
        self.current_session: Optional[ConversationSession] = None
        self._ensure_directories()

    def _ensure_directories(self):
        """Ensure required directories exist"""
        os.makedirs(self.sessions_dir, exist_ok=True)

    def start_session(self, system_prompts: List[str] = None) -> ConversationSession:
        """Start a new conversation session"""
        self.current_session = ConversationSession(
            system_prompts=system_prompts or []
        )
        return self.current_session

    def load_session(self, session_id: str) -> Optional[ConversationSession]:
        """Load an existing session by ID"""
        session_file = os.path.join(self.sessions_dir, f"{session_id}.json")
        if os.path.exists(session_file):
            with open(session_file, 'r') as f:
                data = json.load(f)
                self.current_session = ConversationSession.from_dict(data)
                return self.current_session
        return None

    def save_session(self):
        """Save current session to disk"""
        if self.current_session:
            session_file = os.path.join(
                self.sessions_dir,
                f"{self.current_session.session_id}.json"
            )
            with open(session_file, 'w') as f:
                json.dump(self.current_session.to_dict(), f, indent=2)

    def add_message(self, content: str, role: str = "user", metadata: Dict = None, cache: bool = False):
        """Add a message to the current session"""
        if not self.current_session:
            self.start_session()

        # Initialize or update cache stats in session metadata
        if 'cache_stats' not in self.current_session.metadata:
            self.current_session.metadata['cache_stats'] = {
                'total_cache_creation_tokens': 0,
                'total_cache_read_tokens': 0,
                'total_uncached_tokens': 0,
                'total_output_tokens': 0,
                'cache_hits': 0,
                'total_requests': 0
            }
        
        # Update cache stats if metrics are provided
        if metadata and 'cache_metrics' in metadata:
            metrics = metadata['cache_metrics']
            stats = self.current_session.metadata['cache_stats']
            
            stats['total_cache_creation_tokens'] += metrics.get('cache_creation_input_tokens', 0)
            stats['total_cache_read_tokens'] += metrics.get('cache_read_input_tokens', 0)
            stats['total_uncached_tokens'] += metrics.get('input_tokens', 0)
            stats['total_output_tokens'] += metrics.get('output_tokens', 0)
            stats['total_requests'] += 1
            
            if metrics.get('cache_read_input_tokens', 0) > 0:
                stats['cache_hits'] += 1
                
            # Calculate overall cache effectiveness
            if stats['total_requests'] > 0:
                total_input = (stats['total_cache_creation_tokens'] + 
                             stats['total_cache_read_tokens'] + 
                             stats['total_uncached_tokens'])
                if total_input > 0:
                    stats['cache_hit_rate'] = (stats['total_cache_read_tokens'] / total_input) * 100
                    stats['token_savings'] = (stats['total_cache_read_tokens'] * 0.9) / total_input * 100

        message = {
            'timestamp': datetime.now().isoformat(),
            'role': role,
            'metadata': metadata or {}
        }

        # Format content as a structured message with optional caching
        if isinstance(content, str):
            message_content = {
                'type': 'text',
                'text': content
            }
            # Enable caching for large text content or documentation
            if cache and len(content) > 1024:  # Only cache substantial content
                message_content['cache_control'] = {'type': 'ephemeral'}
            message['content'] = message_content
        else:
            # Handle pre-formatted content (e.g. from system prompts)
            message['content'] = content

        self.current_session.messages.append(message)
        self.current_session.last_active = datetime.now()
        self.save_session()

    async def record_tool_usage(self, tool_name: str, success: bool, context: Dict, result: Dict):
        """Record tool usage in current session with MCP integration"""
        if not self.current_session:
            return

        # Extract formatted response from MCP tool result
        formatted_result = result.get('response', []) if isinstance(result, dict) else []
        result_text = '\n'.join(
            content.get('text', '') 
            for content in formatted_result 
            if isinstance(content, dict) and content.get('type') == 'text'
        )

        usage = ToolUsage(
            tool_name=tool_name,
            timestamp=datetime.now(),
            success=success,
            context=context,
            result=result_text
        )
        self.current_session.tool_usage.append(usage)
        
        # Update session metadata with tool usage stats
        tool_stats = self.current_session.metadata.get('tool_stats', {})
        if tool_name not in tool_stats:
            tool_stats[tool_name] = {
                'total_uses': 0,
                'successful_uses': 0,
                'failed_uses': 0
            }
        
        stats = tool_stats[tool_name]
        stats['total_uses'] += 1
        if success:
            stats['successful_uses'] += 1
        else:
            stats['failed_uses'] += 1
            
        self.current_session.metadata['tool_stats'] = tool_stats
        self.save_session()

    def get_context(self, limit: int = 10, include_system_prompts: bool = True, cache_conversation: bool = True) -> List[Dict]:
        """Get recent conversation context with optional system prompts and conversation caching"""
        if not self.current_session:
            return []

        context = []
        
        # Add system prompts first if requested
        if include_system_prompts and self.current_session.system_prompts:
            context.append({
                'role': 'system',
                'content': [prompt for prompt in self.current_session.system_prompts]
            })

        # Get recent messages
        messages = self.current_session.messages[-limit:]
        
        # If caching conversation and there are enough messages, create a cached block
        if cache_conversation and len(messages) > 2:
            # Cache all but the most recent message
            cached_messages = messages[:-1]
            recent_message = messages[-1]
            
            # Create a cached conversation block
            cached_content = []
            for msg in cached_messages:
                if isinstance(msg['content'], dict):
                    cached_content.append(msg['content'])
                else:
                    cached_content.append({
                        'type': 'text',
                        'text': msg['content']
                    })
            
            # Add cache control to the conversation block
            context.append({
                'role': 'system',
                'content': [{
                    'type': 'text',
                    'text': 'Previous conversation context:',
                    'cache_control': {'type': 'ephemeral'}
                }] + cached_content
            })
            
            # Add the most recent message separately
            context.append({
                'role': recent_message['role'],
                'content': recent_message['content'],
                'metadata': recent_message.get('metadata', {})
            })
        else:
            # If not caching or too few messages, add them normally
            context.extend([
                {
                    'role': msg['role'],
                    'content': msg['content'],
                    'metadata': msg.get('metadata', {})
                }
                for msg in messages
            ])

        return context

    def get_system_prompts(self) -> List[str]:
        """Get system prompts for current session"""
        if not self.current_session:
            return []
        return self.current_session.system_prompts
        
    def get_cache_stats(self) -> Dict:
        """Get cache performance statistics for the current session"""
        if not self.current_session:
            return {}
        return self.current_session.metadata.get('cache_stats', {})

    def update_metadata(self, metadata: Dict, merge: bool = True):
        """Update session metadata with merge option"""
        if not self.current_session:
            return

        if merge:
            # Deep merge for nested dictionaries
            def deep_merge(d1: Dict, d2: Dict) -> Dict:
                for k, v in d2.items():
                    if k in d1 and isinstance(d1[k], dict) and isinstance(v, dict):
                        deep_merge(d1[k], v)
                    else:
                        d1[k] = v
                return d1
            
            deep_merge(self.current_session.metadata, metadata)
        else:
            # Replace entire metadata
            self.current_session.metadata = metadata.copy()
            
        self.save_session()

    def list_sessions(self) -> List[Dict]:
        """List all available sessions"""
        sessions = []
        for filename in os.listdir(self.sessions_dir):
            if filename.endswith('.json'):
                session_path = os.path.join(self.sessions_dir, filename)
                with open(session_path, 'r') as f:
                    data = json.load(f)
                    sessions.append({
                        'session_id': data['session_id'],
                        'start_time': data['start_time'],
                        'last_active': data['last_active'],
                        'message_count': len(data['messages']),
                        'tool_usage_count': len(data['tool_usage'])
                    })
        return sorted(sessions, key=lambda x: x['last_active'], reverse=True)
