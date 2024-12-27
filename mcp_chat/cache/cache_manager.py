"""
Cache Manager Module

Handles conversation caching, cache block management, and cache performance tracking.
"""

import logging
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class CacheBlock:
    """Represents a cached block of conversation content"""
    id: str
    content: str
    created_at: datetime
    last_accessed: datetime
    access_count: int = 0
    metadata: Dict = None

class CacheManager:
    """Manages conversation caching and performance tracking"""
    
    def __init__(self):
        self.cache_stats = {
            'total_cache_creation_tokens': 0,
            'total_cache_read_tokens': 0,
            'total_uncached_tokens': 0,
            'total_output_tokens': 0,
            'cache_hits': 0,
            'total_requests': 0
        }
        self.cache_blocks = {
            'active': 0,
            'cleaned': 0,
            'total_created': 0
        }

    def get_cache_stats(self) -> Dict:
        """Get current cache performance statistics"""
        stats = self.cache_stats.copy()
        
        # Add cache block statistics
        stats.update({
            'active_cache_blocks': self.cache_blocks['active'],
            'cleaned_cache_blocks': self.cache_blocks['cleaned'],
            'total_cache_blocks_created': self.cache_blocks['total_created']
        })
        
        # Calculate cache effectiveness if there's enough data
        if stats['total_requests'] > 0:
            total_input = (stats['total_cache_creation_tokens'] + 
                         stats['total_cache_read_tokens'] + 
                         stats['total_uncached_tokens'])
            if total_input > 0:
                stats['cache_hit_rate'] = (stats['total_cache_read_tokens'] / total_input) * 100
                stats['token_savings'] = (stats['total_cache_read_tokens'] * 0.9) / total_input * 100
                
        return stats

    def update_cache_stats(self, metrics: Dict):
        """Update cache statistics with new metrics"""
        stats = self.cache_stats
        
        # Update token counts
        stats['total_cache_creation_tokens'] += metrics.get('cache_creation_input_tokens', 0)
        stats['total_cache_read_tokens'] += metrics.get('cache_read_input_tokens', 0)
        stats['total_uncached_tokens'] += metrics.get('input_tokens', 0)
        stats['total_output_tokens'] += metrics.get('output_tokens', 0)
        stats['total_requests'] += 1
        
        # Track cache hits
        if metrics.get('cache_read_input_tokens', 0) > 0:
            stats['cache_hits'] += 1

    def create_cache_block(self, content: str, metadata: Dict = None) -> str:
        """Create a new cache block for content
        
        Args:
            content: The content to cache
            metadata: Optional metadata about the cached content
            
        Returns:
            str: ID of the created cache block
        """
        block = CacheBlock(
            id=f"block_{self.cache_blocks['total_created']}",
            content=content,
            created_at=datetime.now(),
            last_accessed=datetime.now(),
            metadata=metadata or {}
        )
        
        # Update cache block tracking
        self.cache_blocks['active'] += 1
        self.cache_blocks['total_created'] += 1
        
        return block.id

    def cleanup_cache_blocks(self):
        """Clean up expired or unused cache blocks"""
        cleaned = self.cache_blocks['active']
        self.cache_blocks.update({
            'active': 0,
            'cleaned': self.cache_blocks['cleaned'] + cleaned
        })

    def should_cache_content(self, content: str, role: str) -> bool:
        """Determine if content should be cached based on characteristics
        
        Args:
            content: The content to potentially cache
            role: The role of the message (user/assistant/system)
            
        Returns:
            bool: True if content should be cached
        """
        # Cache long content
        if len(content) > 1024:
            return True
            
        # Cache system messages and documentation
        if role == 'system':
            return True
            
        # Cache assistant responses with high token count
        if role == 'assistant' and len(content.split()) > 200:
            return True
            
        return False

    def prepare_content_for_cache(self, content: str, metadata: Dict = None) -> Dict:
        """Prepare content for caching by adding cache control metadata
        
        Args:
            content: The content to prepare
            metadata: Optional additional metadata
            
        Returns:
            Dict: Content structure with cache control
        """
        cache_content = {
            'type': 'text',
            'text': content,
            'cache_control': {'type': 'ephemeral'}
        }
        
        if metadata:
            cache_content['metadata'] = metadata
            
        return cache_content

    def get_context_with_caching(self, messages: List[Dict], limit: int = 10) -> List[Dict]:
        """Get conversation context with optimized caching for long conversations
        
        Args:
            messages: List of conversation messages
            limit: Maximum number of messages to include
            
        Returns:
            List[Dict]: Context messages with caching applied
        """
        if not messages:
            return []

        context = []
        CHUNK_SIZE = 5  # Number of messages per chunk
        MAX_CHUNK_TOKENS = 2000  # Approximate max tokens per chunk

        # Get recent messages
        messages = messages[-limit:]
        
        if len(messages) > 2:
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
                self.cache_blocks['active'] += 1
                self.cache_blocks['total_created'] += 1
            
            # Add most recent message separately
            context.append({
                'role': recent_message['role'],
                'content': recent_message['content'],
                'metadata': recent_message.get('metadata', {})
            })
        else:
            # If too few messages, add them normally
            context.extend([
                {
                    'role': msg['role'],
                    'content': msg['content'],
                    'metadata': msg.get('metadata', {})
                }
                for msg in messages
            ])

        return context
