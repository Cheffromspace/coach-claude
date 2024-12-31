"""
Claude System Monitor

Provides visibility into:
- System prompts seen by Claude
- Available tool definitions
"""

import json
from datetime import datetime
from typing import Dict, List

class RuntimeMonitor:
    def __init__(self):
        """Initialize the system monitor"""
        self.current_context = {
            'prompts': [],
            'tools': {}
        }

    def record_prompt(self, prompt: str, prompt_type: str = "task"):
        """Record a system prompt or task"""
        self.current_context['prompts'].append({
            'content': prompt,
            'type': prompt_type,
            'timestamp': datetime.now().isoformat()
        })

    def record_tool_description(self, tool_name: str, description: Dict):
        """Record information about an available tool"""
        self.current_context['tools'][tool_name] = {
            'description': description,
            'recorded_at': datetime.now().isoformat()
        }

    def get_prompt_history(self) -> List[Dict]:
        """Get the history of system prompts"""
        return self.current_context['prompts']

    def get_available_tools(self) -> Dict:
        """Get information about available tools"""
        return self.current_context['tools']

    def clear_context(self):
        """Clear the current context"""
        self.current_context = {
            'prompts': [],
            'tools': {}
        }

    def format_debug_view(self) -> str:
        """Format the current context into a readable view"""
        output = []
        
        # Format system prompts
        output.append("=== System Prompts ===")
        for prompt in self.current_context['prompts']:
            output.append(f"[{prompt['timestamp']}] Type: {prompt['type'].upper()}")
            output.append("Content:")
            output.append(prompt['content'])
            output.append("")
            
        # Format available tools
        output.append("=== Available Tools ===")
        for tool_name, tool_info in self.current_context['tools'].items():
            output.append(f"Tool: {tool_name}")
            output.append(f"Description: {json.dumps(tool_info['description'], indent=2)}")
            output.append(f"Registered: {tool_info['recorded_at']}")
            output.append("")
            
        return "\n".join(output)
