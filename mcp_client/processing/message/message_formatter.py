"""Handles message formatting and context preparation."""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Union
import os

logger = logging.getLogger(__name__)

class MessageFormatter:
    """Formats messages and manages context for API calls."""
    
    @staticmethod
    def process_system_prompts(context: List[Dict]) -> List[Dict]:
        """Process and format system prompts from context."""
        system_prompts = []
        
        for msg in context:
            if msg.get('role') == 'system':
                content = msg.get('content', '')
                
                # Handle list of content blocks
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and 'type' in block and 'text' in block:
                            system_prompts.append(block)
                        else:
                            system_prompts.append({
                                'type': 'text',
                                'text': str(block)
                            })
                # Handle single content block
                else:
                    if isinstance(content, dict) and 'type' in content and 'text' in content:
                        system_prompts.append(content)
                    else:
                        system_prompts.append({
                            'type': 'text',
                            'text': str(content)
                        })
        
        if system_prompts:
            # Add time to first prompt's text
            first_prompt = system_prompts[0]
            first_prompt['text'] = f"{first_prompt['text']}\n\nCurrent time and date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S %Z')}"
            
            # Add all prompts except last to system array
            system = system_prompts[:-1]
            
            # Add last prompt with cache control
            if system_prompts:
                last_prompt = system_prompts[-1].copy()
                last_prompt['cache_control'] = {'type': 'ephemeral'}
                system.append(last_prompt)
                
            return system
            
        return []

    @staticmethod
    def process_messages(context: List[Dict]) -> List[Dict]:
        """Process and format non-system messages from context."""
        messages = []
        
        for msg in context:
            if msg.get('role') != 'system':
                content = msg.get('content', '')
                if isinstance(content, dict):
                    messages.append({
                        'role': msg.get('role'),
                        'content': [content]
                    })
                elif isinstance(content, list):
                    messages.append({
                        'role': msg.get('role'),
                        'content': content
                    })
                else:
                    messages.append({
                        'role': msg.get('role'),
                        'content': [{
                            'type': 'text',
                            'text': str(content)
                        }]
                    })
        
        return messages

    @staticmethod
    def format_query(query: str) -> List[Dict]:
        """Format query with environment details."""
        return [{
            'type': 'text',
            'text': f"{query}\n\nEnvironment Details:\n{os.environ.get('ENVIRONMENT_DETAILS', '')}"
        }]

    @staticmethod
    def format_tool_call(tool_name: str, tool_args: Dict) -> List[Dict]:
        """Format tool call for message context."""
        return [{
            'type': 'text',
            'text': f'Using tool: {tool_name} with arguments: {tool_args}'
        }]

    @staticmethod
    def format_tool_result(result: str) -> List[Dict]:
        """Format tool result for message context."""
        return [{
            'type': 'text',
            'text': f'Tool result: {result}'
        }]

    @classmethod
    def prepare_messages(cls, query: str, context: Optional[List[Dict]] = None) -> tuple[List[Dict], List[Dict]]:
        """Prepare formatted messages and system prompts for API call.
        
        Returns:
            Tuple containing:
            - List of formatted messages
            - List of system prompts
        """
        messages = []
        system = []
        
        if context:
            system = cls.process_system_prompts(context)
            messages = cls.process_messages(context)
            
        formatted_query = cls.format_query(query)
        messages.append({'role': 'user', 'content': formatted_query})
        
        return messages, system
