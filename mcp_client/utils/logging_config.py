import logging
import sys
from typing import Optional

def _get_log_level(level_str: str) -> int:
    """Convert string log level to logging constant"""
    level_map = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL
    }
    return level_map.get(level_str.upper(), logging.INFO)

import os

def setup_logging(
    log_file: Optional[str] = None,
    debug_file: str = 'logs/mcp_debug.log'
) -> None:
    """Configure logging for the application using settings from logging.json
    
    Args:
        log_file: Optional file path to write logs to
        debug_file: Path to debug log file (defaults to mcp_debug.log)
    """
    from mcp_client.config.config_manager import ConfigManager
    config = ConfigManager().get_logging_config()
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Configure root logger with console level
    root_logger = logging.getLogger()
    console_level = _get_log_level(config.get('console_level', 'INFO'))
    root_logger.setLevel(console_level)

    # Always add console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(console_level)
    root_logger.addHandler(console_handler)

    # Create logs directory if it doesn't exist
    os.makedirs('logs', exist_ok=True)

    # Add file handler if log file specified
    if log_file:
        log_path = os.path.join('logs', log_file)
        file_handler = logging.FileHandler(log_path)
        file_handler.setFormatter(formatter)
        file_handler.setLevel(_get_log_level(config.get('file_level', 'WARNING')))
        root_logger.addHandler(file_handler)

    try:
        # Configure specific loggers
        logging.getLogger('asyncio').setLevel(logging.WARNING)
        logging.getLogger('anthropic').setLevel(logging.WARNING)
        
        # Configure MCP loggers based on config
        mcp_logger_levels = config.get('mcp_loggers', {})
        for logger_name, level in mcp_logger_levels.items():
            logger = logging.getLogger(logger_name)
            logger.setLevel(_get_log_level(level))
            
            # Add stdio handler for detailed communication logging
            if logger_name == 'mcp_client.server.stdio':
                stdio_formatter = logging.Formatter(
                    '%(asctime)s - %(name)s - %(levelname)s - [%(server_name)s] %(message)s'
                )
                stdio_handler = logging.StreamHandler(sys.stdout)
                stdio_handler.setFormatter(stdio_formatter)
                stdio_handler.setLevel(_get_log_level(level))
                logger.addHandler(stdio_handler)
        
        # Add debug log file handler
        if debug_file:
            try:
                debug_file_handler = logging.FileHandler(debug_file, mode='w', encoding='utf-8')
                debug_file_handler.setLevel(_get_log_level(config.get('debug_level', 'INFO')))
                debug_file_handler.setFormatter(formatter)
                root_logger.addHandler(debug_file_handler)
                logging.info(f"Debug logging enabled to {debug_file}")
            except IOError as e:
                logging.error(f"Failed to create debug log file: {e}")
    except Exception as e:
        logging.error(f"Error configuring logging: {e}")
