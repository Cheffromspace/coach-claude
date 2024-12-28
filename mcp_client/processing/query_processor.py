"""Main query processor orchestrating all components."""

import asyncio
import json
import logging
from typing import Dict, List, Optional

from .api.claude_client import ClaudeClient
from .cache.cache_metrics import CacheMetrics
from .cache.cache_strategy import CacheStrategy
from .message.message_formatter import MessageFormatter
from .tool.tool_handler import ToolHandler

logger = logging.getLogger(__name__)

class QueryProcessor:
    """Orchestrates query processing using modular components."""
    
    def __init__(self, server_manager, anthropic_client=None):
        """Initialize QueryProcessor with its components."""
        self.claude_client = ClaudeClient(anthropic_client)
        self.tool_handler = ToolHandler(server_manager)
        self.max_iterations = 10
        
    async def initialize(self, timeout: int = 120) -> bool:
        """Initialize the query processor and verify server health."""
        try:
            await asyncio.wait_for(self._initialize(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            logger.error(f"QueryProcessor initialization timed out after {timeout} seconds")
            return False
        except Exception as e:
            logger.error(f"QueryProcessor initialization failed: {str(e)}", exc_info=True)
            return False
            
    async def _initialize(self):
        """Internal initialization method."""
        await self.tool_handler.prepare_tools()
        
    async def process_query(self, query: str, context: Optional[List[Dict]] = None) -> str:
        """Process a query using all components."""
        logger.info("Starting query processing")
        final_text = []
        
        try:
            # Prepare messages and get available tools
            messages, system = MessageFormatter.prepare_messages(query, context)
            available_tools = await self.tool_handler.prepare_tools()
            
            # Process query with iterations for tool calls
            iteration = 0
            while iteration < self.max_iterations:
                iteration += 1
                current_text = []
                
                try:
                    # Make API call
                    response, metrics = await self.claude_client.create_message(
                        messages=messages,
                        tools=available_tools,
                        system=system
                    )
                    
                    # Process cache metrics
                    current_text.extend(CacheMetrics.format_metrics_display(metrics))
                    CacheMetrics.log_metrics(metrics)
                    
                except Exception as e:
                    if "maximum of 4 blocks with cache_control" in str(e):
                        logger.warning("Cache block limit exceeded, attempting recovery")
                        
                        # Create API call function for strategy attempts
                        async def api_call_func(sys, tools):
                            return await self.claude_client.create_message(
                                messages=messages,
                                tools=tools,
                                system=sys
                            )
                        
                        # Apply cache reduction strategies
                        success, new_response, system, available_tools = await CacheStrategy.apply_strategies(
                            system, available_tools, api_call_func
                        )
                        
                        if not success:
                            error_msg = "Failed to resolve cache block issues after trying all strategies"
                            logger.error(error_msg)
                            return f"\n[Error]\n{error_msg}"
                            
                        response = new_response
                    else:
                        error_msg = f"Claude API call failed: {str(e)}"
                        logger.error(error_msg, exc_info=True)
                        return f"\n[Error]\n{error_msg}"
                
                # Process response
                current_text.append(f"\n[Iteration {iteration}]")
                display_text, has_tool_call, tool_call_info = self.claude_client.process_response(response)
                current_text.extend(display_text)
                
                if has_tool_call and tool_call_info:
                    tool_name, tool_args = tool_call_info
                    
                    # Execute tool
                    result, error = await self.tool_handler.execute_tool(tool_name, tool_args)
                    current_text.extend(self.tool_handler.format_display(tool_name, tool_args, result, error))
                    
                    if result:
                        # Update conversation context
                        tool_call_content = MessageFormatter.format_tool_call(tool_name, tool_args)
                        result_msg = MessageFormatter.format_tool_result(result)
                        
                        messages.extend([
                            {'role': 'assistant', 'content': tool_call_content},
                            {'role': 'user', 'content': result_msg}
                        ])
                
                final_text.extend(current_text)
                if not has_tool_call:
                    break
                    
            if iteration >= self.max_iterations:
                final_text.append("\n[Warning]\nReached maximum number of tool call iterations.")
                
            return "\n".join(final_text)
            
        except Exception as e:
            error_msg = f"Error processing query: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return f"\n[Error]\n{error_msg}"
