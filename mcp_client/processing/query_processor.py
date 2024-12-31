"""Main query processor orchestrating all components with robust error handling."""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

from .api.claude_client import ClaudeClient
from .cache.cache_metrics import CacheMetrics
from .cache.cache_strategy import CacheStrategy
from .message.message_formatter import MessageFormatter
from .tool.tool_handler import ToolHandler

logger = logging.getLogger(__name__)

class QueryError(Exception):
    """Base class for query processing errors."""
    pass

class InitializationError(QueryError):
    """Error raised during initialization."""
    pass

class APIError(QueryError):
    """Error raised during API calls."""
    pass

class ToolError(QueryError):
    """Error raised during tool execution."""
    pass

class ProcessingState(Enum):
    """States for query processing."""
    INITIALIZING = "initializing"
    PREPARING = "preparing"
    PROCESSING = "processing"
    EXECUTING_TOOL = "executing_tool"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class ProcessingContext:
    """Context for query processing."""
    state: ProcessingState
    start_time: datetime
    iteration: int = 0
    last_error: Optional[Exception] = None
    tool_executions: int = 0
    retries: int = 0

class QueryProcessor:
    """Orchestrates query processing using modular components with comprehensive error handling."""
    
    def __init__(self, server_manager, anthropic_client=None):
        """Initialize QueryProcessor with its components."""
        self.claude_client = ClaudeClient(anthropic_client)
        self.tool_handler = ToolHandler(server_manager)
        self.max_iterations = 10
        self.max_retries = 3
        self.retry_delay = 1  # seconds
        self.tool_timeout = 30  # seconds
        self.processing_timeout = 300  # seconds
        self._active_contexts = {}  # Track active processing contexts
        
    async def initialize(self, timeout: int = 120) -> bool:
        """Initialize the query processor with enhanced error handling."""
        context = ProcessingContext(
            state=ProcessingState.INITIALIZING,
            start_time=datetime.now()
        )
        
        try:
            # Initialize with timeout protection
            async def init_with_timeout():
                try:
                    # Verify tool handler
                    if not await self.tool_handler.prepare_tools():
                        raise InitializationError("Failed to prepare tools")
                    
                    # Claude client is verified during construction via API key check
                    return True
                except Exception as e:
                    logger.error("Initialization error", exc_info=True)
                    raise InitializationError(f"Component initialization failed: {str(e)}")
            
            success = await asyncio.wait_for(init_with_timeout(), timeout=timeout)
            if not success:
                raise InitializationError("Initialization returned False")
                
            context.state = ProcessingState.COMPLETED
            return True
            
        except asyncio.TimeoutError:
            context.state = ProcessingState.FAILED
            context.last_error = TimeoutError(f"Initialization timed out after {timeout}s")
            logger.error(f"Initialization timed out after {timeout}s")
            return False
            
        except Exception as e:
            context.state = ProcessingState.FAILED
            context.last_error = e
            logger.error(f"Initialization failed: {str(e)}", exc_info=True)
            return False
        
    async def _execute_tool_with_retry(
        self,
        tool_name: str,
        tool_args: dict,
        context: ProcessingContext
    ) -> Tuple[Optional[Dict], Optional[str]]:
        """Execute a tool with retry logic."""
        retry_count = 0
        last_error = None
        
        while retry_count < self.max_retries:
            try:
                context.state = ProcessingState.EXECUTING_TOOL
                context.tool_executions += 1
                
                result, error = await asyncio.wait_for(
                    self.tool_handler.execute_tool(tool_name, tool_args),
                    timeout=self.tool_timeout
                )
                
                if error:
                    raise ToolError(error)
                    
                return result, None
                
            except asyncio.TimeoutError:
                last_error = f"Tool execution timed out after {self.tool_timeout}s"
                logger.error(f"Tool {tool_name} timed out")
                
            except Exception as e:
                last_error = str(e)
                logger.error(f"Tool execution error: {str(e)}", exc_info=True)
                
            retry_count += 1
            if retry_count < self.max_retries:
                delay = self.retry_delay * (2 ** (retry_count - 1))
                logger.info(f"Retrying tool execution in {delay}s")
                await asyncio.sleep(delay)
                
        return None, last_error

    async def process_query(self, query: str, context: Optional[List[Dict]] = None) -> str:
        """Process a query with comprehensive error handling and recovery."""
        query_id = id(query)
        proc_context = ProcessingContext(
            state=ProcessingState.PREPARING,
            start_time=datetime.now()
        )
        self._active_contexts[query_id] = proc_context
        final_text = []
        
        try:
            # Verify initialization
            if not await self.initialize():
                raise InitializationError("QueryProcessor not properly initialized")
            
            # Start processing with timeout protection
            async def process_with_timeout():
                try:
                    # Prepare messages and tools
                    messages, system = MessageFormatter.prepare_messages(query, context)
                    available_tools = await self.tool_handler.prepare_tools()
                    
                    proc_context.state = ProcessingState.PROCESSING
                    
                    # Process query with iterations
                    while proc_context.iteration < self.max_iterations:
                        proc_context.iteration += 1
                        current_text = []
                        
                        try:
                            # Make API call with retry logic
                            for attempt in range(self.max_retries):
                                try:
                                    response, metrics = await self.claude_client.create_message(
                                        messages=messages,
                                        tools=available_tools,
                                        system=system
                                    )
                                    break
                                except Exception as e:
                                    if "maximum of 4 blocks with cache_control" in str(e):
                                        # Handle cache block limit
                                        logger.warning("Cache block limit exceeded, attempting recovery")
                                        
                                        async def api_call_func(sys, tools):
                                            return await self.claude_client.create_message(
                                                messages=messages,
                                                tools=tools,
                                                system=sys
                                            )
                                        
                                        success, new_response, system, available_tools = await CacheStrategy.apply_strategies(
                                            system, available_tools, api_call_func
                                        )
                                        
                                        if success:
                                            response = new_response
                                            break
                                    
                                    if attempt == self.max_retries - 1:
                                        raise APIError(f"API call failed after {self.max_retries} attempts: {str(e)}")
                                    
                                    delay = self.retry_delay * (2 ** attempt)
                                    logger.info(f"Retrying API call in {delay}s")
                                    await asyncio.sleep(delay)
                            
                            # Process metrics
                            current_text.extend(CacheMetrics.format_metrics_display(metrics))
                            CacheMetrics.log_metrics(metrics)
                            
                            # Process response
                            current_text.append(f"\n[Iteration {proc_context.iteration}]")
                            display_text, has_tool_call, tool_call_info = self.claude_client.process_response(response)
                            current_text.extend(display_text)
                            
                            if has_tool_call and tool_call_info:
                                tool_name, tool_args = tool_call_info
                                
                                # Execute tool with retry logic
                                result, error = await self._execute_tool_with_retry(
                                    tool_name, tool_args, proc_context
                                )
                                
                                current_text.extend(self.tool_handler.format_display(
                                    tool_name, tool_args, result, error
                                ))
                                
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
                                
                        except Exception as e:
                            logger.error(f"Error in iteration {proc_context.iteration}: {str(e)}", exc_info=True)
                            proc_context.last_error = e
                            if proc_context.iteration < self.max_iterations:
                                continue
                            raise
                    
                    if proc_context.iteration >= self.max_iterations:
                        final_text.append("\n[Warning]\nReached maximum number of tool call iterations.")
                    
                    proc_context.state = ProcessingState.COMPLETED
                    return "\n".join(final_text)
                    
                except Exception as e:
                    proc_context.state = ProcessingState.FAILED
                    proc_context.last_error = e
                    raise
            
            result = await asyncio.wait_for(
                process_with_timeout(),
                timeout=self.processing_timeout
            )
            return result
            
        except asyncio.TimeoutError:
            error_msg = f"Query processing timed out after {self.processing_timeout}s"
            logger.error(error_msg)
            return f"\n[Error]\n{error_msg}"
            
        except Exception as e:
            error_msg = f"Error processing query: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return f"\n[Error]\n{error_msg}"
            
        finally:
            # Clean up context
            if query_id in self._active_contexts:
                del self._active_contexts[query_id]
