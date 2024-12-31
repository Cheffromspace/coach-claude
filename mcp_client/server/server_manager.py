"""MCP Server Manager for managing child processes and their network configuration."""

import asyncio
import sys
import win32api
import win32process
import win32file
import win32pipe
import win32net
import logging
import os
import time
from contextlib import AsyncExitStack
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List

from ..processing.query_processor import QueryProcessor

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
        self.health_check_interval = 300  # seconds - increase to 5 minutes
        self.query_processor = QueryProcessor(self)

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
        # Start with a copy of all parent environment variables
        env = os.environ.copy()
        
        # Enable Node.js debug logging for operations (excluding net)
        if command.endswith('node.exe') or command == 'node':
            # Enable debug logging (excluding net messages)
            env['NODE_DEBUG'] = 'http,dns'
            env['DEBUG'] = '*,-net'
            
            # Configure Node.js process
            env['NODE_OPTIONS'] = '--trace-warnings --dns-result-order=ipv4first'
            env['UV_THREADPOOL_SIZE'] = '4'
            
            # Ensure proper Node.js process creation
            env['ELECTRON_RUN_AS_NODE'] = '1'
            env['ELECTRON_NO_ATTACH_CONSOLE'] = '1'
            
        # Allow config to override environment variables
        if 'env' in server_config:
            env.update(server_config['env'])
            
        return env

    def _init_process_networking(self, process):
        """Initialize networking for a child process"""
        if sys.platform == 'win32' and hasattr(process, 'pid'):
            try:
                # Get process handle with minimal required access
                handle = win32api.OpenProcess(
                    win32process.PROCESS_SET_QUOTA | win32process.PROCESS_TERMINATE,
                    False,
                    process.pid
                )
                
                try:
                    # Set process network priority
                    win32process.SetPriorityClass(handle, win32process.NORMAL_PRIORITY_CLASS)
                    
                    # Initialize network subsystem
                    try:
                        # Force DNS cache initialization
                        import socket
                        socket.gethostbyname('localhost')
                        
                        # Force network stack initialization
                        win32net.NetGetDCName(None, None)
                    except:
                        # Ignore if DC not available, we just want to init the stack
                        pass
                finally:
                    # Always close handle
                    win32api.CloseHandle(handle)
                
                logger.debug(f"Initialized networking for process {process.pid}")
                return True
            except Exception as e:
                logger.error(f"Failed to initialize process networking: {e}", exc_info=True)
                return False
        return True

    async def _check_process_health(self, server_name: str) -> bool:
        """Check if server process is still running"""
        if server_name not in self.server_processes:
            # If no process reference but server is in connected servers, assume it's healthy
            if server_name in self.connected_servers:
                logger.debug(f"[{server_name}] No process reference but server is connected")
                return True
            logger.debug(f"[{server_name}] No process to check")
            return False
            
        process = self.server_processes[server_name]
        if process.poll() is not None:
            logger.error(f"[{server_name}] Process terminated with code: {process.poll()}")
            return False
            
        return True

    async def _check_server_health(self, server_name: str) -> bool:
        """Check if a server is healthy by checking tool availability and process state"""
        try:
            if server_name not in self.servers:
                logger.debug(f"[{server_name}] Server not found in self.servers")
                return False

            logger.debug(f"[{server_name}] Starting health check...")
            server_info = self.servers[server_name]

            # First check process state
            if server_name in self.server_processes:
                process = self.server_processes[server_name]
                if process.poll() is not None:
                    logger.error(f"[{server_name}] Process terminated with code: {process.poll()}")
                    await self.cleanup_server(server_name)
                    return False

            # Then check network connectivity
            try:
                # First try a quick ping
                await asyncio.wait_for(
                    server_info.session.initialize(),
                    timeout=5
                )
            except Exception as e:
                logger.warning(f"[{server_name}] Quick health check failed: {e}")
                # If quick check fails, try full tools check
                try:
                    tools_response = await asyncio.wait_for(
                        server_info.session.list_tools(),
                        timeout=30
                    )
                    if not tools_response or not hasattr(tools_response, 'tools'):
                        logger.error(f"[{server_name}] Invalid tools response: {tools_response}")
                        return False

                    tool_count = len(tools_response.tools)
                    if tool_count == 0:
                        logger.warning(f"[{server_name}] Server has no tools available")
                        return False

                    logger.debug(f"[{server_name}] Found {tool_count} tools")
                    self.last_health_checks[server_name] = datetime.now()
                    return True

                except asyncio.TimeoutError:
                    logger.error(f"[{server_name}] Health check timed out after 30 seconds")
                    return False
                except Exception as e:
                    logger.error(f"[{server_name}] Health check failed: {e}", exc_info=True)
                    return False

            self.last_health_checks[server_name] = datetime.now()
            return True

        except Exception as e:
            logger.error(f"[{server_name}] Health check failed with exception", exc_info=True)
            logger.debug(f"[{server_name}] Server state: {self.servers.get(server_name)}")
            # Schedule cleanup on critical failures
            asyncio.create_task(self.cleanup_server(server_name))
            return False

    async def connect_to_server(self, server_name: str, timeout: int = 120) -> bool:
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
                        
                        # Initialize networking for the process
                        if not self._init_process_networking(stdio.process):
                            logger.error(f"[{server_name}] Failed to initialize process networking")
                            return False
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
                                # Don't cleanup on every error, some might be recoverable
                            elif msg.get('type') == 'close':
                                logger.error(f"[{server_name}] Server closed connection")
                                # Schedule cleanup to avoid deadlock if called during a tool call
                                asyncio.create_task(self.cleanup_server(server_name))
                    stdio.on_message = on_message

                    # Set up close handler
                    async def on_close():
                        logger.error(f"[{server_name}] Connection closed unexpectedly")
                        # Schedule cleanup to avoid deadlock
                        asyncio.create_task(self.cleanup_server(server_name))
                    stdio.on_close = on_close
                    
                    # Initialize session with detailed logging
                    logger.debug(f"[{server_name}] Initializing session...")
                    try:
                        response = await asyncio.wait_for(session.initialize(), timeout=60)
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
                        tools_response = await asyncio.wait_for(session.list_tools(), timeout=120)
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

    async def get_all_resources(self) -> list:
        """Collect resources from all connected servers"""
        resources = []
        for server_name, server_info in self.servers.items():
            try:
                resources_response = await asyncio.wait_for(server_info.session.list_resources(), timeout=120)
                if hasattr(resources_response, 'resources'):
                    resources.extend(resources_response.resources)
            except Exception as e:
                logger.error(f"Failed to get resources from {server_name}", exc_info=True)
        return resources

    async def get_all_resource_templates(self) -> list:
        """Collect resource templates from all connected servers"""
        templates = []
        for server_name, server_info in self.servers.items():
            try:
                templates_response = await asyncio.wait_for(server_info.session.list_resource_templates(), timeout=120)
                if hasattr(templates_response, 'resourceTemplates'):
                    templates.extend(templates_response.resourceTemplates)
            except Exception as e:
                logger.error(f"Failed to get resource templates from {server_name}", exc_info=True)
        return templates

    async def get_all_tools(self) -> list:
        """Collect tools from all connected servers"""
        available_tools = []
        for server_name, server_info in self.servers.items():
            try:
                tools_response = await asyncio.wait_for(server_info.session.list_tools(), timeout=120)
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
                        # Format tool info for Claude 3
                        tool_info = {
                            "name": tool.name,
                            "description": tool.description,
                        }
                        
                        # Handle input schema
                        if hasattr(tool, 'inputSchema'):
                            # Convert Zod schema to JSON Schema format
                            tool_info["input_schema"] = {
                                "type": "object",
                                "properties": tool.inputSchema._def.shape() if hasattr(tool.inputSchema, '_def') else {},
                                "required": tool.inputSchema._def.shape().keys() if hasattr(tool.inputSchema, '_def') else []
                            }
                        else:
                            # Provide default schema structure if none exists
                            tool_info["input_schema"] = {
                                "type": "object",
                                "properties": {},
                                "required": []
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
        """Call a tool on the appropriate server with enhanced error handling and recovery"""
        logger.debug(f"Attempting to call tool {tool_name} with args {tool_args}")
        
        if not isinstance(tool_args, dict):
            logger.error(f"Tool arguments must be a dictionary, got {type(tool_args)}")
            return None
            
        logger.debug(f"Connected servers: {self.connected_servers}")
        logger.debug(f"Available servers: {list(self.servers.keys())}")
        
        # Track servers that have failed
        failed_servers = set()
        retry_count = 0
        max_retries = 2
        
        while retry_count <= max_retries:
            for server_name, server_info in self.servers.items():
                if server_name in failed_servers:
                    continue
                    
                try:
                    # Verify server health first
                    if not await self._check_server_health(server_name):
                        logger.warning(f"[{server_name}] Server unhealthy, skipping")
                        failed_servers.add(server_name)
                        continue
                    
                    # Check if this server has the tool
                    try:
                        tools_response = await asyncio.wait_for(
                            server_info.session.list_tools(),
                            timeout=30
                        )
                        
                        if not tools_response or not hasattr(tools_response, 'tools'):
                            logger.error(f"[{server_name}] Invalid tools response")
                            failed_servers.add(server_name)
                            continue
                            
                        if not any(tool.name == tool_name for tool in tools_response.tools):
                            continue  # Tool not found on this server
                            
                        logger.info(f"Found tool {tool_name} on server {server_name}")
                        
                        # Attempt tool call with retry logic
                        for attempt in range(2):
                            try:
                                response = await asyncio.wait_for(
                                    server_info.session.call_tool(tool_name, tool_args),
                                    timeout=timeout
                                )
                                
                                if not response:
                                    logger.error(f"[{server_name}] Empty response from tool")
                                    if attempt < 1:
                                        logger.info(f"[{server_name}] Retrying tool call...")
                                        continue
                                    break
                                    
                                logger.debug(f"[{server_name}] Tool response: {response}")
                                logger.info(f"Successfully called {tool_name} on {server_name}")
                                
                                # Extract and validate content
                                formatted_response = []
                                if hasattr(response, 'content'):
                                    for content in response.content:
                                        if hasattr(content, 'type') and hasattr(content, 'text'):
                                            formatted_response.append({
                                                "type": content.type,
                                                "text": content.text
                                            })
                                
                                if not formatted_response:
                                    logger.warning(f"[{server_name}] No content in response")
                                    if attempt < 1:
                                        continue
                                        
                                return {
                                    "result": "success",
                                    "tool": tool_name,
                                    "args": tool_args,
                                    "response": formatted_response
                                }
                                
                            except asyncio.TimeoutError:
                                logger.error(f"[{server_name}] Tool call timed out after {timeout}s")
                                if attempt < 1:
                                    logger.info(f"[{server_name}] Retrying after timeout...")
                                    continue
                                break
                            except Exception as e:
                                logger.error(f"[{server_name}] Error calling tool: {str(e)}")
                                if "connection" in str(e).lower():
                                    await self.cleanup_server(server_name)
                                    failed_servers.add(server_name)
                                break
                                
                    except asyncio.TimeoutError:
                        logger.error(f"[{server_name}] Timeout listing tools")
                        failed_servers.add(server_name)
                    except Exception as e:
                        logger.error(f"[{server_name}] Error checking tools", exc_info=True)
                        failed_servers.add(server_name)
                        
                except Exception as e:
                    logger.error(f"[{server_name}] Critical error during tool call", exc_info=True)
                    failed_servers.add(server_name)
                    await self.cleanup_server(server_name)
            
            # If we've tried all servers and none worked, try reconnecting to failed ones
            if len(failed_servers) == len(self.servers):
                if retry_count < max_retries:
                    logger.info("All servers failed, attempting reconnection...")
                    for server_name in failed_servers:
                        try:
                            if await self.connect_to_server(server_name):
                                failed_servers.remove(server_name)
                        except Exception as e:
                            logger.error(f"Failed to reconnect to {server_name}: {e}")
                    retry_count += 1
                else:
                    break
            else:
                break
                
        logger.error(f"Tool {tool_name} not found or failed on all available servers")
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

    async def process_query(self, content: str, context: Optional[List[Dict]] = None) -> str:
        """Process a query using the core query processor."""
        return await self.query_processor.process_query(content, context)
