import asyncio
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Dict, Optional
from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = logging.getLogger(__name__)

class ServerManager:
    def __init__(self, config: Dict, exit_stack: AsyncExitStack):
        self.servers: Dict[str, ClientSession] = {}
        self.exit_stack = exit_stack
        self.server_processes = {}
        self.last_health_checks = {}
        self.connected_servers = set()
        self.max_retries = 3
        self.retry_delay = 1
        self.config = config

    async def start_server(self, server_name: str) -> None:
        """Start and connect to an MCP server."""
        if server_name not in self.config['mcpServers']:
            raise KeyError(f"Server '{server_name}' not found in configuration")
            
        if not await self.connect_to_server(server_name):
            raise ConnectionError(f"Failed to connect to server '{server_name}'")

    def _get_server_env(self, command: str) -> dict:
        """Get environment variables for server command"""
        env = {}
        if command in ('npm', 'npx'):
            env.update({
                'NODE_ENV': 'development',
                'PATH': os.environ.get('PATH', '')
            })
        return env

    async def _check_server_health(self, server_name: str) -> bool:
        """Check if a server is healthy by attempting to list tools"""
        try:
            if server_name not in self.servers:
                return False
            # Add 5 second timeout for health check
            await asyncio.wait_for(
                self.servers[server_name].list_tools(),
                timeout=5
            )
            self.last_health_checks[server_name] = datetime.now()
            return True
        except asyncio.TimeoutError:
            logger.warning(f"Health check timed out for {server_name}")
            return False
        except Exception as e:
            logger.warning(f"Health check failed for {server_name}: {str(e)}")
            return False

    async def connect_to_server(self, server_name: str, timeout: int = 30) -> bool:
        """Connect to an MCP server with retry logic"""
        retry_count = 0
        start_time = time.time()
        
        while retry_count < self.max_retries and (time.time() - start_time) < timeout:
            try:
                if retry_count > 0:
                    delay = min(self.retry_delay * (2 ** (retry_count - 1)), 10)
                    logger.info(f"Retrying connection in {delay} seconds...")
                    await asyncio.sleep(delay)
                
                if server_name not in self.config['mcpServers']:
                    logger.error(f"Server {server_name} not found in config")
                    return False

                server_config = self.config['mcpServers'][server_name]
                command = server_config['command']
                args = server_config['args']
                env = self._get_server_env(command)
                
                server_params = StdioServerParameters(
                    command=command,
                    args=args,
                    env=env
                )
                
                logger.info(f"Connecting to server {server_name}...")
                try:
                    logger.debug(f"Starting stdio client for {server_name}...")
                    stdio, write = await self.exit_stack.enter_async_context(stdio_client(server_params))
                    logger.debug(f"Stdio client started successfully for {server_name}")
                except Exception as e:
                    logger.error(f"Failed to start stdio client for {server_name}: {str(e)}", exc_info=True)
                    return False

                logger.info(f"Initializing session for {server_name}...")
                session = ClientSession(stdio, write)
                
                # Enter session context
                session = await self.exit_stack.enter_async_context(session)
                logger.debug(f"[{server_name}] Entered session context")

                # Add detailed message logging
                async def log_stdio_message(msg):
                    logger.debug(f"[{server_name}] Received message: {msg}")
                    if isinstance(msg, dict):
                        logger.debug(f"[{server_name}] Message type: {msg.get('type')}")
                        if msg.get('type') == 'error':
                            logger.error(f"[{server_name}] Server error: {msg.get('error')}")
                        if msg.get('type') == 'initialize':
                            logger.debug(f"[{server_name}] Initialize response: {msg}")
                stdio.on_message = log_stdio_message
                
                # Log outgoing messages
                original_write = write
                async def logged_write(data):
                    try:
                        logger.debug(f"[{server_name}] Sending message: {data}")
                        await original_write(data)
                        logger.debug(f"[{server_name}] Message sent successfully")
                    except Exception as e:
                        logger.error(f"[{server_name}] Failed to send message: {str(e)}")
                        raise
                write = logged_write

                # Add receive hook to stdio
                original_receive = stdio.receive
                async def logged_receive():
                    msg = await original_receive()
                    if msg:
                        logger.debug(f"[{server_name}] Raw received: {msg}")
                    return msg
                stdio.receive = logged_receive
                
                # Add 30 second timeout for session initialization
                try:
                    logger.debug(f"Starting session initialization for {server_name}...")
                    
                    # Create initialization task
                    init_task = asyncio.create_task(session.initialize())
                    logger.debug(f"[{server_name}] Created initialization task")
                    
                    # Wait for initialization with timeout
                    try:
                        await asyncio.wait_for(init_task, timeout=30)
                        logger.info(f"Session initialized for {server_name}")
                    except asyncio.TimeoutError:
                        logger.error(f"[{server_name}] Session initialization timed out")
                        if not init_task.done():
                            init_task.cancel()
                            try:
                                await init_task
                            except asyncio.CancelledError:
                                logger.debug(f"[{server_name}] Initialization task cancelled")
                        raise
                except asyncio.TimeoutError:
                    logger.error(f"Session initialization timed out for {server_name}")
                    return False
                except Exception as e:
                    logger.error(f"Session initialization failed for {server_name}: {str(e)}")
                    return False
                
                # Add 5 second timeout for initial tool listing
                logger.info(f"Getting available tools from {server_name}...")
                try:
                    response = await asyncio.wait_for(
                        session.list_tools(),
                        timeout=5
                    )
                    tools = response.tools
                    tool_names = [tool.name for tool in tools]
                    logger.info(f"Connected to server {server_name} with tools: {tool_names}")
                    
                    if not tools:
                        logger.warning(f"Server {server_name} reported no available tools")
                except asyncio.TimeoutError:
                    logger.error(f"Timeout getting initial tools from {server_name}")
                    await self.cleanup_server(server_name)
                    return False
                except Exception as e:
                    logger.error(f"Error getting initial tools from {server_name}: {str(e)}", exc_info=True)
                    await self.cleanup_server(server_name)
                    return False
                
                self.servers[server_name] = session
                self.connected_servers.add(server_name)
                self.last_health_checks[server_name] = datetime.now()
                return True
                
            except Exception as e:
                logger.error(f"Connection attempt {retry_count + 1} failed: {str(e)}")
                retry_count += 1
                
                if server_name in self.servers:
                    await self.cleanup_server(server_name)
        
        logger.error(f"Failed to connect after {retry_count} attempts")
        return False

    async def check_servers_health(self, health_check_interval: int = 60) -> None:
        """Check health of all connected servers in a deterministic order"""
        # Convert to sorted list for deterministic order
        for server_name in sorted(self.connected_servers):
            if (server_name not in self.last_health_checks or 
                (datetime.now() - self.last_health_checks[server_name]) > timedelta(seconds=health_check_interval)):
                if not await self._check_server_health(server_name):
                    raise ConnectionError(f"Server health check failed for {server_name}")

    async def get_all_tools(self) -> list:
        """Collect tools from all connected servers"""
        available_tools = []
        for server_name, session in self.servers.items():
            logger.info(f"Getting tools from server: {server_name}")
            try:
                # Add 5 second timeout for tool listing
                response = await asyncio.wait_for(
                    session.list_tools(),
                    timeout=5
                )
                server_tools = [{ 
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.inputSchema
                } for tool in response.tools]
                available_tools.extend(server_tools)
                logger.info(f"Successfully retrieved {len(server_tools)} tools from {server_name}")
            except asyncio.TimeoutError:
                logger.error(f"Timeout getting tools from {server_name}")
                # Don't fail completely, just skip this server
                continue
            except Exception as e:
                logger.error(f"Error getting tools from {server_name}: {str(e)}", exc_info=True)
                # Don't fail completely, just skip this server
                continue
        return available_tools

    async def call_tool(self, tool_name: str, tool_args: dict) -> Optional[dict]:
        """Call a tool on the appropriate server"""
        for server_name, session in self.servers.items():
            try:
                # Add 5 second timeout for tool listing
                tools_response = await asyncio.wait_for(
                    session.list_tools(),
                    timeout=5
                )
                if any(tool.name == tool_name for tool in tools_response.tools):
                    logger.info(f"Calling tool {tool_name} on server {server_name}")
                    try:
                        # Add 30 second timeout for tool execution
                        result = await asyncio.wait_for(
                            session.call_tool(tool_name, tool_args),
                            timeout=30
                        )
                        logger.info(f"Successfully called tool {tool_name}")
                        return result
                    except asyncio.TimeoutError:
                        logger.error(f"Timeout calling tool {tool_name} on {server_name}")
                        continue
                    except Exception as e:
                        logger.error(f"Error calling tool {tool_name} on {server_name}: {str(e)}", exc_info=True)
                        continue
            except asyncio.TimeoutError:
                logger.error(f"Timeout listing tools from {server_name}")
                continue
            except Exception as e:
                logger.error(f"Error listing tools from {server_name}: {str(e)}", exc_info=True)
                continue
        return None

    async def cleanup_server(self, server_name: str):
        """Clean up resources for a specific server"""
        logger.info(f"Cleaning up resources for {server_name}...")
        self.connected_servers.discard(server_name)
        
        # Always attempt to delete from servers dict if it exists
        if hasattr(self, 'servers'):
            try:
                del self.servers[server_name]
            except Exception as e:
                logger.error(f"Error during cleanup of {server_name}: {str(e)}")
        
        if server_name in self.server_processes:
            process = self.server_processes[server_name]
            try:
                try:
                    # First try to terminate gracefully
                    await process.terminate()
                    await asyncio.sleep(0.1)
                    
                    # Check if process is still running - poll() is synchronous
                    poll_result = process.poll()
                    if poll_result is None:
                        process.kill()  # kill() is also synchronous
                        await asyncio.sleep(0.05)
                except Exception as e:
                    logger.error(f"Error during process cleanup for {server_name}: {str(e)}")
                    # If terminate fails, ensure we try to kill
                    try:
                        await process.kill()
                        await asyncio.sleep(0.05)
                    except Exception as e:
                        logger.error(f"Error killing server process for {server_name}: {str(e)}")
            except Exception as e:
                logger.error(f"Error during process cleanup for {server_name}: {str(e)}")
            # Always remove the process from server_processes, even if termination fails
            del self.server_processes[server_name]

    async def cleanup_all(self):
        """Clean up all server resources"""
        logger.info("Cleaning up all resources...")
        for server_name in list(self.connected_servers):
            await self.cleanup_server(server_name)

    async def stop_server(self, server_name: str):
        """Stop a running server."""
        await self.cleanup_server(server_name)

    async def restart_server(self, server_name: str):
        """Restart a server by stopping and starting it again."""
        await self.stop_server(server_name)
        await self.start_server(server_name)
