"""
Message Processor Module

Handles message processing, response handling, and metadata tracking.
"""

import json
import logging
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class MessageProcessor:
    def __init__(self, conversation_manager):
        """Initialize message processor with conversation manager"""
        self.conversation_manager = conversation_manager

    async def process_response(self, response: str):
        """Process and record assistant response with metadata"""
        # Parse response sections
        sections = response.split('\n')
        current_section = None
        metadata = {
            'sections': {},
            'tool_calls': []
        }
        
        for line in sections:
            if line.startswith('[') and line.endswith(']'):
                current_section = line[1:-1]
                metadata['sections'][current_section] = []
            elif current_section and line.strip():
                metadata['sections'][current_section].append(line.strip())
                
                # Track tool usage
                if current_section == 'Tool Call':
                    if line.startswith('Tool:'):
                        metadata['tool_calls'].append({
                            'tool': line.split(':', 1)[1].strip(),
                            'success': True  # Will be updated when result is processed
                        })
                elif current_section == 'Error':
                    if metadata['tool_calls']:
                        metadata['tool_calls'][-1]['success'] = False
                        metadata['tool_calls'][-1]['error'] = line
        
        # Add response to conversation with caching for long responses
        self.conversation_manager.add_message(
            response, 
            role="assistant", 
            metadata=metadata,
            cache=len(response) > 1024  # Cache long responses
        )

    async def add_message(self, content: str, role: str = "user", cache: bool = False, update_prompts: bool = True):
        """Add a message and process with MCP if needed"""
        # Add message to conversation with optional caching and prompt updates
        self.conversation_manager.add_message(
            content, 
            role=role, 
            cache=cache,
            update_prompts=update_prompts
        )

    async def add_system_prompt(self, template_name: str):
        """Add a system prompt dynamically"""
        template = self.conversation_manager.prompt_manager.get_template(template_name)
        if template and self.conversation_manager.current_session:
            system_prompt = {
                'type': 'text',
                'text': template.content,
                'cache_control': template.cache_control
            }
            self.conversation_manager.current_session.system_prompts.append(system_prompt)
            self.conversation_manager.save_session()
            return True
        return False

    async def add_documentation(self, content: str, description: str = "Documentation"):
        """Add documentation or large text content with caching enabled"""
        system_content = {
            'type': 'text',
            'text': content,
            'cache_control': {'type': 'ephemeral'}
        }
        
        # Add as a system message with cache control
        self.conversation_manager.add_message(
            system_content,
            role="system",
            metadata={'type': 'documentation', 'description': description},
            cache=True
        )

    def extract_cache_metrics(self, response: str) -> Dict:
        """Extract cache metrics from response if available"""
        cache_metrics = {}
        if '[Cache Performance]' in response:
            lines = response.split('\n')
            in_cache_section = False
            for line in lines:
                if '[Cache Performance]' in line:
                    in_cache_section = True
                    continue
                if in_cache_section and line.strip():
                    if ':' in line:
                        key, value = line.split(':', 1)
                        key = key.strip().lower().replace(' ', '_')
                        try:
                            value = int(value.strip())
                            cache_metrics[key] = value
                        except ValueError:
                            continue
                    else:
                        in_cache_section = False
                        break
        
        # Log cache metrics if available
        if cache_metrics:
            logger.info("Cache Performance Metrics:")
            for key, value in cache_metrics.items():
                logger.info(f"  {key}: {value}")
                
        return cache_metrics
