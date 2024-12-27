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
        self.model = "claude-3-5-sonnet-20241022"
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
                    # Handle structured system prompts with cache control
                    content = msg.get('content', [])
                    if isinstance(content, list):
                        system_prompts.extend(content)
                    else:
                        system_prompts.append(content)
                else:
                    # Handle structured message content
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
                                'text': content
                            }]
                        })
        
        # Add environment details to query as structured content
        formatted_query = [{
            'type': 'text',
            'text': f"{query}\n\nEnvironment Details:\n{os.environ.get('ENVIRONMENT_DETAILS', '')}"
        }]
        messages.append({'role': 'user', 'content': formatted_query})
        
        # Format system prompts as structured content
        system = None
        if system_prompts:
            system = []
            for prompt in system_prompts:
                if isinstance(prompt, dict):
                    system.append(prompt)
                else:
                    system.append({
                        'type': 'text',
                        'text': prompt
                    })

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
                
                # Log cache performance metrics
                usage = getattr(response, 'usage', {})
                cache_metrics = {
                    'cache_creation_input_tokens': usage.get('cache_creation_input_tokens', 0),
                    'cache_read_input_tokens': usage.get('cache_read_input_tokens', 0),
                    'input_tokens': usage.get('input_tokens', 0),
                    'output_tokens': usage.get('output_tokens', 0)
                }
                
                # Log cache performance
                logger.info("Cache Performance Metrics:")
                logger.info(f"  Cache Creation Tokens: {cache_metrics['cache_creation_input_tokens']}")
                logger.info(f"  Cache Read Tokens: {cache_metrics['cache_read_input_tokens']}")
                logger.info(f"  Uncached Input Tokens: {cache_metrics['input_tokens']}")
                logger.info(f"  Output Tokens: {cache_metrics['output_tokens']}")
                
                # Add cache metrics to current text for display
                current_text.append("\n[Cache Performance]")
                current_text.append(f"Cache Creation Tokens: {cache_metrics['cache_creation_input_tokens']}")
                current_text.append(f"Cache Read Tokens: {cache_metrics['cache_read_input_tokens']}")
                current_text.append(f"Uncached Input Tokens: {cache_metrics['input_tokens']}")
                current_text.append(f"Output Tokens: {cache_metrics['output_tokens']}")
                
                # Calculate cache effectiveness
                total_input = (cache_metrics['cache_creation_input_tokens'] + 
                             cache_metrics['cache_read_input_tokens'] + 
                             cache_metrics['input_tokens'])
                if total_input > 0:
                    cache_hit_rate = (cache_metrics['cache_read_input_tokens'] / total_input) * 100
                    current_text.append(f"Cache Hit Rate: {cache_hit_rate:.1f}%")
                    logger.info(f"Cache Hit Rate: {cache_hit_rate:.1f}%")
                
            except Exception as e:
                error_msg = f"Claude API call failed: {str(e)}"
                logger.error(error_msg, exc_info=True)
                return f"\n[Error]\n{error_msg}"

            # Process response
            has_tool_call = False
            current_text.append(f"\n[Iteration {iteration}]")
            
            # Add metadata about cache performance
            metadata = {
                'cache_metrics': cache_metrics,
                'iteration': iteration
            }
            
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
                        
                        # Update conversation context with structured content
                        tool_call_content = [{
                            'type': 'text',
                            'text': f'Using tool: {tool_name} with arguments: {json.dumps(tool_args)}'
                        }]
                        
                        # Cache large tool results
                        result_msg = [{
                            'type': 'text',
                            'text': f'Tool result: {result_content}'
                        }]
                        if len(result_content) > 1024:
                            result_msg[0]['cache_control'] = {'type': 'ephemeral'}
                            
                        messages.extend([
                            {'role': 'assistant', 'content': tool_call_content},
                            {'role': 'user', 'content': result_msg}
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
