import logging
import json
from typing import Dict, List, Optional
from anthropic import Anthropic

logger = logging.getLogger(__name__)

class MessageProcessor:
    def __init__(self, server_manager, anthropic_client: Optional[Anthropic] = None):
        self.server_manager = server_manager
        self.anthropic = anthropic_client or Anthropic()
        self.max_iterations = 10

    async def process_query(self, query: str, context: Optional[List[Dict]] = None, health_check_interval: int = 60) -> str:
        """Process a query using Claude and available tools from all connected servers"""
        messages = context if context else []
        messages.append({
            "role": "user",
            "content": query
        })

        # Check server health
        await self.server_manager.check_servers_health(health_check_interval)
        
        # Get available tools
        available_tools = await self.server_manager.get_all_tools()

        # Initial Claude API call
        response = self.anthropic.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            messages=messages,
            tools=available_tools
        )

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
                        result_content = result.content[0].text if result.content and len(result.content) > 0 else 'No content'
                        tool_result_desc = f"\n[Tool Result]\n{result_content}"
                        print(tool_result_desc)
                        current_text.append(tool_result_desc)
                        
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
                response = self.anthropic.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=1000,
                    messages=messages,
                    tools=available_tools
                )
        
        if iteration >= self.max_iterations:
            warning = "\n[Warning]\nReached maximum number of tool call iterations."
            print(warning)
            final_text.append(warning)
            
        return "\n".join(final_text)
