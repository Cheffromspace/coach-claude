import asyncio
import logging
import sys
from contextlib import AsyncExitStack

from mcp_chat import MCPChatInterface
from mcp_client import (
    ConfigManager,
    ServerManager,
    MessageProcessor,
    setup_logging
)
from anthropic import Anthropic

# Set up logging
setup_logging()
logger = logging.getLogger(__name__)

async def main():
    """Main entry point for the MCP client"""
    # Initialize components
    config_manager = ConfigManager()
    exit_stack = AsyncExitStack()
    server_manager = ServerManager(config_manager.config, exit_stack)
    message_processor = MessageProcessor(server_manager, Anthropic())

    try:
        # Connect to configured servers
        for server_name in config_manager.get_all_server_names():
            connected = await server_manager.connect_to_server(server_name)
            if not connected:
                logger.error(f"Failed to establish connection to {server_name}")
                continue
        
        if not server_manager.connected_servers:
            logger.error("No servers connected")
            sys.exit(1)
            
        # Start chat interface with fresh history
        chat_interface = MCPChatInterface(message_processor, load_existing_history=False)
        await chat_interface.run()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
    finally:
        await server_manager.cleanup_all()
        await exit_stack.aclose()

if __name__ == "__main__":
    asyncio.run(main())
