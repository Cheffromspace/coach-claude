"""Handles Claude API interactions."""

import asyncio
import logging
import os
from typing import Dict, List, Optional, Tuple
from anthropic import Anthropic

logger = logging.getLogger(__name__)

class ClaudeClient:
    """Manages Claude API interactions."""
    
    def __init__(self, anthropic_client: Optional[Anthropic] = None):
        """Initialize with optional Anthropic client."""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        self.anthropic = anthropic_client or Anthropic(api_key=api_key)
        self.model = "claude-3-5-sonnet-20241022"
        self.api_timeout = 30  # timeout for API calls in seconds
        
    async def create_message(self, 
                           messages: List[Dict],
                           tools: List[Dict],
                           system: Optional[List[Dict]] = None,
                           max_tokens: int = 2000) -> Tuple[Dict, Dict]:
        """Create a message using the Claude API.
        
        Returns:
            Tuple containing:
            - API response
            - Usage metrics
        """
        create_params = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": messages,
            "tools": tools
        }
        if system:
            create_params["system"] = system
            
        try:
            loop = asyncio.get_event_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: self.anthropic.messages.create(**create_params)
                ),
                timeout=self.api_timeout
            )
            
            # Extract usage metrics
            usage = response.usage
            metrics = {
                'cache_creation_input_tokens': getattr(usage, 'cache_creation_input_tokens', 0),
                'cache_read_input_tokens': getattr(usage, 'cache_read_input_tokens', 0),
                'input_tokens': getattr(usage, 'input_tokens', 0),
                'output_tokens': getattr(usage, 'output_tokens', 0)
            }
            
            return response, metrics
            
        except asyncio.TimeoutError:
            raise TimeoutError(f"Claude API call timed out after {self.api_timeout} seconds")
        except Exception as e:
            raise RuntimeError(f"Claude API call failed: {str(e)}")
            
    def process_response(self, response) -> Tuple[List[str], bool, Optional[Tuple[str, Dict]]]:
        """Process API response and extract relevant information.
        
        Returns:
            Tuple containing:
            - List of display text
            - Flag indicating if tool call was found
            - Tuple of tool name and args if tool call found, None otherwise
        """
        display_text = []
        has_tool_call = False
        tool_call_info = None
        
        for content in response.content:
            if content.type == 'text':
                thinking = f"\n[Thinking]\n{content.text}"
                print(thinking)
                display_text.append(thinking)
                
            elif content.type == 'tool_use':
                has_tool_call = True
                tool_name = content.name
                tool_args = content.input if isinstance(content.input, dict) else json.loads(content.input)
                tool_call_info = (tool_name, tool_args)
                
        return display_text, has_tool_call, tool_call_info
