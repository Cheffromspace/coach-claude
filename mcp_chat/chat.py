import json
import os
import asyncio
from datetime import datetime
from rich.console import Console

from .conversation_manager import ConversationManager
from .system_prompts import initialize_prompt_system

class MCPChatInterface:
    def __init__(self, mcp_client, load_existing_history=False):
        """Initialize chat interface with an MCPClient instance"""
        self.mcp_client = mcp_client
        self.console = Console()
        
        # Initialize managers
        self.conversation_manager = ConversationManager()
        self.prompt_manager = initialize_prompt_system()
        
        # Start new session with default prompts if not loading history
        if not load_existing_history:
            default_prompts = self.prompt_manager.get_default_prompts()
            self.conversation_manager.start_session(system_prompts=default_prompts)

    def print_message(self, message):
        """Print a message to the console"""
        timestamp = message.get('timestamp', '')
        content = message.get('content', '')
        role = message.get('role', 'user')
        metadata = message.get('metadata', {})
        
        self.console.print(f"[bright_black][{timestamp}][/]", end=" ")
        if role == "user":
            self.console.print("You:", style="bright_blue", end=" ")
        else:
            self.console.print("Assistant:", style="bright_green", end=" ")
        self.console.print(content)
        
        # Print metadata if debug mode
        if metadata and os.getenv('MCP_DEBUG'):
            self.console.print(f"[dim]Metadata: {json.dumps(metadata, indent=2)}[/]")


    async def process_response(self, response: str):
        """Process and record assistant response with metadata"""
        # Parse response sections
        sections = response.split('\n')
        current_section = None
        metadata = {
            'sections': {},
            'tool_calls': []
        }
        
        for line in sections:
            if line.startswith('[') and line.endswith(']'):
                current_section = line[1:-1]
                metadata['sections'][current_section] = []
            elif current_section and line.strip():
                metadata['sections'][current_section].append(line.strip())
                
                # Track tool usage
                if current_section == 'Tool Call':
                    if line.startswith('Tool:'):
                        metadata['tool_calls'].append({
                            'tool': line.split(':', 1)[1].strip(),
                            'success': True  # Will be updated when result is processed
                        })
                elif current_section == 'Error':
                    if metadata['tool_calls']:
                        metadata['tool_calls'][-1]['success'] = False
                        metadata['tool_calls'][-1]['error'] = line
        
        # Add response to conversation
        self.conversation_manager.add_message(response, role="assistant", metadata=metadata)

    async def add_message(self, content: str, role: str = "user"):
        """Add a message and process with MCP if needed"""
        # Add message to conversation
        self.conversation_manager.add_message(content, role=role)
        
        # Get message for display
        messages = self.conversation_manager.current_session.messages
        self.print_message(messages[-1])

        if role == "user":
            try:
                # Get context including system prompts
                context = self.conversation_manager.get_context(include_system_prompts=True)
                
                # Process query
                response = await self.mcp_client.process_query(content, context)
                
                # Process and record response with metadata
                await self.process_response(response)
            except Exception as e:
                error_msg = f"Error processing message: {str(e)}"
                self.conversation_manager.add_message(
                    error_msg, 
                    role="assistant",
                    metadata={'error': str(e)}
                )

    def load_session(self, session_id: str) -> bool:
        """Load an existing session"""
        session = self.conversation_manager.load_session(session_id)
        if session:
            self.console.print(f"Loaded session {session_id}")
            return True
        return False

    def list_sessions(self):
        """List available sessions"""
        sessions = self.conversation_manager.list_sessions()
        if not sessions:
            self.console.print("No saved sessions found")
            return
            
        self.console.print("\nAvailable Sessions:")
        for session in sessions:
            self.console.print(
                f"[cyan]{session['session_id']}[/] - "
                f"Started: {session['start_time']}, "
                f"Messages: {session['message_count']}, "
                f"Tool Uses: {session['tool_usage_count']}"
            )

    async def run(self):
        """Run the chat interface"""
        self.console.print("MCP Chat Interface", style="bold blue")
        self.console.print("Available commands:", style="bright_black")
        self.console.print("  /quit - Exit the interface", style="bright_black")
        self.console.print("  /sessions - List saved sessions", style="bright_black")
        self.console.print("  /load <session_id> - Load a saved session", style="bright_black")
        self.console.print("----------------------------------------")
        
        # Print existing session messages
        if self.conversation_manager.current_session:
            for message in self.conversation_manager.current_session.messages:
                self.print_message(message)
        
        try:
            while True:
                # Use asyncio.get_event_loop().run_in_executor for non-blocking input
                loop = asyncio.get_event_loop()
                message = await loop.run_in_executor(None, lambda: input("> "))
                message = message.strip()
                
                if not message:
                    continue
                    
                # Handle commands
                if message.startswith('/'):
                    cmd_parts = message[1:].split()
                    cmd = cmd_parts[0].lower()
                    
                    if cmd == 'quit':
                        break
                    elif cmd == 'sessions':
                        self.list_sessions()
                    elif cmd == 'load' and len(cmd_parts) > 1:
                        session_id = cmd_parts[1]
                        if self.load_session(session_id):
                            # Print loaded session messages
                            for msg in self.conversation_manager.current_session.messages:
                                self.print_message(msg)
                    else:
                        self.console.print("Unknown command", style="red")
                else:
                    await self.add_message(message)
                    
        except KeyboardInterrupt:
            self.console.print("\nGoodbye!", style="bold red")
        finally:
            if self.conversation_manager.current_session:
                self.conversation_manager.save_session()
