import logging
import json
import asyncio
from typing import Dict, List, Optional
import os
from anthropic import Anthropic

logger = logging.getLogger(__name__)

class QueryProcessor:
    """Handles complex query processing using Claude integration."""
    
    def __init__(self, server_manager, anthropic_client: Optional[Anthropic] = None):
        """Initialize QueryProcessor with server manager and optional Anthropic client."""
        self.server_manager = server_manager
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        self.anthropic = anthropic_client or Anthropic(api_key=api_key)
        self.max_iterations = 10
        self.initialized = False
        self.api_timeout = 30  # timeout for Anthropic API calls in seconds
        
    async def initialize(self, timeout: int = 30) -> bool:
        """Initialize the query processor and verify connections."""
        logger.info("Initializing QueryProcessor...")
        try:
            # Add timeout for initialization
            await asyncio.wait_for(
                self._initialize(),
                timeout=timeout
            )
            self.initialized = True
            logger.info("QueryProcessor initialization completed successfully")
            return True
        except asyncio.TimeoutError:
            logger.error(f"QueryProcessor initialization timed out after {timeout} seconds")
            return False
        except Exception as e:
            logger.error(f"QueryProcessor initialization failed: {str(e)}", exc_info=True)
            return False
            
    async def _initialize(self):
        """Internal initialization method."""
        # Verify server manager is working
        logger.info("Verifying server connections...")
        await self.server_manager.check_servers_health()
        
        # Test tool retrieval
        logger.info("Testing tool retrieval...")
        tools = await self.server_manager.get_all_tools()
        if not tools:
            raise RuntimeError("No tools available from connected servers")
        logger.info(f"Found {len(tools)} available tools")

    async def process_query(self, query: str, context: Optional[List[Dict]] = None, health_check_interval: int = 60) -> str:
        """Process a query using Claude and available tools from all connected servers."""
        logger.info("Starting query processing")
        messages = context if context else []
        messages.append({
            "role": "user",
            "content": query
        })

        # Check server health
        logger.info("Checking server health...")
        await self.server_manager.check_servers_health(health_check_interval)
        
        # Get available tools
        logger.info("Getting available tools...")
        available_tools = await self.server_manager.get_all_tools()
        logger.info(f"Found {len(available_tools)} available tools")

        # Initial Claude API call with timeout
        try:
            response = self.anthropic.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1000,
                messages=messages,
                tools=available_tools
            )
        except asyncio.TimeoutError:
            error_msg = f"Anthropic API call timed out after {self.api_timeout} seconds"
            logger.error(error_msg)
            raise RuntimeError(error_msg)
        except Exception as e:
            logger.error(f"Anthropic API call failed: {str(e)}", exc_info=True)
            raise

        # Process response and handle tool calls in a loop
        final_text = []
        iteration = 0
        
        # Add initial thinking
        if response.content and response.content[0].type == 'text':
            initial_thinking = f"[Initial Thinking]\n{response.content[0].text}\n"
            print(initial_thinking)
            final_text.append(initial_thinking)
        
        while iteration < self.max_iterations:
            iteration += 1
            has_tool_call = False
            current_text = []
            
            iteration_header = f"\n[Iteration {iteration}]"
            print(iteration_header)
            current_text.append(iteration_header)
            
            for content in response.content:
                if content.type == 'text':
                    thinking = f"\n[Thinking]\n{content.text}"
                    print(thinking)
                    current_text.append(thinking)
                elif content.type == 'tool_use':
                    has_tool_call = True
                    tool_name = content.name
                    tool_args = content.input
                    
                    try:
                        # Log tool usage
                        tool_call_desc = f"\n[Tool Call]\nTool: {tool_name}\nArguments: {json.dumps(tool_args, indent=2)}"
                        print(tool_call_desc)
                        current_text.append(tool_call_desc)
                        
                        result = await self.server_manager.call_tool(tool_name, tool_args)
                        if result is None:
                            error_msg = f"Tool {tool_name} not found in any connected server"
                            error_output = f"\n[Error]\n{error_msg}"
                            print(error_output)
                            current_text.append(error_output)
                            continue
                        
                        # Log tool result
                        result_content = json.dumps(result, indent=2)
                        tool_result_desc = f"\n[Tool Result]\n{result_content}"
                        print(tool_result_desc)
                        current_text.append(tool_result_desc)
o                        
                        # Add to conversation context
                        messages.append({
                            "role": "assistant",
                            "content": f"Using tool: {tool_name} with arguments: {json.dumps(tool_args)}"
                        })
                        messages.append({
                            "role": "user",
                            "content": f"Tool result: {result_content}"
                        })
                    except Exception as e:
                        error_msg = f"Error executing tool {tool_name}: {str(e)}"
                        error_output = f"\n[Error]\n{error_msg}"
                        print(error_output)
                        current_text.append(error_output)
                        logger.error(error_msg)
            
            # Add current text to final output
            final_text.extend(current_text)
            
            # If no tool calls were made, we're done
            if not has_tool_call:
                break
                
            # Make another API call with updated context if there were tool calls
            if has_tool_call:
                try:
                    response = self.anthropic.messages.create(
                        model="claude-3-5-sonnet-20241022",
                        max_tokens=1000,
                        messages=messages,
                        tools=available_tools
                    )
                except asyncio.TimeoutError:
                    error_msg = f"Anthropic API call timed out after {self.api_timeout} seconds"
                    logger.error(error_msg)
                    error_output = f"\n[Error]\n{error_msg}"
                    print(error_output)
                    final_text.append(error_output)
                    break
                except Exception as e:
                    error_msg = f"Anthropic API call failed: {str(e)}"
                    logger.error(error_msg, exc_info=True)
                    error_output = f"\n[Error]\n{error_msg}"
                    print(error_output)
                    final_text.append(error_output)
                    break
        
        if iteration >= self.max_iterations:
            warning = "\n[Warning]\nReached maximum number of tool call iterations."
            print(warning)
            final_text.append(warning)
            
        return "\n".join(final_text)
