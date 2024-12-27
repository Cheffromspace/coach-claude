"""
MCP Chat Interface Module

Main interface for the MCP chat system, coordinating between various components.
"""

import asyncio
import logging
import pyperclip
from typing import Optional

from .interface.console import ConsoleInterface
from .processing.message_processor import MessageProcessor
from .session.session_manager import SessionManager
from .cache.cache_manager import CacheManager
from .prompts.prompt_manager import SystemPromptManager
from .nlp.context_analyzer import analyze_message_context

logger = logging.getLogger(__name__)

class MCPChatInterface:
    def __init__(self, mcp_client, load_existing_history=False):
        """Initialize chat interface with an MCPClient instance"""
        self.mcp_client = mcp_client
        
        # Initialize components
        self.console = ConsoleInterface()
        self.session_manager = SessionManager()
        self.cache_manager = CacheManager()
        self.prompt_manager = SystemPromptManager()
        self.message_processor = MessageProcessor(self.session_manager)
        
        # Start new session with core coaching personality if not loading history
        if not load_existing_history:
            logger.debug("Initializing new session with core personality prompt")
            personality = self.prompt_manager.get_template('coach_personality')
            if personality:
                logger.debug(f"Got personality template: {personality.name}")
                system_prompt = {
                    'type': 'text',
                    'text': personality.content,
                    'cache_control': personality.cache_control
                }
                
                # Initialize with core personality and default context
                initial_context = {
                    'message_type': 'task',
                    'interaction_phase': 'start',
                    'sensitive_data': True,
                    'tools_needed': []
                }
                logger.debug(f"Starting session with context: {initial_context}")
                
                self.session_manager.start_session(
                    initial_context=initial_context,
                    system_prompts=[system_prompt]
                )
                logger.debug("Session started with core personality")
            else:
                logger.error("Failed to get coach_personality template")

    def load_session(self, session_identifier: str) -> bool:
        """Load an existing session by number or ID"""
        sessions = self.session_manager.list_sessions()
        
        # Try to load by number
        try:
            session_num = int(session_identifier)
            if 1 <= session_num <= len(sessions):
                session_id = sessions[session_num - 1]['session_id']
                session = self.session_manager.load_session(session_id)
                if session:
                    self.console.print_message(f"Loaded session {session_num}")
                    return True
            else:
                self.console.print_message(f"Invalid session number. Please choose 1-{len(sessions)}")
                return False
        except ValueError:
            # If not a number, try loading by ID directly
            session = self.session_manager.load_session(session_identifier)
            if session:
                self.console.print_message(f"Loaded session {session_identifier}")
                return True
            self.console.print_message("Session not found")
            return False

    async def add_message(self, content: str, role: str = "user", cache: bool = False, update_prompts: bool = True):
        """Add a message and process with MCP if needed"""
        # Add message to conversation
        await self.message_processor.add_message(content, role, cache, update_prompts)
        
        # Get message for display
        if self.session_manager.current_session:
            messages = self.session_manager.current_session.messages
            self.console.print_message(messages[-1])

        if role == "user":
            try:
                # Analyze message context
                context = analyze_message_context(content)
                
                # Get conversation context with caching
                messages_context = self.cache_manager.get_context_with_caching(
                    self.session_manager.current_session.messages
                )
                
                # Add system prompts
                context_with_prompts = messages_context + [
                    {'role': 'system', 'content': prompt}
                    for prompt in self.session_manager.current_session.system_prompts
                ]
                
                # Process query
                response = await self.mcp_client.process_query(content, context_with_prompts)
                
                # Extract and update cache metrics
                cache_metrics = self.message_processor.extract_cache_metrics(response)
                if cache_metrics:
                    self.cache_manager.update_cache_stats(cache_metrics)
                
                # Process and record response
                await self.message_processor.process_response(response)
                
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}")
                error_msg = f"Error processing message: {str(e)}"
                await self.message_processor.add_message(
                    error_msg, 
                    role="assistant",
                    metadata={'error': str(e)}
                )

    async def add_system_prompt(self, template_name: str):
        """Add a system prompt dynamically"""
        return await self.message_processor.add_system_prompt(template_name)

    async def add_documentation(self, content: str, description: str = "Documentation"):
        """Add documentation or large text content with caching enabled"""
        await self.message_processor.add_documentation(content, description)

    async def run(self):
        """Run the chat interface"""
        self.console.print_help()
        
        # Print existing session messages
        if self.session_manager.current_session:
            for message in self.session_manager.current_session.messages:
                self.console.print_message(message)
        
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
                            self.console.print_message("Clipboard is empty")
                            continue
                            
                        if len(content) > 1000:
                            self.console.print_message(
                                f"Clipboard content is {len(content)} characters. Preview of first 100 characters:"
                            )
                            self.console.print_message(content[:100] + "...")
                            self.console.print_message("Type 'y' to confirm paste, anything else to cancel:")
                            confirm = await loop.run_in_executor(None, input)
                            if confirm.lower() != 'y':
                                self.console.print_message("Paste cancelled")
                                continue
                                
                        await self.add_message(content)
                    except Exception as e:
                        self.console.print_message(f"Error accessing clipboard: {str(e)}")
                    continue
                    
                # Handle commands
                if message.startswith('/'):
                    cmd_parts = message[1:].split(maxsplit=1)
                    cmd = cmd_parts[0].lower()
                    
                    if cmd == 'quit':
                        break
                    elif cmd == 'sessions':
                        limit = int(cmd_parts[1]) if len(cmd_parts) > 1 else 10
                        sessions = self.session_manager.list_sessions(limit)
                        self.console.print_sessions(sessions)
                    elif cmd == 'archive_sessions' and len(cmd_parts) > 1:
                        try:
                            session_numbers = [int(n) for n in cmd_parts[1].split()]
                            sessions = self.session_manager.list_sessions()
                            archived = 0
                            for num in session_numbers:
                                if 1 <= num <= len(sessions):
                                    session_id = sessions[num - 1]['session_id']
                                    if self.session_manager.archive_session(session_id):
                                        archived += 1
                            self.console.print_message(f"Archived {archived} session(s)")
                            self.console.print_message(
                                "Sessions can be found in the chat_history/archived_sessions directory"
                            )
                        except ValueError:
                            self.console.print_message("Invalid session number format")
                    elif cmd == 'load' and len(cmd_parts) > 1:
                        session_id = cmd_parts[1]
                        if self.load_session(session_id):
                            # Print loaded session messages
                            for msg in self.session_manager.current_session.messages:
                                self.console.print_message(msg)
                    elif cmd == 'doc' and len(cmd_parts) > 1:
                        content = cmd_parts[1]
                        await self.add_documentation(content)
                        self.console.print_message("Documentation added with caching enabled")
                    elif cmd == 'remove' and len(cmd_parts) > 1:
                        try:
                            count = int(cmd_parts[1])
                            if count <= 0:
                                self.console.print_message("Number of turns must be positive")
                            elif self.session_manager.remove_messages(count):
                                self.console.print_message(f"Removed last {count} conversation turns")
                            else:
                                self.console.print_message("Not enough messages to remove")
                        except ValueError:
                            self.console.print_message("Invalid number format")
                    elif cmd == 'cache':
                        stats = self.cache_manager.get_cache_stats()
                        self.console.print_cache_stats(stats)
                    else:
                        self.console.print_message("Unknown command")
                else:
                    await self.add_message(message)
                    
        except KeyboardInterrupt:
            self.console.print_message("\nGoodbye!")
        finally:
            if self.session_manager.current_session:
                self.session_manager.save_session()
