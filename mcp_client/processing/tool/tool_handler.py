"""Handles tool execution and result management."""

import json
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

class ToolHandler:
    """Manages tool execution and results."""
    
    def __init__(self, server_manager):
        """Initialize with server manager."""
        self.server_manager = server_manager
        
    async def prepare_tools(self) -> List[Dict]:
        """Get and prepare available tools."""
        await self.server_manager.check_servers_health()
        available_tools = await self.server_manager.get_all_tools()
        logger.info(f"Found {len(available_tools)} available tools")
        
        # Cache first tool if available
        if available_tools:
            available_tools[0]['cache_control'] = {'type': 'ephemeral'}
            
        return available_tools
        
    async def execute_tool(self, tool_name: str, tool_args: Dict) -> Tuple[Optional[str], Optional[str]]:
        """Execute a tool and return its result and any error message.
        
        Returns:
            Tuple containing:
            - Tool result (if successful)
            - Error message (if failed)
        """
        try:
            tool_call_desc = f"\n[Tool Call]\nTool: {tool_name}\nArguments: {json.dumps(tool_args, indent=2)}"
            print(tool_call_desc)
            
            result = await self.server_manager.call_tool(tool_name, tool_args)
            if result is None:
                error_msg = f"Tool {tool_name} not found"
                return None, error_msg
                
            result_content = json.dumps(result, indent=2)
            print(f"\n[Tool Result]\n{result_content}")
            
            return result_content, None
            
        except Exception as e:
            error_msg = f"Error executing tool {tool_name}: {str(e)}"
            logger.error(error_msg)
            return None, error_msg
            
    def format_display(self, tool_name: str, tool_args: Dict, result: Optional[str] = None, error: Optional[str] = None) -> List[str]:
        """Format tool execution details for display.
        
        Returns:
            List of formatted display strings
        """
        display = []
        
        # Add tool call description
        tool_call_desc = f"\n[Tool Call]\nTool: {tool_name}\nArguments: {json.dumps(tool_args, indent=2)}"
        display.append(tool_call_desc)
        
        # Add result or error
        if result:
            display.append(f"\n[Tool Result]\n{result}")
        if error:
            display.append(f"\n[Error]\n{error}")
            
        return display
