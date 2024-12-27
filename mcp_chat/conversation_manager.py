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
import logging

logger = logging.getLogger(__name__)

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
        """Create session from dictionary with backward compatibility"""
        # Initialize metadata with defaults for backward compatibility
        metadata = data.get('metadata', {})
        if 'prompt_effectiveness' not in metadata and 'system_prompts' in data:
            metadata['prompt_effectiveness'] = {
                prompt['text']: {
                    'uses': 0,
                    'successful_interactions': 0,
                    'tool_success_rate': 0.0,
                    'cache_hit_rate': 0.0
                }
                for prompt in data['system_prompts']
                if isinstance(prompt, dict) and 'text' in prompt
            }
        
        session = cls(
            session_id=data['session_id'],
            start_time=datetime.fromisoformat(data['start_time']),
            last_active=datetime.fromisoformat(data['last_active']),
            messages=data['messages'],
            metadata=metadata,
            system_prompts=data.get('system_prompts', [])
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
        self.archive_dir = os.path.join(storage_dir, 'archived_sessions')
        self.current_session: Optional[ConversationSession] = None
        self._ensure_directories()

    def _ensure_directories(self):
        """Ensure required directories exist"""
        os.makedirs(self.sessions_dir, exist_ok=True)
        os.makedirs(self.archive_dir, exist_ok=True)

    def archive_session(self, session_id: str) -> bool:
        """Archive a session by moving it to the archive directory
        
        Args:
            session_id: ID of the session to archive
            
        Returns:
            bool: True if session was archived, False if not found
        """
        session_file = os.path.join(self.sessions_dir, f"{session_id}.json")
        if os.path.exists(session_file):
            archive_file = os.path.join(self.archive_dir, f"{session_id}.json")
            os.rename(session_file, archive_file)
            return True
        return False

    def start_session(self, initial_context: Dict = None, system_prompts: List[Dict] = None) -> ConversationSession:
        """Start a new conversation session with context and system prompts
        
        Args:
            initial_context: Optional initial context for prompt selection
            system_prompts: Optional list of system prompts to initialize with
        """
        logger.debug("Starting new session")
        logger.debug(f"Initial context: {json.dumps(initial_context, indent=2) if initial_context else 'None'}")
        logger.debug(f"System prompts: {json.dumps(system_prompts, indent=2) if system_prompts else 'None'}")
        
        context = initial_context or {
            'message_type': 'task',
            'interaction_phase': 'start',
            'sensitive_data': True
        }
        
        # Create session with effectiveness tracking
        self.current_session = ConversationSession(
            system_prompts=system_prompts or [],
            metadata={
                'prompt_effectiveness': {
                    prompt['text']: {
                        'uses': 0,
                        'successful_interactions': 0,
                        'tool_success_rate': 0.0,
                        'cache_hit_rate': 0.0
                    }
                    for prompt in (system_prompts or [])
                },
                'current_context': context,
                'cache_blocks': {
                    'active': 0,
                    'cleaned': 0,
                    'total_created': 0
                }
            }
        )
        logger.debug(f"Session created with ID: {self.current_session.session_id}")
        return self.current_session

    def load_session(self, session_id: str) -> Optional[ConversationSession]:
        """Load an existing session by ID with cache cleanup"""
        session_file = os.path.join(self.sessions_dir, f"{session_id}.json")
        if os.path.exists(session_file):
            with open(session_file, 'r') as f:
                data = json.load(f)
                
                # Initialize cache block tracking if not present
                if 'metadata' in data and 'cache_blocks' not in data['metadata']:
                    data['metadata']['cache_blocks'] = {
                        'active': 0,
                        'cleaned': 0,
                        'total_created': 0
                    }
                
                # Clear any existing cache blocks from previous load
                if 'metadata' in data and 'cache_blocks' in data['metadata']:
                    cleaned = data['metadata']['cache_blocks'].get('active', 0)
                    data['metadata']['cache_blocks'].update({
                        'active': 0,
                        'cleaned': data['metadata']['cache_blocks'].get('cleaned', 0) + cleaned
                    })
                
                self.current_session = ConversationSession.from_dict(data)
                logger.debug(f"Loaded session {session_id} with cache cleanup")
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

    def add_message(self, content: str, role: str = "user", metadata: Dict = None, cache: bool = False, update_prompts: bool = True):
        """Add a message to the current session"""
        if not self.current_session:
            self.start_session()
            
        # Ensure prompt_effectiveness exists in metadata
        if 'prompt_effectiveness' not in self.current_session.metadata:
            self.current_session.metadata['prompt_effectiveness'] = {
                prompt['text']: {
                    'uses': 0,
                    'successful_interactions': 0,
                    'tool_success_rate': 0.0,
                    'cache_hit_rate': 0.0
                }
                for prompt in self.current_session.system_prompts
                if isinstance(prompt, dict) and 'text' in prompt
            }

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
        
        # Update cache stats and prompt effectiveness if metrics are provided
        if metadata and 'cache_metrics' in metadata:
            metrics = metadata['cache_metrics']
            stats = self.current_session.metadata['cache_stats']
            
            # Update cache stats
            stats['total_cache_creation_tokens'] += metrics.get('cache_creation_input_tokens', 0)
            stats['total_cache_read_tokens'] += metrics.get('cache_read_input_tokens', 0)
            stats['total_uncached_tokens'] += metrics.get('input_tokens', 0)
            stats['total_output_tokens'] += metrics.get('output_tokens', 0)
            stats['total_requests'] += 1
            
            cache_hit = metrics.get('cache_read_input_tokens', 0) > 0
            if cache_hit:
                stats['cache_hits'] += 1
            
            # Update prompt effectiveness based on cache performance
            if role == "assistant" and 'prompt_effectiveness' in self.current_session.metadata:
                for prompt in self.current_session.system_prompts:
                    if isinstance(prompt, dict) and 'text' in prompt:
                        effectiveness = self.current_session.metadata['prompt_effectiveness'][prompt['text']]
                        effectiveness['uses'] += 1
                        if cache_hit:
                            effectiveness['cache_hit_rate'] = (
                                effectiveness['cache_hit_rate'] * (effectiveness['uses'] - 1) +
                                1.0
                            ) / effectiveness['uses']
                
            # Calculate overall cache effectiveness
            if stats['total_requests'] > 0:
                total_input = (stats['total_cache_creation_tokens'] + 
                             stats['total_cache_read_tokens'] + 
                             stats['total_uncached_tokens'])
                if total_input > 0:
                    stats['cache_hit_rate'] = (stats['total_cache_read_tokens'] / total_input) * 100
                    stats['token_savings'] = (stats['total_cache_read_tokens'] * 0.9) / total_input * 100

        # Analyze message context and update prompts if needed
        if role == "user" and update_prompts:
            from .system_prompts import analyze_message_context, initialize_prompt_system
            
            # Get current context
            current_context = self.current_session.metadata.get('current_context', {})
            
            # Analyze new message
            new_context = analyze_message_context(content)
            
            # Update interaction phase
            if current_context.get('interaction_phase') == 'start':
                new_context['interaction_phase'] = 'ongoing'
            
            # Update prompts if context has changed
            if new_context != current_context:
                prompt_manager = initialize_prompt_system()
                new_prompts = prompt_manager.get_prompts_by_context(new_context)
                
                # Update system prompts while preserving effectiveness tracking
                current_effectiveness = self.current_session.metadata['prompt_effectiveness']
                for prompt in new_prompts:
                    if prompt['text'] not in current_effectiveness:
                        current_effectiveness[prompt['text']] = {
                            'uses': 0,
                            'successful_interactions': 0,
                            'tool_success_rate': 0.0,
                            'cache_hit_rate': 0.0
                        }
                
                self.current_session.system_prompts = new_prompts
                self.current_session.metadata['current_context'] = new_context

        # Create message with timestamp and metadata
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
                # Track cache block creation
                if 'cache_blocks' in self.current_session.metadata:
                    self.current_session.metadata['cache_blocks']['active'] += 1
                    self.current_session.metadata['cache_blocks']['total_created'] += 1
            message['content'] = message_content
        else:
            # Handle pre-formatted content (e.g. from system prompts)
            message['content'] = content

        self.current_session.messages.append(message)
        self.current_session.last_active = datetime.now()
        self.save_session()

    async def record_tool_usage(self, tool_name: str, success: bool, context: Dict, result: Dict):
        """Record tool usage and update prompt effectiveness metrics"""
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
        
        # Update tool usage stats
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
        
        # Update prompt effectiveness based on tool success
        if 'prompt_effectiveness' in self.current_session.metadata:
            for prompt in self.current_session.system_prompts:
                if isinstance(prompt, dict) and 'text' in prompt:
                    effectiveness = self.current_session.metadata['prompt_effectiveness'][prompt['text']]
                    
                    # Update tool success rate
                    effectiveness['successful_interactions'] += (1 if success else 0)
                    effectiveness['tool_success_rate'] = (
                        effectiveness['successful_interactions'] / effectiveness['uses']
                        if effectiveness['uses'] > 0 else 0.0
                    )
                    
                    # Track tool usage patterns
                    tool_patterns = effectiveness.setdefault('tool_patterns', {})
                    if tool_name not in tool_patterns:
                        tool_patterns[tool_name] = {
                            'uses': 0,
                            'successes': 0
                        }
                    
                    tool_patterns[tool_name]['uses'] += 1
                    if success:
                        tool_patterns[tool_name]['successes'] += 1
            
        self.current_session.metadata['tool_stats'] = tool_stats
        self.save_session()

    def get_context(self, limit: int = 10, include_system_prompts: bool = True, cache_conversation: bool = True) -> List[Dict]:
        """Get recent conversation context with optimized caching for long conversations"""
        if not self.current_session:
            logger.debug("No current session, returning empty context")
            return []

        context = []
        CHUNK_SIZE = 5  # Number of messages per chunk
        MAX_CHUNK_TOKENS = 2000  # Approximate max tokens per chunk

        # Add system prompts at the top level
        if include_system_prompts and self.current_session.system_prompts:
            logger.debug(f"Adding {len(self.current_session.system_prompts)} system prompts to context")
            for prompt in self.current_session.system_prompts:
                logger.debug(f"Adding system prompt: {json.dumps(prompt, indent=2)}")
                context.append({
                    'role': 'system',
                    'content': prompt
                })

        # Get recent messages
        messages = self.current_session.messages[-limit:]
        
        if cache_conversation and len(messages) > 2:
            # Keep most recent message separate
            recent_message = messages[-1]
            older_messages = messages[:-1]
            
            # Split older messages into chunks
            chunks = []
            current_chunk = []
            current_chunk_size = 0
            
            for msg in older_messages:
                # Estimate message size in tokens (rough approximation)
                msg_content = msg['content']
                if isinstance(msg_content, dict):
                    msg_text = msg_content.get('text', '')
                else:
                    msg_text = str(msg_content)
                    
                msg_size = len(msg_text.split())  # Rough token count
                
                # If adding this message would exceed chunk size, start new chunk
                if current_chunk_size + msg_size > MAX_CHUNK_TOKENS or len(current_chunk) >= CHUNK_SIZE:
                    if current_chunk:
                        chunks.append(current_chunk)
                    current_chunk = []
                    current_chunk_size = 0
                
                current_chunk.append(msg)
                current_chunk_size += msg_size
            
            # Add final chunk if not empty
            if current_chunk:
                chunks.append(current_chunk)
            
            # Add each chunk as a separate cached block
            for i, chunk in enumerate(chunks):
                chunk_content = []
                for msg in chunk:
                    if isinstance(msg['content'], dict):
                        chunk_content.append(msg['content'])
                    else:
                        chunk_content.append({
                            'type': 'text',
                            'text': msg['content']
                        })
                
                # Add chunk with cache control
                context.append({
                    'role': 'system',
                    'content': [{
                        'type': 'text',
                        'text': f'Conversation history (part {i+1}/{len(chunks)}):',
                        'cache_control': {'type': 'ephemeral'}
                    }] + chunk_content
                })
                
                # Track cache block creation
                if 'cache_blocks' in self.current_session.metadata:
                    self.current_session.metadata['cache_blocks']['active'] += 1
                    self.current_session.metadata['cache_blocks']['total_created'] += 1
            
            # Add most recent message separately
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
            
        stats = self.current_session.metadata.get('cache_stats', {}).copy()
        
        # Add cache block statistics
        if 'cache_blocks' in self.current_session.metadata:
            blocks = self.current_session.metadata['cache_blocks']
            stats.update({
                'active_cache_blocks': blocks.get('active', 0),
                'cleaned_cache_blocks': blocks.get('cleaned', 0),
                'total_cache_blocks_created': blocks.get('total_created', 0)
            })
            
        return stats

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

    def remove_messages(self, count: int) -> bool:
        """Remove the last n messages from the conversation
        
        Args:
            count: Number of message turns to remove (each turn is a user+assistant message pair)
            
        Returns:
            bool: True if messages were removed, False if not enough messages or no session
        """
        if not self.current_session or not self.current_session.messages:
            return False
            
        # Each turn consists of a user message and an assistant response
        messages_to_remove = count * 2
        if len(self.current_session.messages) < messages_to_remove:
            return False
            
        # Remove the messages
        self.current_session.messages = self.current_session.messages[:-messages_to_remove]
        self.save_session()
        return True

    def list_sessions(self, limit: int = 10) -> List[Dict]:
        """List available sessions, defaulting to the 10 most recent"""
        sessions = []
        for filename in os.listdir(self.sessions_dir):
            if filename.endswith('.json'):
                session_path = os.path.join(self.sessions_dir, filename)
                with open(session_path, 'r') as f:
                    data = json.load(f)
                    # Get first message content for context
                    first_msg = data['messages'][0]['content'] if data['messages'] else ''
                    first_msg_text = first_msg.get('text', '') if isinstance(first_msg, dict) else str(first_msg)
                    # Truncate to first 50 chars
                    first_msg_preview = first_msg_text[:50] + ('...' if len(first_msg_text) > 50 else '')
                    
                    sessions.append({
                        'session_id': data['session_id'],
                        'start_time': data['start_time'],
                        'last_active': data['last_active'],
                        'message_count': len(data['messages']),
                        'tool_usage_count': len(data['tool_usage']),
                        'first_message': first_msg_preview
                    })
        # Sort by last active and limit to most recent
        return sorted(sessions, key=lambda x: x['last_active'], reverse=True)[:limit]
