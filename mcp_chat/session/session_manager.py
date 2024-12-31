"""
Session Manager Module

Handles conversation session management, persistence, and session-related operations.
"""

import json
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, field
import uuid

from ..prompts.prompt_manager import SystemPromptManager

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
    system_prompts: List[Dict] = field(default_factory=list)

    @property
    def context(self) -> Dict:
        """Get the current context from metadata"""
        return self.metadata.get('current_context', {})

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

class SessionManager:
    """Manages conversation sessions and their persistence"""
    
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

    def start_session(self, initial_context: Dict = None, system_prompts: List[Dict] = None) -> ConversationSession:
        """Start a new conversation session with context and system prompts"""
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

    def archive_session(self, session_id: str) -> bool:
        """Archive a session by moving it to the archive directory"""
        session_file = os.path.join(self.sessions_dir, f"{session_id}.json")
        if os.path.exists(session_file):
            archive_file = os.path.join(self.archive_dir, f"{session_id}.json")
            os.rename(session_file, archive_file)
            return True
        return False

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

    def remove_messages(self, count: int) -> bool:
        """Remove the last n messages from the conversation"""
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

    def add_message(self, content: str, role: str = "user", metadata: Dict = None, cache: bool = False, update_prompts: bool = True):
        """Add a message to the current session"""
        if not self.current_session:
            logger.warning("No active session to add message to")
            return

        message = {
            'role': role,
            'content': content,
            'timestamp': datetime.now().isoformat(),
            'metadata': metadata or {}
        }

        # Add cache control if enabled
        if cache:
            message['metadata']['cache_control'] = {
                'type': 'persistent',
                'block_id': str(uuid.uuid4())
            }
            # Update cache block tracking
            self.current_session.metadata['cache_blocks']['active'] += 1
            self.current_session.metadata['cache_blocks']['total_created'] += 1

        self.current_session.messages.append(message)
        self.current_session.last_active = datetime.now()
        
        # Update prompt effectiveness if this is an assistant message
        if role == "assistant" and update_prompts:
            for prompt in self.current_session.system_prompts:
                if 'text' in prompt:
                    stats = self.current_session.metadata['prompt_effectiveness'].get(prompt['text'], {
                        'uses': 0,
                        'successful_interactions': 0,
                        'tool_success_rate': 0.0,
                        'cache_hit_rate': 0.0
                    })
                    stats['uses'] += 1
                    # Update success metrics based on metadata
                    if metadata and 'tool_calls' in metadata:
                        successful_tools = sum(1 for t in metadata['tool_calls'] if t.get('success', False))
                        total_tools = len(metadata['tool_calls'])
                        if total_tools > 0:
                            stats['tool_success_rate'] = successful_tools / total_tools
                    self.current_session.metadata['prompt_effectiveness'][prompt['text']] = stats

        self.save_session()
