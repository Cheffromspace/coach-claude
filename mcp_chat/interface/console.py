"""
Console Interface Module

Handles console-based user interaction and message display.
"""

from rich.console import Console
import json
import os
from datetime import datetime

class ConsoleInterface:
    def __init__(self):
        self.console = Console()

    def print_message(self, message):
        """Print a message to the console"""
        if isinstance(message, dict):
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
        else:
            # Handle simple string messages
            self.console.print(message)

    def print_sessions(self, sessions):
        """Print available sessions with numbers"""
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

    def print_help(self):
        """Print available commands"""
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
        self.console.print("  /new - Start a new chat session", style="bright_black")
        self.console.print("----------------------------------------")

    def print_cache_stats(self, stats):
        """Print cache performance statistics"""
        if not stats:
            self.console.print("No cache statistics available", style="yellow")
            return

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
        
        if 'active_cache_blocks' in stats:
            self.console.print("\nCache Block Statistics:", style="bold blue")
            self.console.print(f"Active Blocks: {stats['active_cache_blocks']}")
            self.console.print(f"Cleaned Blocks: {stats['cleaned_cache_blocks']}")
            self.console.print(f"Total Blocks Created: {stats['total_cache_blocks_created']}")
