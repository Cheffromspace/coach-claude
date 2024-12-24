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
        self.sessions: Dict[str, ClientSession] = {}
        self.exit_stack = exit_stack
        self.server_processes = {}
        self.last_health_checks = {}
        self.connected_servers = set()
        self.max_retries = 3
        self.retry_delay = 1
        self.config = config

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
            if server_name not in self.sessions:
                return False
            await self.sessions[server_name].list_tools()
            self.last_health_checks[server_name] = datetime.now()
            return True
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
                stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
                stdio, write = stdio_transport
                
                logger.info(f"Initializing session for {server_name}...")
                session = await self.exit_stack.enter_async_context(ClientSession(stdio, write))
                await session.initialize()
                
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

    async def check_servers_health(self, health_check_interval: int = 60) -> None:
        """Check health of all connected servers"""
        for server_name in self.connected_servers:
            if (server_name not in self.last_health_checks or 
                (datetime.now() - self.last_health_checks[server_name]) > timedelta(seconds=health_check_interval)):
                if not await self._check_server_health(server_name):
                    raise ConnectionError(f"Server health check failed for {server_name}")

    async def get_all_tools(self) -> list:
        """Collect tools from all connected servers"""
        available_tools = []
        for server_name, session in self.sessions.items():
            response = await session.list_tools()
            server_tools = [{ 
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.inputSchema
            } for tool in response.tools]
            available_tools.extend(server_tools)
        return available_tools

    async def call_tool(self, tool_name: str, tool_args: dict) -> Optional[dict]:
        """Call a tool on the appropriate server"""
        for server_name, session in self.sessions.items():
            tools_response = await session.list_tools()
            if any(tool.name == tool_name for tool in tools_response.tools):
                return await session.call_tool(tool_name, tool_args)
        return None

    async def cleanup_server(self, server_name: str):
        """Clean up resources for a specific server"""
        logger.info(f"Cleaning up resources for {server_name}...")
        self.connected_servers.discard(server_name)
        
        if server_name in self.sessions:
            try:
                del self.sessions[server_name]
            except Exception as e:
                logger.error(f"Error during cleanup of {server_name}: {str(e)}")
        
        if server_name in self.server_processes:
            try:
                process = self.server_processes[server_name]
                process.terminate()
                await asyncio.sleep(1)
                if process.poll() is None:
                    process.kill()
                del self.server_processes[server_name]
            except Exception as e:
                logger.error(f"Error terminating server process for {server_name}: {str(e)}")

    async def cleanup_all(self):
        """Clean up all server resources"""
        logger.info("Cleaning up all resources...")
        for server_name in list(self.connected_servers):
            await self.cleanup_server(server_name)
