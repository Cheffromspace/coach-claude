import json
import os
import asyncio
from datetime import datetime
from rich.console import Console

class MCPChatInterface:
    def __init__(self, mcp_client, load_existing_history=False):
        """Initialize chat interface with an MCPClient instance"""
        self.mcp_client = mcp_client
        self.console = Console()
        os.makedirs('chat_history', exist_ok=True)
        self.history_file = os.path.join('chat_history', 'chat_history.json')
        self.history = self.load_history() if load_existing_history else []

    def load_history(self):
        """Load chat history from file"""
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return []
        return []

    def clear_history(self):
        """Clear chat history and backup the old one"""
        if os.path.exists(self.history_file):
            backup_file = os.path.join('chat_history', f"chat_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
            os.rename(self.history_file, backup_file)
        self.history = []
        self.save_history()

    def save_history(self):
        """Save chat history to file"""
        with open(self.history_file, 'w') as f:
            json.dump(self.history, f, indent=2)

    def print_message(self, message):
        """Print a message to the console"""
        timestamp = message.get('timestamp', '')
        content = message.get('content', '')
        role = message.get('role', 'user')
        
        self.console.print(f"[bright_black][{timestamp}][/]", end=" ")
        if role == "user":
            self.console.print("You:", style="bright_blue", end=" ")
        else:
            self.console.print("Assistant:", style="bright_green", end=" ")
        self.console.print(content)

    def get_conversation_context(self, limit=10):
        """Get recent conversation history as context"""
        recent_messages = self.history[-limit:] if self.history else []
        return [
            {
                'role': msg['role'],
                'content': msg['content']
            }
            for msg in recent_messages
        ]

    async def add_message(self, content, role="user"):
        """Add a message to history and process with MCP if needed"""
        message = {
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'content': content,
            'role': role
        }
        self.history.append(message)
        self.print_message(message)
        self.save_history()

        if role == "user":
            try:
                context = self.get_conversation_context()
                response = await self.mcp_client.process_query(content, context)
                await self.add_message(response, role="assistant")
            except Exception as e:
                error_msg = f"Error processing message: {str(e)}"
                await self.add_message(error_msg, role="assistant")

    async def run(self):
        """Run the chat interface"""
        self.console.print("MCP Chat Interface - Type 'quit' to exit", style="bold blue")
        self.console.print("----------------------------------------")
        
        # Print existing history
        for message in self.history:
            self.print_message(message)
        
        try:
            while True:
                # Use asyncio.get_event_loop().run_in_executor for non-blocking input
                loop = asyncio.get_event_loop()
                message = await loop.run_in_executor(None, lambda: input("> "))
                
                if message.strip().lower() == 'quit':
                    break
                    
                if message.strip():
                    await self.add_message(message)
                    
        except KeyboardInterrupt:
            self.console.print("\nGoodbye!", style="bold red")
        finally:
            self.save_history()
