import asyncio
import logging
import os
import subprocess
import time
from typing import Optional, Tuple
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
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        self.anthropic = Anthropic()
        self.server_process: Optional[subprocess.Popen] = None
        self.last_health_check: Optional[datetime] = None
        self.connected = False
        self.max_retries = 3
        self.retry_delay = 1  # Initial delay in seconds

    async def _check_server_health(self) -> bool:
        """Check if the server is healthy by attempting to list tools"""
        try:
            if not self.session:
                return False
            await self.session.list_tools()
            self.last_health_check = datetime.now()
            return True
        except Exception as e:
            logger.warning(f"Health check failed: {str(e)}")
            return False

    def _parse_server_command(self, server_command: str) -> Tuple[str, list[str], dict]:
        """Parse server command into components
        
        Args:
            server_command: Command to start the server
            
        Returns:
            Tuple[str, list[str], dict]: Command, arguments, and environment variables
        """
        env = {}
        
        if server_command.startswith(('npm ', 'npx ')):
            parts = server_command.split(maxsplit=2)
            if len(parts) < 2:
                raise ValueError("Invalid npm/npx command")
                
            command = parts[0]  # npm or npx
            args = parts[1:]  # The rest of the command as args
            
            # Add node environment variables
            env.update({
                'NODE_ENV': 'development',
                'PATH': os.environ.get('PATH', '')
            })
        else:
            parts = server_command.split()
            command = parts[0]
            args = parts[1:] if len(parts) > 1 else []
            
        return command, args, env

    async def connect_to_server(self, server_command: str, timeout: int = 30) -> bool:
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
                
                # Parse the server command
                try:
                    command, args, env = self._parse_server_command(server_command)
                except ValueError as e:
                    logger.error(str(e))
                    return False
                
                # Set up server parameters
                server_params = StdioServerParameters(
                    command=command,
                    args=args,
                    env=env
                )
                
                logger.info("Connecting to server...")
                stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
                self.stdio, self.write = stdio_transport
                
                logger.info("Initializing session...")
                self.session = await self.exit_stack.enter_async_context(ClientSession(self.stdio, self.write))
                await self.session.initialize()
                
                # List available tools
                logger.info("Getting available tools...")
                response = await self.session.list_tools()
                tools = response.tools
                logger.info(f"Connected to server with tools: {[tool.name for tool in tools]}")
                
                self.connected = True
                self.last_health_check = datetime.now()
                return True
                
            except Exception as e:
                logger.error(f"Connection attempt {retry_count + 1} failed: {str(e)}")
                retry_count += 1
                
                if self.session:
                    await self.cleanup()
        
        logger.error(f"Failed to connect after {retry_count} attempts")
        return False

    async def process_query(self, query: str, health_check_interval: int = 60) -> str:
        """Process a query using Claude and available tools"""
        messages = [
            {
                "role": "user",
                "content": query
            }
        ]

        # Perform health check if needed
        if (not self.last_health_check or 
            (datetime.now() - self.last_health_check) > timedelta(seconds=health_check_interval)):
            if not await self._check_server_health():
                raise ConnectionError("Server health check failed")
        
        response = await self.session.list_tools()
        available_tools = [{ 
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.inputSchema
        } for tool in response.tools]

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
                result = await self.session.call_tool(tool_name, tool_args)
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

    async def chat_loop(self):
        """Run an interactive chat loop"""
        print("\nMCP Client Started!")
        print("Type your queries or 'quit' to exit.")
        
        while True:
            try:
                query = input("\nQuery: ").strip()
                
                if query.lower() == 'quit':
                    break
                    
                if not query:
                    continue
                    
                response = await self.process_query(query)
                print("\n" + response)
                    
            except EOFError:
                break
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"\nError: {str(e)}")
                continue

    async def cleanup(self):
        """Clean up resources and shutdown server"""
        logger.info("Cleaning up resources...")
        self.connected = False
        
        if self.session:
            try:
                await self.exit_stack.aclose()
            except Exception as e:
                logger.error(f"Error during cleanup: {str(e)}")
        
        if self.server_process:
            try:
                self.server_process.terminate()
                await asyncio.sleep(1)  # Give the process time to terminate gracefully
                if self.server_process.poll() is None:
                    self.server_process.kill()  # Force kill if still running
            except Exception as e:
                logger.error(f"Error terminating server process: {str(e)}")

async def main():
    if len(sys.argv) < 2:
        logger.error("Usage: python client.py <path_to_server_script>")
        sys.exit(1)
        
    client = MCPClient()
    try:
        connected = await client.connect_to_server(sys.argv[1])
        if not connected:
            logger.error("Failed to establish connection to server")
            sys.exit(1)
            
        await client.chat_loop()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
    finally:
        await client.cleanup()

if __name__ == "__main__":
    import sys
    asyncio.run(main())
