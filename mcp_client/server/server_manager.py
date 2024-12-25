import asyncio
import logging
import os
import time
from contextlib import AsyncExitStack
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional, Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

@dataclass
class ServerInfo:
    params: StdioServerParameters
    session: ClientSession
    stdio: Any  # The stdio context
    write: Any  # The write stream

logger = logging.getLogger(__name__)

class ServerManager:
    def __init__(self, config: Dict, exit_stack: AsyncExitStack):
        self.servers: Dict[str, ServerInfo] = {}
        self.exit_stack = exit_stack
        self.server_processes = {}
        self.last_health_checks = {}
        self.connected_servers = set()
        self.max_retries = 3
        self.retry_delay = 1
        self.config = config
        self.health_check_task = None
        self.health_check_interval = 30  # seconds

    async def start_health_check_task(self):
        """Start background task for periodic health checks"""
        if self.health_check_task is None:
            logger.info("Starting periodic health check task")
            self.health_check_task = asyncio.create_task(self._periodic_health_check())

    async def stop_health_check_task(self):
        """Stop background health check task"""
        if self.health_check_task is not None:
            logger.info("Stopping periodic health check task")
            self.health_check_task.cancel()
            try:
                await self.health_check_task
            except asyncio.CancelledError:
                pass
            self.health_check_task = None

    async def _periodic_health_check(self):
        """Periodically check health of all servers"""
        while True:
            try:
                logger.debug("Running periodic health check")
                for server_name in sorted(self.connected_servers):
                    try:
                        if not await self._check_server_health(server_name):
                            logger.error(f"[{server_name}] Health check failed, cleaning up")
                            await self.cleanup_server(server_name)
                    except Exception as e:
                        logger.error(f"[{server_name}] Error during health check", exc_info=True)
                await asyncio.sleep(self.health_check_interval)
            except asyncio.CancelledError:
                logger.info("Health check task cancelled")
                break
            except Exception as e:
                logger.error("Error in health check task", exc_info=True)
                await asyncio.sleep(self.health_check_interval)

    async def start_server(self, server_name: str) -> None:
        """Start and connect to an MCP server."""
        if server_name not in self.config['mcpServers']:
            raise KeyError(f"Server '{server_name}' not found in configuration")
            
        if not await self.connect_to_server(server_name):
            raise ConnectionError(f"Failed to connect to server '{server_name}'")
            
        # Start health check task if not already running
        await self.start_health_check_task()

    def _get_server_env(self, command: str, server_config: Dict) -> dict:
        """Get environment variables for server command"""
        env = {}
        # Always include PATH
        env['PATH'] = os.environ.get('PATH', '')
        
        if command in ('npm', 'npx', 'xvfb-run'):
            env['NODE_ENV'] = 'development'
        elif command == 'uvx':
            # Pass through Python-related environment variables
            python_vars = [
                'PYTHONPATH', 'VIRTUAL_ENV', 'PYTHON_VERSION',
                'PYTHONHOME', 'PYTHON_HOME', 'UV_HOME', 'UV_SYSTEM_PYTHON'
            ]
            for var in python_vars:
                if var in os.environ:
                    env[var] = os.environ[var]
        # Merge with config env if present
        if 'env' in server_config:
            env.update(server_config['env'])
        return env

    async def _check_process_health(self, server_name: str) -> bool:
        """Check if server process is still running"""
        if server_name not in self.server_processes:
            logger.debug(f"[{server_name}] No process to check")
            return False
            
        process = self.server_processes[server_name]
        if process.poll() is not None:
            logger.error(f"[{server_name}] Process terminated with code: {process.poll()}")
            return False
            
        return True

    async def _check_server_health(self, server_name: str) -> bool:
        """Check if a server is healthy by checking process and tools"""
        try:
            # First check process health
            if not await self._check_process_health(server_name):
                logger.error(f"[{server_name}] Process health check failed")
                await self.cleanup_server(server_name)
                return False
                
            if server_name not in self.servers:
                logger.debug(f"[{server_name}] Server not found in self.servers")
                return False

            logger.debug(f"[{server_name}] Starting health check...")
            server_info = self.servers[server_name]
            logger.debug(f"[{server_name}] Server info: {server_info}")

            # Add 5 second timeout for health check
            try:
                tools_response = await asyncio.wait_for(
                    server_info.session.list_tools(),
                    timeout=5
                )
                logger.debug(f"[{server_name}] Health check tools response: {tools_response}")
                
                if not tools_response or not hasattr(tools_response, 'tools'):
                    logger.error(f"[{server_name}] Invalid tools response: {tools_response}")
                    return False
                    
                logger.debug(f"[{server_name}] Found {len(tools_response.tools)} tools")
                self.last_health_checks[server_name] = datetime.now()
                return True
                
            except asyncio.TimeoutError:
                logger.error(f"[{server_name}] Health check timed out after 5 seconds")
                return False
                
        except Exception as e:
            logger.error(f"[{server_name}] Health check failed with exception", exc_info=True)
            logger.debug(f"[{server_name}] Server state: {self.servers.get(server_name)}")
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
                env = self._get_server_env(command, server_config)
                
                # Log command details
                logger.debug(f"[{server_name}] Starting server with command: {command}")
                logger.debug(f"[{server_name}] Arguments: {args}")
                logger.debug(f"[{server_name}] Environment: {env}")
                
                server_params = StdioServerParameters(
                    command=command,
                    args=args,
                    env=env
                )
                
                logger.info(f"Connecting to server {server_name}...")
                logger.debug(f"Starting stdio client for {server_name}...")
                try:
                    # Start stdio client and track process
                    logger.debug(f"[{server_name}] Starting stdio client with params: {server_params}")
                    stdio_cm = stdio_client(server_params)
                    stdio, write = await self.exit_stack.enter_async_context(stdio_cm)
                    logger.debug(f"[{server_name}] Stdio client started successfully")

                    # Set up stdout/stderr capture
                    if hasattr(stdio, 'process'):
                        async def log_output():
                            try:
                                while True:
                                    if stdio.process.stdout:
                                        line = await stdio.process.stdout.readline()
                                        if line:
                                            logger.debug(f"[{server_name}] stdout: {line.decode().strip()}")
                                    if stdio.process.stderr:
                                        line = await stdio.process.stderr.readline()
                                        if line:
                                            logger.debug(f"[{server_name}] stderr: {line.decode().strip()}")
                                    if stdio.process.poll() is not None:
                                        break
                            except Exception as e:
                                logger.error(f"[{server_name}] Error capturing output", exc_info=True)

                        asyncio.create_task(log_output())
                        logger.debug(f"[{server_name}] Started output capture task")
                    
                    # Store process reference if available
                    if hasattr(stdio, 'process'):
                        self.server_processes[server_name] = stdio.process
                        logger.debug(f"[{server_name}] Stored process reference: {stdio.process}")
                    else:
                        logger.warning(f"[{server_name}] No process reference available from stdio client")
                    
                    # Create session with process monitoring
                    logger.debug(f"[{server_name}] Creating client session")
                    session = await self.exit_stack.enter_async_context(ClientSession(stdio, write))
                    logger.debug(f"[{server_name}] Entered session context")
                    
                    # Monitor process state
                    if server_name in self.server_processes:
                        process = self.server_processes[server_name]
                        if process.poll() is not None:
                            logger.error(f"[{server_name}] Process terminated unexpectedly with code: {process.poll()}")
                            return False
                        logger.debug(f"[{server_name}] Process running with PID: {process.pid}")
                    
                    # Set up message and error handlers
                    async def on_message(msg):
                        logger.debug(f"[{server_name}] Received message: {msg}")
                        if isinstance(msg, dict):
                            if msg.get('type') == 'error':
                                logger.error(f"[{server_name}] Server error: {msg.get('error')}")
                            elif msg.get('type') == 'close':
                                logger.error(f"[{server_name}] Server closed connection")
                                await self.cleanup_server(server_name)
                    stdio.on_message = on_message

                    # Set up close handler
                    async def on_close():
                        logger.error(f"[{server_name}] Connection closed unexpectedly")
                        await self.cleanup_server(server_name)
                    stdio.on_close = on_close
                    
                    # Initialize session with detailed logging
                    logger.debug(f"[{server_name}] Initializing session...")
                    try:
                        response = await asyncio.wait_for(session.initialize(), timeout=30)
                        logger.debug(f"[{server_name}] Initialize response: {response}")
                        if not response:
                            logger.error(f"[{server_name}] Session initialization failed: no response")
                            return False
                        logger.info(f"[{server_name}] Session initialized successfully")
                    except asyncio.TimeoutError:
                        logger.error(f"[{server_name}] Session initialization timed out")
                        return False
                    except Exception as e:
                        logger.error(f"[{server_name}] Session initialization failed", exc_info=True)
                        return False
                    
                    # List tools with detailed logging
                    logger.debug(f"[{server_name}] Listing tools...")
                    try:
                        tools_response = await asyncio.wait_for(session.list_tools(), timeout=5)
                        logger.debug(f"[{server_name}] Tools response: {tools_response}")
                        
                        if not tools_response:
                            logger.error(f"[{server_name}] Empty tools response")
                            return False
                            
                        if not hasattr(tools_response, 'tools'):
                            logger.error(f"[{server_name}] Tools response missing 'tools' attribute")
                            return False
                            
                        if not tools_response.tools:
                            logger.warning(f"[{server_name}] No tools available")
                            return False
                            
                        logger.info(f"[{server_name}] Connected successfully with {len(tools_response.tools)} tools")
                        logger.debug(f"[{server_name}] Available tools: {[t.name for t in tools_response.tools]}")
                    except asyncio.TimeoutError:
                        logger.error(f"[{server_name}] List tools timed out")
                        return False
                    except Exception as e:
                        logger.error(f"[{server_name}] List tools failed", exc_info=True)
                        return False
                    
                    # Store server info
                    self.servers[server_name] = ServerInfo(
                        params=server_params,
                        session=session,
                        stdio=stdio,
                        write=write
                    )
                    self.connected_servers.add(server_name)
                    self.last_health_checks[server_name] = datetime.now()
                    return True
                except Exception as e:
                    logger.error(f"Failed to establish stdio connection for {server_name}: {str(e)}")
                    return False
                
            except Exception as e:
                logger.error(f"Connection attempt {retry_count + 1} failed: {str(e)}")
                retry_count += 1
                
                if server_name in self.servers:
                    await self.cleanup_server(server_name)
        
        logger.error(f"Failed to connect after {retry_count} attempts")
        return False

    async def check_servers_health(self, health_check_interval: int = 30) -> None:
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
        for server_name, server_info in self.servers.items():
            try:
                tools_response = await asyncio.wait_for(server_info.session.list_tools(), timeout=5)
                logger.debug(f"Raw tools response from {server_name}: {tools_response}")
                
                if not tools_response:
                    logger.error(f"Empty response from {server_name}")
                    continue
                
                if not hasattr(tools_response, 'tools'):
                    logger.error(f"Response from {server_name} missing tools attribute: {tools_response}")
                    continue

                tools = []
                for i, tool in enumerate(tools_response.tools):
                    try:
                        logger.debug(f"Processing tool {i} from {server_name}: {tool}")
                        tool_info = {
                            "name": tool.name,
                            "description": tool.description,
                            "input_schema": tool.inputSchema
                        }
                        tools.append(tool_info)
                    except Exception as e:
                        logger.error(f"Error processing tool {i} from {server_name}", exc_info=True)
                        logger.debug(f"Tool object that caused error: {tool}")
                        continue

                available_tools.extend(tools)
                logger.info(f"Retrieved {len(tools)} tools from {server_name}")
            except Exception as e:
                logger.error(f"Failed to get tools from {server_name}", exc_info=True)
                logger.debug(f"Server info: {server_info}")
        return available_tools

    async def call_tool(self, tool_name: str, tool_args: dict, timeout: int = 60) -> Optional[dict]:
        """Call a tool on the appropriate server"""
        logger.debug(f"Attempting to call tool {tool_name} with args {tool_args}")
        logger.debug(f"Connected servers: {self.connected_servers}")
        logger.debug(f"Available servers: {list(self.servers.keys())}")
        
        # First verify server health
        for server_name in list(self.servers.keys()):
            if not await self._check_server_health(server_name):
                logger.error(f"[{server_name}] Server unhealthy, removing from available servers")
                continue
        
        for server_name, server_info in self.servers.items():
            logger.debug(f"[{server_name}] Checking for tool {tool_name}")
            try:
                session = server_info.session
                logger.debug(f"[{server_name}] Getting tool list")
                tools_response = await asyncio.wait_for(session.list_tools(), timeout=5)
                logger.debug(f"[{server_name}] Tools response: {tools_response}")
                
                if not tools_response or not hasattr(tools_response, 'tools'):
                    logger.error(f"[{server_name}] Invalid tools response")
                    continue
                    
                tools = tools_response.tools
                logger.debug(f"[{server_name}] Available tools: {[t.name for t in tools]}")
                
                if any(tool.name == tool_name for tool in tools):
                    logger.debug(f"[{server_name}] Found matching tool, attempting to call")
                    try:
                        logger.debug(f"[{server_name}] Calling tool with timeout {timeout}s")
                        try:
                            response = await asyncio.wait_for(
                                session.call_tool(tool_name, tool_args),
                                timeout=timeout
                            )
                        except asyncio.TimeoutError:
                            logger.error(f"[{server_name}] Tool call timed out after {timeout}s")
                            await self.cleanup_server(server_name)
                            raise
                        logger.debug(f"[{server_name}] Tool response: {response}")
                        logger.info(f"Successfully called {tool_name} on {server_name}")
                        return {
                            "result": "success",
                            "tool": tool_name,
                            "args": tool_args,
                            "response": response
                        }
                    except Exception as e:
                        logger.error(f"[{server_name}] Failed to call {tool_name}", exc_info=True)
            except Exception as e:
                logger.error(f"[{server_name}] Error checking tools", exc_info=True)
                continue
                
        logger.error(f"Tool {tool_name} not found in any connected server")
        return None

    async def cleanup_server(self, server_name: str):
        """Clean up resources for a specific server"""
        logger.info(f"[{server_name}] Starting cleanup...")
        
        # Log current state
        logger.debug(f"[{server_name}] Current connected servers: {self.connected_servers}")
        logger.debug(f"[{server_name}] Current server processes: {list(self.server_processes.keys())}")
        logger.debug(f"[{server_name}] Current servers: {list(self.servers.keys())}")
        
        self.connected_servers.discard(server_name)
        logger.debug(f"[{server_name}] Removed from connected servers")
        
        # Clean up server info
        if server_name in self.servers:
            try:
                server_info = self.servers[server_name]
                logger.debug(f"[{server_name}] Cleaning up server info: {server_info}")
                del self.servers[server_name]
                logger.debug(f"[{server_name}] Removed server info")
            except Exception as e:
                logger.error(f"[{server_name}] Error removing server info", exc_info=True)
        
        # Clean up process
        if server_name in self.server_processes:
            process = self.server_processes[server_name]
            logger.debug(f"[{server_name}] Cleaning up process: {process}")
            kill_needed = False
            
            try:
                logger.debug(f"[{server_name}] Attempting graceful termination")
                await process.terminate()
                await asyncio.sleep(0.1)
                
                if process.poll() is None:
                    logger.debug(f"[{server_name}] Process still running after terminate, will need force kill")
                    kill_needed = True
                else:
                    logger.debug(f"[{server_name}] Process terminated successfully")
            except Exception as e:
                logger.error(f"[{server_name}] Error during process termination", exc_info=True)
                kill_needed = True
            
            if kill_needed:
                try:
                    logger.debug(f"[{server_name}] Attempting force kill")
                    await process.kill()
                    logger.debug(f"[{server_name}] Force kill successful")
                except Exception as kill_error:
                    logger.error(f"[{server_name}] Failed to kill process", exc_info=True)
            
            try:
                del self.server_processes[server_name]
                logger.debug(f"[{server_name}] Removed process from tracking")
            except Exception as e:
                logger.error(f"[{server_name}] Error removing process from tracking", exc_info=True)
        
        logger.info(f"[{server_name}] Cleanup completed")

    async def cleanup_all(self):
        """Clean up all server resources"""
        logger.info("Cleaning up all resources...")
        await self.stop_health_check_task()
        for server_name in list(self.connected_servers):
            await self.cleanup_server(server_name)

    async def stop_server(self, server_name: str):
        """Stop a running server."""
        await self.cleanup_server(server_name)

    async def restart_server(self, server_name: str):
        """Restart a server by stopping and starting it again."""
        await self.stop_server(server_name)
        await self.start_server(server_name)
