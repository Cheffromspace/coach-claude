import asyncio
import json
import logging
import os
from typing import Dict, List, Optional
from anthropic import Anthropic

logger = logging.getLogger(__name__)

class QueryProcessor:
    """Handles query processing using Claude integration and MCP tools."""
    
    def __init__(self, server_manager, anthropic_client: Optional[Anthropic] = None):
        """Initialize QueryProcessor with server manager and optional Anthropic client."""
        self.server_manager = server_manager
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        self.anthropic = anthropic_client or Anthropic(api_key=api_key)
        self.model = "claude-3-sonnet-20240229"
        self.max_iterations = 10
        self.api_timeout = 30  # timeout for Anthropic API calls in seconds
        
    async def initialize(self, timeout: int = 120) -> bool:
        """Initialize the query processor and verify MCP server health."""
        try:
            # Add timeout for initialization
            await asyncio.wait_for(
                self._initialize(),
                timeout=timeout
            )
            return True
        except asyncio.TimeoutError:
            logger.error(f"QueryProcessor initialization timed out after {timeout} seconds")
            return False
        except Exception as e:
            logger.error(f"QueryProcessor initialization failed: {str(e)}", exc_info=True)
            return False
            
    async def _initialize(self):
        """Internal initialization method."""
        await self.server_manager.check_servers_health()
        tools = await self.server_manager.get_all_tools()
        if not tools:
            raise RuntimeError("No tools available from connected servers")
        logger.info(f"Found {len(tools)} available tools")

    async def process_query(self, query: str, context: Optional[List[Dict]] = None) -> str:
        """Process a query using Claude and MCP tools."""
        logger.info("Starting query processing")
        
        # Prepare messages and system prompt
        system_prompts = []
        messages = []
        if context:
            for msg in context:
                if msg.get('role') == 'system':
                    system_prompts.append(msg.get('content', ''))
                else:
                    messages.append({
                        'role': msg.get('role'),
                        'content': msg.get('content')
                    })
        
        # Add environment details to query
        formatted_query = f"{query}\n\nEnvironment Details:\n{os.environ.get('ENVIRONMENT_DETAILS', '')}"
        messages.append({'role': 'user', 'content': formatted_query})
        
        # Get system prompt if any
        system = "\n\n".join(system_prompts) if system_prompts else None

        # Get available tools
        await self.server_manager.check_servers_health()
        available_tools = await self.server_manager.get_all_tools()
        logger.info(f"Found {len(available_tools)} available tools")

        # Process query with Claude and handle tool calls
        final_text = []
        iteration = 0
        
        while iteration < self.max_iterations:
            iteration += 1
            current_text = []
            
            # Make Claude API call
            create_params = {
                "model": self.model,
                "max_tokens": 1000,
                "messages": messages,
                "tools": available_tools
            }
            if system:
                create_params["system"] = system
                
            try:
                response = self.anthropic.messages.create(**create_params)
            except Exception as e:
                error_msg = f"Claude API call failed: {str(e)}"
                logger.error(error_msg, exc_info=True)
                return f"\n[Error]\n{error_msg}"

            # Process response
            has_tool_call = False
            current_text.append(f"\n[Iteration {iteration}]")
            
            for content in response.content:
                if content.type == 'text':
                    thinking = f"\n[Thinking]\n{content.text}"
                    print(thinking)
                    current_text.append(thinking)
                    
                elif content.type == 'tool_use':
                    has_tool_call = True
                    tool_name = content.name
                    tool_args = content.input if isinstance(content.input, dict) else json.loads(content.input)
                    
                    # Call tool and handle result
                    try:
                        tool_call_desc = f"\n[Tool Call]\nTool: {tool_name}\nArguments: {json.dumps(tool_args, indent=2)}"
                        print(tool_call_desc)
                        current_text.append(tool_call_desc)
                        
                        result = await self.server_manager.call_tool(tool_name, tool_args)
                        if result is None:
                            error_msg = f"Tool {tool_name} not found"
                            current_text.append(f"\n[Error]\n{error_msg}")
                            continue
                            
                        result_content = json.dumps(result, indent=2)
                        print(f"\n[Tool Result]\n{result_content}")
                        current_text.append(f"\n[Tool Result]\n{result_content}")
                        
                        # Update conversation context
                        messages.extend([
                            {'role': 'assistant', 'content': f'Using tool: {tool_name} with arguments: {json.dumps(tool_args)}'},
                            {'role': 'user', 'content': f'Tool result: {result_content}'}
                        ])
                    except Exception as e:
                        error_msg = f"Error executing tool {tool_name}: {str(e)}"
                        logger.error(error_msg)
                        current_text.append(f"\n[Error]\n{error_msg}")
            
            final_text.extend(current_text)
            if not has_tool_call:
                break
                
        if iteration >= self.max_iterations:
            final_text.append("\n[Warning]\nReached maximum number of tool call iterations.")
            
        return "\n".join(final_text)
