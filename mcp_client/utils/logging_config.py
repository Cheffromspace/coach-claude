import logging
import sys
from typing import Optional

def setup_logging(
    level: int = logging.INFO,
    log_file: Optional[str] = None,
    debug_file: str = 'mcp_debug.log'
) -> None:
    """Configure logging for the application
    
    Args:
        level: The logging level to use
        log_file: Optional file path to write logs to
        debug_file: Path to debug log file (defaults to mcp_debug.log)
    """
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Always add console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # Add file handler if log file specified
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    try:
        # Configure specific loggers
        logging.getLogger('asyncio').setLevel(logging.WARNING)
        logging.getLogger('anthropic').setLevel(logging.WARNING)
        
        # Enable detailed logging for MCP components
        mcp_loggers = [
            'mcp',
            'mcp_client.server.server_manager',
            'mcp_client.server.stdio',  # Add stdio-specific logger
            'mcp_client.server.memory'  # Add memory server-specific logger
        ]
        
        for logger_name in mcp_loggers:
            logger = logging.getLogger(logger_name)
            logger.setLevel(logging.DEBUG)
            
            # Add stdio handler for detailed communication logging
            if logger_name == 'mcp_client.server.stdio':
                stdio_formatter = logging.Formatter(
                    '%(asctime)s - %(name)s - %(levelname)s - [%(server_name)s] %(message)s'
                )
                stdio_handler = logging.StreamHandler(sys.stdout)
                stdio_handler.setFormatter(stdio_formatter)
                logger.addHandler(stdio_handler)
        
        # Add debug log file handler with rotation
        if debug_file:
            try:
                debug_file_handler = logging.FileHandler(debug_file, mode='w')
                debug_file_handler.setLevel(logging.DEBUG)
                debug_file_handler.setFormatter(formatter)
                root_logger.addHandler(debug_file_handler)
                logging.info(f"Debug logging enabled to {debug_file}")
            except IOError as e:
                logging.error(f"Failed to create debug log file: {e}")
    except Exception as e:
        logging.error(f"Error configuring logging: {e}")
