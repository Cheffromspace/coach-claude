import json
import os
from datetime import datetime
from rich.console import Console
from rich.prompt import Prompt
from rich.panel import Panel
from rich.text import Text
from rich.live import Live
from rich.layout import Layout

class MCPChatInterface:
    def __init__(self, mcp_client):
        """Initialize chat interface with an MCPClient instance"""
        self.mcp_client = mcp_client
        self.console = Console()
        self.history_file = "chat_history.json"
        self.history = self.load_history()
        self.layout = self._create_layout()

    def _create_layout(self):
        """Create the terminal UI layout"""
        layout = Layout()
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="body", ratio=8),
            Layout(name="input", size=3)
        )
        return layout

    def load_history(self):
        """Load chat history from file"""
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return []
        return []

    def save_history(self):
        """Save chat history to file"""
        with open(self.history_file, 'w') as f:
            json.dump(self.history, f, indent=2)

    def format_message(self, message):
        """Format a message for display"""
        timestamp = message.get('timestamp', '')
        content = message.get('content', '')
        role = message.get('role', 'user')
        
        text = Text()
        text.append(f"[{timestamp}] ", style="bright_black")
        
        if role == "user":
            text.append("You: ", style="bright_blue")
        else:
            text.append("Assistant: ", style="bright_green")
        
        text.append(content)
        return Panel(text, border_style="bright_black")

    def update_display(self):
        """Update the terminal display"""
        # Update header
        self.layout["header"].update(
            Panel("MCP Chat Interface", style="bold blue", border_style="blue")
        )
        
        # Update message history
        history_text = Text()
        for message in self.history:
            history_text.append(self.format_message(message))
            history_text.append("\n")
        self.layout["body"].update(Panel(history_text, title="Chat History"))
        
        # Update input area
        self.layout["input"].update(
            Panel("Type your message (Ctrl+C to exit)", style="bold yellow")
        )

    async def add_message(self, content, role="user"):
        """Add a message to history and process with MCP if needed"""
        message = {
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'content': content,
            'role': role
        }
        self.history.append(message)
        self.save_history()

        if role == "user":
            # Process through MCP client
            try:
                response = await self.mcp_client.process_query(content)
                await self.add_message(response, role="assistant")
            except Exception as e:
                error_msg = f"Error processing message: {str(e)}"
                await self.add_message(error_msg, role="assistant")

    async def run(self):
        """Run the chat interface"""
        self.console.clear()
        
        try:
            with Live(self.layout, refresh_per_second=4, screen=True):
                while True:
                    self.update_display()
                    message = Prompt.ask("\nEnter your message")
                    
                    if message.strip().lower() == 'quit':
                        break
                        
                    if message.strip():
                        await self.add_message(message)
                        
        except KeyboardInterrupt:
            self.console.print("\nGoodbye!", style="bold red")
        finally:
            self.save_history()
