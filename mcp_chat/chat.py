import json
import os
import asyncio
import logging
import pyperclip
from datetime import datetime
from rich.console import Console

from .conversation_manager import ConversationManager
from .system_prompts import initialize_prompt_system

logger = logging.getLogger(__name__)

class MCPChatInterface:
    def __init__(self, mcp_client, load_existing_history=False):
        """Initialize chat interface with an MCPClient instance"""
        self.mcp_client = mcp_client
        self.console = Console()
        
        # Initialize managers
        self.conversation_manager = ConversationManager()
        self.prompt_manager = initialize_prompt_system()
        
        # Start new session with core coaching personality if not loading history
        if not load_existing_history:
            # Get core personality prompt
            logger.debug("Initializing new session with core personality prompt")
            personality = self.prompt_manager.get_template('coach_personality')
            if personality:
                logger.debug(f"Got personality template: {personality.name}")
                system_prompt = {
                    'type': 'text',
                    'text': personality.content,
                    'cache_control': personality.cache_control
                }
                logger.debug(f"Created system prompt: {json.dumps(system_prompt, indent=2)}")
                
                # Initialize with core personality and default context
                initial_context = {
                    'message_type': 'task',
                    'interaction_phase': 'start',
                    'sensitive_data': True,
                    'tools_needed': []
                }
                logger.debug(f"Starting session with context: {json.dumps(initial_context, indent=2)}")
                
                self.conversation_manager.start_session(
                    initial_context=initial_context,
                    system_prompts=[system_prompt]  # Start with core personality
                )
                logger.debug("Session started with core personality")
            else:
                logger.error("Failed to get coach_personality template")

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
            
        # Handle structured content
        if isinstance(content, dict):
            self.console.print(content.get('text', ''))
        else:
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
        
        # Add response to conversation with caching for long responses
        self.conversation_manager.add_message(
            response, 
            role="assistant", 
            metadata=metadata,
            cache=len(response) > 1024  # Cache long responses
        )

    async def add_message(self, content: str, role: str = "user", cache: bool = False, update_prompts: bool = True):
        """Add a message and process with MCP if needed"""
        # Add message to conversation with optional caching and prompt updates
        self.conversation_manager.add_message(
            content, 
            role=role, 
            cache=cache,
            update_prompts=update_prompts
        )
        
        # Get message for display
        messages = self.conversation_manager.current_session.messages
        self.print_message(messages[-1])

        if role == "user":
            try:
                # Get context including system prompts and cached conversation
                context = self.conversation_manager.get_context(
                    include_system_prompts=True,
                    cache_conversation=True
                )
                
                # Process query with the new context format
                response = await self.mcp_client.process_query(content, context)
                
                # Extract cache metrics if available
                cache_metrics = {}
                if '[Cache Performance]' in response:
                    lines = response.split('\n')
                    in_cache_section = False
                    for line in lines:
                        if '[Cache Performance]' in line:
                            in_cache_section = True
                            continue
                        if in_cache_section and line.strip():
                            if ':' in line:
                                key, value = line.split(':', 1)
                                key = key.strip().lower().replace(' ', '_')
                                try:
                                    value = int(value.strip())
                                    cache_metrics[key] = value
                                except ValueError:
                                    continue
                            else:
                                in_cache_section = False
                                break
                
                # Log cache metrics if available
                if cache_metrics:
                    logger.info("Cache Performance Metrics:")
                    for key, value in cache_metrics.items():
                        logger.info(f"  {key}: {value}")
                
                # Process and record response with metadata
                await self.process_response(response)
            except KeyError as e:
                logger.error(f"Metadata access error: {str(e)}")
                error_msg = "Internal error: Session metadata is incomplete. Starting new session."
                self.conversation_manager.start_session()  # Reset session with proper metadata
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}")
                error_msg = f"Error processing message: {str(e)}"
                self.conversation_manager.add_message(
                    error_msg, 
                    role="assistant",
                    metadata={'error': str(e)}
                )

    def load_session(self, session_identifier: str) -> bool:
        """Load an existing session by number or ID"""
        sessions = self.conversation_manager.list_sessions()
        
        # Try to load by number
        try:
            session_num = int(session_identifier)
            if 1 <= session_num <= len(sessions):
                session_id = sessions[session_num - 1]['session_id']
                session = self.conversation_manager.load_session(session_id)
                if session:
                    self.console.print(f"Loaded session {session_num}")
                    return True
            else:
                self.console.print(f"Invalid session number. Please choose 1-{len(sessions)}")
                return False
        except ValueError:
            # If not a number, try loading by ID directly
            session = self.conversation_manager.load_session(session_identifier)
            if session:
                self.console.print(f"Loaded session {session_identifier}")
                return True
            self.console.print("Session not found")
            return False

    def list_sessions(self, limit: int = 10):
        """List available sessions with numbers"""
        sessions = self.conversation_manager.list_sessions(limit)
        if not sessions:
            self.console.print("No saved sessions found")
            return
            
        self.console.print("\nRecent Sessions:")
        for i, session in enumerate(sessions, 1):
            # Parse and format the datetime
            start_time = datetime.fromisoformat(session['start_time'])
            formatted_time = start_time.strftime("%Y-%m-%d %H:%M")
            
            self.console.print(
                f"[cyan]{i:2d}[/] | {formatted_time} | "
                f"Messages: {session['message_count']:3d} | "
                f"[dim]{session['first_message']}[/]"
            )

    async def add_system_prompt(self, template_name: str):
        """Add a system prompt dynamically"""
        template = self.prompt_manager.get_template(template_name)
        if template and self.conversation_manager.current_session:
            system_prompt = {
                'type': 'text',
                'text': template.content,
                'cache_control': template.cache_control
            }
            self.conversation_manager.current_session.system_prompts.append(system_prompt)
            self.conversation_manager.save_session()
            return True
        return False

    async def add_documentation(self, content: str, description: str = "Documentation"):
        """Add documentation or large text content with caching enabled"""
        system_content = {
            'type': 'text',
            'text': content,
            'cache_control': {'type': 'ephemeral'}
        }
        
        # Add as a system message with cache control
        self.conversation_manager.add_message(
            system_content,
            role="system",
            metadata={'type': 'documentation', 'description': description},
            cache=True
        )

    async def run(self):
        """Run the chat interface"""
        self.console.print("MCP Chat Interface", style="bold blue")
        self.console.print("Available commands:", style="bright_black")
        self.console.print("  /quit - Exit the interface", style="bright_black")
        self.console.print("  /sessions [limit] - List saved sessions (optional: number of sessions to show)", style="bright_black")
        self.console.print("  /archive_sessions <numbers> - Archive sessions by their numbers (space-separated)", style="bright_black")
        self.console.print("  /load <number> - Load a saved session by number", style="bright_black")
        self.console.print("  /doc <content> - Add documentation with caching", style="bright_black")
        self.console.print("  /cache - Show cache performance statistics", style="bright_black")
        self.console.print("  /paste - Send clipboard contents (with preview for large content)", style="bright_black")
        self.console.print("  /remove <n> - Remove last n conversation turns", style="bright_black")
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

                # Handle paste command
                if message == '/paste':
                    try:
                        content = pyperclip.paste()
                        if not content:
                            self.console.print("Clipboard is empty", style="yellow")
                            continue
                            
                        if len(content) > 1000:
                            self.console.print(f"Clipboard content is {len(content)} characters. Preview of first 100 characters:", style="yellow")
                            self.console.print(content[:100] + "...", style="bright_black")
                            self.console.print("Type 'y' to confirm paste, anything else to cancel:", style="yellow")
                            confirm = await loop.run_in_executor(None, input)
                            if confirm.lower() != 'y':
                                self.console.print("Paste cancelled", style="yellow")
                                continue
                                
                        await self.add_message(content)
                    except Exception as e:
                        self.console.print(f"Error accessing clipboard: {str(e)}", style="red")
                    continue
                    
                # Handle commands
                if message.startswith('/'):
                    cmd_parts = message[1:].split(maxsplit=1)
                    cmd = cmd_parts[0].lower()
                    
                    if cmd == 'quit':
                        break
                    elif cmd == 'sessions':
                        limit = int(cmd_parts[1]) if len(cmd_parts) > 1 else 10
                        self.list_sessions(limit)
                    elif cmd == 'archive_sessions' and len(cmd_parts) > 1:
                        try:
                            session_numbers = [int(n) for n in cmd_parts[1].split()]
                            sessions = self.conversation_manager.list_sessions()
                            archived = 0
                            for num in session_numbers:
                                if 1 <= num <= len(sessions):
                                    session_id = sessions[num - 1]['session_id']
                                    if self.conversation_manager.archive_session(session_id):
                                        archived += 1
                            self.console.print(f"Archived {archived} session(s)", style="green")
                            self.console.print("Sessions can be found in the chat_history/archived_sessions directory", style="bright_black")
                        except ValueError:
                            self.console.print("Invalid session number format", style="red")
                    elif cmd == 'load' and len(cmd_parts) > 1:
                        session_id = cmd_parts[1]
                        if self.load_session(session_id):
                            # Print loaded session messages
                            for msg in self.conversation_manager.current_session.messages:
                                self.print_message(msg)
                    elif cmd == 'doc' and len(cmd_parts) > 1:
                        content = cmd_parts[1]
                        await self.add_documentation(content)
                        self.console.print("Documentation added with caching enabled", style="green")
                    elif cmd == 'remove' and len(cmd_parts) > 1:
                        try:
                            count = int(cmd_parts[1])
                            if count <= 0:
                                self.console.print("Number of turns must be positive", style="red")
                            elif self.conversation_manager.remove_messages(count):
                                self.console.print(f"Removed last {count} conversation turns", style="green")
                            else:
                                self.console.print("Not enough messages to remove", style="yellow")
                        except ValueError:
                            self.console.print("Invalid number format", style="red")
                    elif cmd == 'cache':
                        stats = self.conversation_manager.get_cache_stats()
                        if stats:
                            self.console.print("\nCache Performance Statistics:", style="bold blue")
                            self.console.print(f"Total Requests: {stats['total_requests']}")
                            self.console.print(f"Cache Hits: {stats['cache_hits']}")
                            if stats['total_requests'] > 0:
                                hit_rate = (stats['cache_hits'] / stats['total_requests']) * 100
                                self.console.print(f"Cache Hit Rate: {hit_rate:.1f}%")
                            
                            self.console.print("\nToken Usage:")
                            self.console.print(f"Cache Creation Tokens: {stats['total_cache_creation_tokens']}")
                            self.console.print(f"Cache Read Tokens: {stats['total_cache_read_tokens']}")
                            self.console.print(f"Uncached Tokens: {stats['total_uncached_tokens']}")
                            self.console.print(f"Output Tokens: {stats['total_output_tokens']}")
                            
                            if 'token_savings' in stats:
                                self.console.print(f"\nToken Savings: {stats['token_savings']:.1f}%")
                            
                                # Display cache block statistics if available
                                if 'active_cache_blocks' in stats:
                                    self.console.print("\nCache Block Statistics:", style="bold blue")
                                    self.console.print(f"Active Blocks: {stats['active_cache_blocks']}")
                                    self.console.print(f"Cleaned Blocks: {stats['cleaned_cache_blocks']}")
                                    self.console.print(f"Total Blocks Created: {stats['total_cache_blocks_created']}")
                        else:
                            self.console.print("No cache statistics available", style="yellow")
                    else:
                        self.console.print("Unknown command", style="red")
                else:
                    await self.add_message(message)
                    
        except KeyboardInterrupt:
            self.console.print("\nGoodbye!", style="bold red")
        finally:
            if self.conversation_manager.current_session:
                self.conversation_manager.save_session()
