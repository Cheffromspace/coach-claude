import asyncio
import logging
import sys
from contextlib import AsyncExitStack
from dotenv import load_dotenv

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

# Set up logging with debug level and debug file
setup_logging(level=logging.DEBUG, debug_file='mcp_debug.log')
logger = logging.getLogger(__name__)

# Add memory-specific logger
memory_logger = logging.getLogger('mcp_client.server.memory')

async def initialize_servers(server_manager, config_manager, timeout=60):
    """Initialize all configured servers concurrently with timeout"""
    logger.info("Starting server initialization...")
    server_names = config_manager.get_server_names()
    
    async def connect_server(server_name: str):
        try:
            logger.info(f"Connecting to server {server_name}...")
            connected = await server_manager.connect_to_server(server_name, timeout=timeout)
            if connected:
                logger.info(f"Successfully connected to {server_name}")
                return True
            logger.error(f"Failed to establish connection to {server_name}")
            return False
        except asyncio.TimeoutError:
            logger.error(f"Timeout connecting to {server_name}")
            return False
        except Exception as e:
            logger.error(f"Error connecting to {server_name}: {str(e)}", exc_info=True)
            return False
    
    # Create tasks for all servers
    connection_tasks = [
        asyncio.create_task(connect_server(server_name))
        for server_name in server_names
    ]
    
    # Wait for all servers to initialize with timeout
    try:
        results = await asyncio.wait_for(
            asyncio.gather(*connection_tasks, return_exceptions=True),
            timeout=timeout
        )
        successful_connections = sum(1 for result in results if result is True)
        logger.info(f"Server initialization completed. Connected to {successful_connections}/{len(server_names)} servers")
        return successful_connections > 0
    except asyncio.TimeoutError:
        logger.error(f"Global server initialization timed out after {timeout} seconds")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during server initialization: {str(e)}", exc_info=True)
        return False

async def main():
    """Main entry point for the MCP client"""
    logger.info("Starting MCP client...")
    
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
        if not await query_processor.initialize(timeout=30):
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
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except Exception as e:
        logger.critical(f"Fatal error: {str(e)}", exc_info=True)
        sys.exit(1)
