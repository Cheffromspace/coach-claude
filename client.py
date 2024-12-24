import asyncio
import logging
import json
import os
import subprocess
import time
from typing import Dict, Optional, Tuple
from contextlib import AsyncExitStack
from datetime import datetime, timedelta

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from anthropic import Anthropic
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()  # load environment variables from .env

class MCPClient:
    def __init__(self):
        # Initialize session and client objects
        self.sessions = {}  # Dictionary to store multiple sessions
        self.exit_stack = AsyncExitStack()
        self.anthropic = Anthropic()
        self.server_processes = {}  # Dictionary to store server processes
        self.last_health_checks = {}  # Dictionary to store health check times
        self.connected_servers = set()  # Set of connected server names
        self.max_retries = 3
        self.retry_delay = 1  # Initial delay in seconds
        
        # Load MCP server config
        self.config = self._load_config()

    async def _check_server_health(self, server_name: str) -> bool:
        """Check if a server is healthy by attempting to list tools"""
        try:
            if server_name not in self.sessions:
                return False
            await self.sessions[server_name].list_tools()
            self.last_health_checks[server_name] = datetime.now()
            return True
        except Exception as e:
            logger.warning(f"Health check failed for {server_name}: {str(e)}")
            return False

    def _load_config(self) -> Dict:
        """Load MCP server configuration from config file"""
        try:
            with open('config.json', 'r') as f:
                config = json.load(f)
            return config
        except Exception as e:
            logger.error(f"Failed to load config file: {str(e)}")
            return {"mcpServers": {}}

    def _get_server_env(self, command: str) -> dict:
        """Get environment variables for server command"""
        env = {}
        if command in ('npm', 'npx'):
            env.update({
                'NODE_ENV': 'development',
                'PATH': os.environ.get('PATH', '')
            })
        return env

    async def connect_to_server(self, server_name: str, timeout: int = 30) -> bool:
        """Connect to an MCP server with retry logic
        
        Args:
            server_command: Command to start the server
            timeout: Connection timeout in seconds
            
        Returns:
            bool: True if connection successful, False otherwise
        """
        retry_count = 0
        start_time = time.time()
        
        while retry_count < self.max_retries and (time.time() - start_time) < timeout:
            try:
                if retry_count > 0:
                    delay = min(self.retry_delay * (2 ** (retry_count - 1)), 10)  # Max 10 second delay
                    logger.info(f"Retrying connection in {delay} seconds...")
                    await asyncio.sleep(delay)
                
                # Get server config
                if server_name not in self.config['mcpServers']:
                    logger.error(f"Server {server_name} not found in config")
                    return False

                server_config = self.config['mcpServers'][server_name]
                command = server_config['command']
                args = server_config['args']
                env = self._get_server_env(command)
                
                # Set up server parameters
                server_params = StdioServerParameters(
                    command=command,
                    args=args,
                    env=env
                )
                
                logger.info(f"Connecting to server {server_name}...")
                stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
                stdio, write = stdio_transport
                
                logger.info(f"Initializing session for {server_name}...")
                session = await self.exit_stack.enter_async_context(ClientSession(stdio, write))
                await session.initialize()
                
                # List available tools
                logger.info(f"Getting available tools from {server_name}...")
                response = await session.list_tools()
                tools = response.tools
                logger.info(f"Connected to server {server_name} with tools: {[tool.name for tool in tools]}")
                
                self.sessions[server_name] = session
                self.connected_servers.add(server_name)
                self.last_health_checks[server_name] = datetime.now()
                return True
                
            except Exception as e:
                logger.error(f"Connection attempt {retry_count + 1} failed: {str(e)}")
                retry_count += 1
                
                if server_name in self.sessions:
                    await self.cleanup_server(server_name)
        
        logger.error(f"Failed to connect after {retry_count} attempts")
        return False

    async def process_query(self, query: str, health_check_interval: int = 60) -> str:
        """Process a query using Claude and available tools from all connected servers"""
        messages = [
            {
                "role": "user",
                "content": query
            }
        ]

        # Perform health check for all servers if needed
        for server_name in self.connected_servers:
            if (server_name not in self.last_health_checks or 
                (datetime.now() - self.last_health_checks[server_name]) > timedelta(seconds=health_check_interval)):
                if not await self._check_server_health(server_name):
                    raise ConnectionError(f"Server health check failed for {server_name}")
        
        # Collect tools from all connected servers
        available_tools = []
        for server_name, session in self.sessions.items():
            response = await session.list_tools()
            server_tools = [{ 
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.inputSchema
            } for tool in response.tools]
            available_tools.extend(server_tools)

        # Initial Claude API call
        response = self.anthropic.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            messages=messages,
            tools=available_tools
        )

        # Process response and handle tool calls
        tool_results = []
        final_text = []

        for content in response.content:
            if content.type == 'text':
                final_text.append(content.text)
            elif content.type == 'tool_use':
                tool_name = content.name
                tool_args = content.input
                
                # Execute tool call
                # Find which server has the requested tool
                tool_server = None
                for server_name, session in self.sessions.items():
                    tools_response = await session.list_tools()
                    if any(tool.name == tool_name for tool in tools_response.tools):
                        tool_server = server_name
                        break
                
                if tool_server is None:
                    raise ValueError(f"Tool {tool_name} not found in any connected server")
                
                result = await self.sessions[tool_server].call_tool(tool_name, tool_args)
                tool_results.append({"call": tool_name, "result": result})
                final_text.append(f"[Calling tool {tool_name} with args {tool_args}]")

                # Continue conversation with tool results
                if hasattr(content, 'text') and content.text:
                    messages.append({
                      "role": "assistant",
                      "content": content.text
                    })
                messages.append({
                    "role": "user", 
                    "content": result.content
                })

                # Get next response from Claude
                response = self.anthropic.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=1000,
                    messages=messages,
                )

                final_text.append(response.content[0].text)

        return "\n".join(final_text)

    async def start_chat(self):
        """Start the enhanced chat interface"""
        from mcp_chat import MCPChatInterface
        chat = MCPChatInterface(self)
        await chat.run()

    async def cleanup_server(self, server_name: str):
        """Clean up resources for a specific server"""
        logger.info(f"Cleaning up resources for {server_name}...")
        self.connected_servers.discard(server_name)
        
        if server_name in self.sessions:
            try:
                session = self.sessions[server_name]
                del self.sessions[server_name]
                await session.close()
            except Exception as e:
                logger.error(f"Error during cleanup of {server_name}: {str(e)}")
        
        if server_name in self.server_processes:
            try:
                process = self.server_processes[server_name]
                process.terminate()
                await asyncio.sleep(1)  # Give the process time to terminate gracefully
                if process.poll() is None:
                    process.kill()  # Force kill if still running
                del self.server_processes[server_name]
            except Exception as e:
                logger.error(f"Error terminating server process for {server_name}: {str(e)}")

    async def cleanup(self):
        """Clean up resources and shutdown all servers"""
        logger.info("Cleaning up all resources...")
        for server_name in list(self.connected_servers):
            await self.cleanup_server(server_name)
        await self.exit_stack.aclose()

async def main():
    client = MCPClient()
    try:
        # Connect to configured servers
        for server_name in client.config['mcpServers'].keys():
            connected = await client.connect_to_server(server_name)
            if not connected:
                logger.error(f"Failed to establish connection to {server_name}")
                continue
        
        
        if not client.connected_servers:
            logger.error("No servers connected")
            sys.exit(1)
            
        await client.start_chat()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
    finally:
        await client.cleanup()

if __name__ == "__main__":
    import sys
    asyncio.run(main())
