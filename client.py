import asyncio
import logging
import sys
import signal
import socket
from contextlib import AsyncExitStack
from dotenv import load_dotenv
import win32api
import win32con
import win32file
import win32wnet
import win32pipe

# Load environment variables from .env file
load_dotenv()

from mcp_chat import MCPChatInterface
from mcp_client import (
    ConfigManager,
    ServerManager,
    MessageProcessor,
    QueryProcessor,
    setup_logging
)
from anthropic import Anthropic

# Set up logging
setup_logging(debug_file='logs/mcp_debug.log')
logger = logging.getLogger(__name__)

# Add memory-specific logger
memory_logger = logging.getLogger('mcp_client.server.memory')

# Initialize Windows networking
# Global reference to Winsock DLL for cleanup
ws2_32 = None

def init_windows_networking():
    global ws2_32
    try:
        # Initialize Winsock
        import socket
        socket.setdefaulttimeout(30)
        
        # Reset Winsock to ensure clean state
        import ctypes
        import ctypes.wintypes
        
        # Load Ws2_32.dll
        ws2_32 = ctypes.WinDLL('ws2_32.dll')
        
        # Define WSAStartup structure
        class WSAData(ctypes.Structure):
            _fields_ = [
                ("wVersion", ctypes.wintypes.WORD),
                ("wHighVersion", ctypes.wintypes.WORD),
                ("szDescription", ctypes.c_char * 257),
                ("szSystemStatus", ctypes.c_char * 129),
                ("iMaxSockets", ctypes.c_ushort),
                ("iMaxUdpDg", ctypes.c_ushort),
                ("lpVendorInfo", ctypes.c_char_p)
            ]
        
        # Initialize Winsock
        wsadata = WSAData()
        ret = ws2_32.WSAStartup(0x202, ctypes.byref(wsadata))
        if ret != 0:
            raise WindowsError(f"WSAStartup failed with error {ret}")
            
        # Force network subsystem initialization
        win32wnet.WNetGetUser()
        
        # Configure socket default settings
        socket.setdefaulttimeout(30)  # 30 second timeout
        
        # Use the proper selector class
        import selectors
        socket.DefaultSelector = selectors.SelectSelector
        
        logger.debug("Windows networking initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Windows networking: {e}", exc_info=True)
        ws2_32 = None  # Clear reference on failure
        return False

def cleanup_windows_networking():
    global ws2_32
    if ws2_32 is not None:
        try:
            ws2_32.WSACleanup()
            logger.debug("Windows networking cleaned up successfully")
        except Exception as e:
            logger.error(f"Error cleaning up Windows networking: {e}", exc_info=True)
        finally:
            ws2_32 = None

# Initialize Windows networking
if sys.platform == 'win32':
    if not init_windows_networking():
        logger.error("Failed to initialize Windows networking - DNS resolution may fail")


async def initialize_servers(server_manager, config_manager, timeout=60):
    """Initialize servers sequentially with timeout"""
    logger.info("Starting server initialization...")
    server_names = config_manager.get_server_names()
    successful_connections = 0
    
    for server_name in server_names:
        try:
            logger.info(f"Connecting to server {server_name}...")
            connected = await server_manager.connect_to_server(server_name, timeout=timeout)
            if connected:
                logger.info(f"Successfully connected to {server_name}")
                successful_connections += 1
            else:
                logger.error(f"Failed to establish connection to {server_name}")
        except asyncio.TimeoutError:
            logger.error(f"Timeout connecting to {server_name}")
        except Exception as e:
            logger.error(f"Error connecting to {server_name}: {str(e)}", exc_info=True)
    
    logger.info(f"Server initialization completed. Connected to {successful_connections}/{len(server_names)} servers")
    return successful_connections > 0

# Global variable to track the main task
main_task = None

def handle_windows_signal(signal_type):
    """Handle Windows control signals"""
    if signal_type in (win32con.CTRL_C_EVENT, win32con.CTRL_BREAK_EVENT):
        logger.info(f"Received Windows signal: {signal_type}")
        if main_task and not main_task.done():
            # Schedule the cancellation in the event loop
            asyncio.get_event_loop().call_soon_threadsafe(main_task.cancel)
        return True  # Signal handled
    return False  # Not handled

async def main():
    """Main entry point for the MCP client"""
    logger.info("Starting MCP client...")
    
    # Register Windows signal handler
    win32api.SetConsoleCtrlHandler(handle_windows_signal, True)
    
    try:
        # Initialize components
        logger.info("Initializing configuration...")
        config_manager = ConfigManager()
        
        logger.info("Setting up component managers...")
        exit_stack = AsyncExitStack()
        server_manager = ServerManager(config_manager.config, exit_stack)
        query_processor = QueryProcessor(server_manager, Anthropic())
        message_processor = MessageProcessor(server_manager, query_processor)
        
        # Initialize servers with timeout
        if not await initialize_servers(server_manager, config_manager):
            logger.error("Failed to connect to any servers")
            return 1
            
        # Initialize query processor
        logger.info("Initializing query processor...")
        if not await query_processor.initialize(timeout=60):
            logger.error("Failed to initialize query processor")
            return 1
            
        # Start chat interface with fresh history
        logger.info("Starting chat interface...")
        chat_interface = MCPChatInterface(message_processor, load_existing_history=False)
        await chat_interface.run()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return 1
    finally:
        logger.info("Cleaning up resources...")
        await server_manager.cleanup_all()
        await exit_stack.aclose()
        logger.info("Cleanup completed")
    return 0

if __name__ == "__main__":
    try:
        # Create and configure event loop with system DNS resolver
        loop = asyncio.new_event_loop()
        loop.set_debug(False)  # Disable debug output
        
        # Configure Windows-specific DNS resolution
        if sys.platform == 'win32':
            import asyncio.windows_events
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
            
        asyncio.set_event_loop(loop)
        main_task = loop.create_task(main())
        exit_code = loop.run_until_complete(main_task)
        loop.close()
        
        # Cleanup Windows networking
        if sys.platform == 'win32':
            cleanup_windows_networking()
                
        sys.exit(exit_code)
    except asyncio.CancelledError:
        logger.info("Application cancelled gracefully")
        sys.exit(0)
    except Exception as e:
        logger.critical(f"Fatal error: {str(e)}", exc_info=True)
        if sys.platform == 'win32':
            cleanup_windows_networking()
        sys.exit(1)
