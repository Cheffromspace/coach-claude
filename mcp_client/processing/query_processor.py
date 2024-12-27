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
        
        # Extract system prompts and prepare messages with smart cache management
        messages = []
        system = []
        MAX_CACHE_BLOCKS = 4
        cache_blocks = 0
        cache_metrics = {}
        
        # Helper function to prioritize content for caching
        def get_cache_priority(content, is_tool=False):
            if is_tool:
                return 100  # Highest priority for tools
            
            # Calculate priority based on content characteristics
            priority = 0
            if isinstance(content, dict):
                text = content.get('text', '')
            else:
                text = str(content)
                
            # Prioritize longer content that's more valuable to cache
            priority += min(len(text) / 1000, 50)  # Up to 50 points for length
            
            # Prioritize content with specific keywords
            important_keywords = ['personality', 'context', 'documentation', 'system']
            for keyword in important_keywords:
                if keyword.lower() in text.lower():
                    priority += 10
                    
            return priority
            
        if context:
            # First pass: collect and prioritize all system content
            system_blocks = []
            for msg in context:
                if msg.get('role') == 'system':
                    content = msg.get('content', '')
                    
                    # Convert content to standard block format
                    if isinstance(content, dict):
                        content_block = content
                    elif isinstance(content, list):
                        # Add non-last blocks without prioritization
                        system.extend(content[:-1])
                        content_block = content[-1] if content else None
                    else:
                        content_block = {
                            'type': 'text',
                            'text': str(content)
                        }
                    
                    if content_block:
                        priority = get_cache_priority(content_block)
                        system_blocks.append((content_block, priority))
            
            # Sort blocks by priority (highest first)
            system_blocks.sort(key=lambda x: x[1], reverse=True)
            
            # Allocate cache blocks based on priority
            cache_slots = MAX_CACHE_BLOCKS - 1  # Reserve 1 for tools
            for content_block, priority in system_blocks:
                if cache_slots > 0 and priority > 20:  # Only cache high-priority blocks
                    content_block['cache_control'] = {"type": "ephemeral"}
                    cache_slots -= 1
                    cache_blocks += 1
                system.append(content_block)
                
            # Process non-system messages
            for msg in context:
                if msg.get('role') != 'system':
                    # Add regular messages to messages list without caching
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
        
        # Add environment details to query as structured content
        formatted_query = [{
            'type': 'text',
            'text': f"{query}\n\nEnvironment Details:\n{os.environ.get('ENVIRONMENT_DETAILS', '')}"
        }]
        messages.append({'role': 'user', 'content': formatted_query})
        
        # Get available tools and ensure they get cache priority
        await self.server_manager.check_servers_health()
        available_tools = await self.server_manager.get_all_tools()
        
        if available_tools:
            # Always cache the most frequently used tools
            tool_priorities = [(tool, get_cache_priority(tool, is_tool=True)) for tool in available_tools]
            tool_priorities.sort(key=lambda x: x[1], reverse=True)
            
            # Ensure at least one tool gets cached
            if cache_blocks < MAX_CACHE_BLOCKS:
                tool_priorities[0][0]['cache_control'] = {"type": "ephemeral"}
                cache_blocks += 1
                
                # Cache additional high-priority tools if space allows
                for tool, priority in tool_priorities[1:]:
                    if cache_blocks >= MAX_CACHE_BLOCKS:
                        break
                    if priority > 50:  # Only cache very high priority tools
                        tool['cache_control'] = {"type": "ephemeral"}
                        cache_blocks += 1
            
        logger.info(f"Found {len(available_tools)} available tools")
        logger.info(f"Using {cache_blocks}/{MAX_CACHE_BLOCKS} cache blocks")

        # Process query with Claude and handle tool calls
        final_text = []
        iteration = 0
        
        while iteration < self.max_iterations:
            iteration += 1
            current_text = []
            
            # Make Claude API call
            create_params = {
                "model": self.model,
                "max_tokens": 2000,
                "messages": messages,
                "tools": available_tools
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
                
                # Log cache performance metrics
                usage = response.usage
                try:
                    cache_metrics = {
                        'cache_creation_input_tokens': usage.cache_creation_input_tokens,
                        'cache_read_input_tokens': usage.cache_read_input_tokens,
                        'input_tokens': usage.input_tokens,
                        'output_tokens': usage.output_tokens
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
                except AttributeError:
                    logger.info("Cache metrics not available in response")
                    cache_metrics = {
                        'cache_creation_input_tokens': 0,
                        'cache_read_input_tokens': 0,
                        'input_tokens': usage.input_tokens if hasattr(usage, 'input_tokens') else 0,
                        'output_tokens': usage.output_tokens if hasattr(usage, 'output_tokens') else 0
                    }
                
            except Exception as e:
                if "maximum of 4 blocks with cache_control" in str(e):
                    logger.warning("Cache block limit exceeded, retrying with reduced caching")
                    
                    # Create a copy of system blocks and tools to preserve originals
                    system_copy = [block.copy() for block in system]
                    tools_copy = [tool.copy() for tool in available_tools]
                    
                    # Define retry strategies
                    retry_strategies = [
                        # Strategy 1: Keep only two most recent system blocks
                        lambda s, t: (
                            [b if i >= len(s)-2 else {k: v for k, v in b.items() if k != 'cache_control'} 
                             for i, b in enumerate(s)],
                            t
                        ),
                        # Strategy 2: Keep only one system block and one tool
                        lambda s, t: (
                            [b if i == len(s)-1 else {k: v for k, v in b.items() if k != 'cache_control'} 
                             for i, b in enumerate(s)],
                            [t[0]] + [{k: v for k, v in tool.items() if k != 'cache_control'} for tool in t[1:]]
                        ),
                        # Strategy 3: Remove all cache blocks
                        lambda s, t: (
                            [{k: v for k, v in b.items() if k != 'cache_control'} for b in s],
                            [{k: v for k, v in tool.items() if k != 'cache_control'} for tool in t]
                        )
                    ]
                    
                    success = False
                    for strategy_num, strategy in enumerate(retry_strategies, 1):
                        try:
                            logger.info(f"Trying cache reduction strategy {strategy_num}")
                            
                            # Apply strategy
                            system_modified, tools_modified = strategy(system_copy, tools_copy)
                            
                            # Update create_params with modified blocks
                            create_params.update({
                                "system": system_modified,
                                "tools": tools_modified
                            })
                            
                            # Attempt API call with reduced caching and timeout
                            loop = asyncio.get_event_loop()
                            response = await asyncio.wait_for(
                                loop.run_in_executor(
                                    None,
                                    lambda: self.anthropic.messages.create(**create_params)
                                ),
                                timeout=self.api_timeout
                            )
                            logger.info(f"Strategy {strategy_num} succeeded")
                            success = True
                            break
                        except asyncio.TimeoutError:
                            logger.warning(f"Strategy {strategy_num} timed out")
                            continue
                        except Exception as retry_e:
                            if "maximum of 4 blocks with cache_control" not in str(retry_e):
                                error_msg = f"Claude API call failed on retry: {str(retry_e)}"
                                logger.error(error_msg, exc_info=True)
                                return f"\n[Error]\n{error_msg}"
                            logger.warning(f"Strategy {strategy_num} failed, trying next")
                            continue
                    
                    if not success:
                        error_msg = "Failed to resolve cache block issues after trying all strategies"
                        logger.error(error_msg)
                        return f"\n[Error]\n{error_msg}"
                else:
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
                        
                        # Update conversation context with structured content without caching
                        tool_call_content = [{
                            'type': 'text',
                            'text': f'Using tool: {tool_name} with arguments: {json.dumps(tool_args)}'
                        }]
                        
                        result_msg = [{
                            'type': 'text',
                            'text': f'Tool result: {result_content}'
                        }]
                            
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
