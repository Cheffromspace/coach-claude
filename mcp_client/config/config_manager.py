import json
import logging
import os
from typing import Dict
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

class ConfigManager:
    def __init__(self, config_path: str = 'config.json'):
        self.config_path = config_path
        load_dotenv()  # Load environment variables from .env
        self.config = self._load_config()

    def _validate_server_config(self, config: Dict) -> None:
        """Validate server configuration format and types"""
        # Check required fields
        required_fields = ['command', 'args']
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Missing required field '{field}' in server config")
        
        # Validate command is a string
        if not isinstance(config['command'], str):
            raise ValueError("Server config 'command' must be a string")
            
        # Validate args is a list
        if not isinstance(config['args'], list):
            raise ValueError("Server config 'args' must be a list")
            
        # Validate env is a dict if present
        if 'env' in config and not isinstance(config['env'], dict):
            raise ValueError("Server config 'env' must be a dictionary")

    def _load_config(self) -> Dict:
        """Load MCP server configuration from config file"""
        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)
            
            # Ensure mcpServers section exists and is a dict
            if 'mcpServers' not in config:
                config['mcpServers'] = {}
            elif not isinstance(config['mcpServers'], dict):
                raise ValueError("'mcpServers' must be a dictionary")
            
            # Return early if no servers configured
            if not config['mcpServers']:
                return config
                
            # Validate each server config
            for server_name, server_config in config['mcpServers'].items():
                if not isinstance(server_config, dict):
                    raise ValueError(f"Server config for '{server_name}' must be a dictionary")
                try:
                    self._validate_server_config(server_config)
                except ValueError as e:
                    logger.error(f"Invalid config for server '{server_name}': {str(e)}")
                    raise ValueError(f"Invalid server configuration for '{server_name}': {str(e)}")
            
            return config
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse config file: {str(e)}")
            raise ValueError("Invalid server configuration: JSON parse error")
        except FileNotFoundError as e:
            logger.error(f"Config file not found: {str(e)}")
            raise ValueError("Invalid server configuration: Config file not found")
        except Exception as e:
            logger.error(f"Failed to load config file: {str(e)}")
            raise ValueError(f"Invalid server configuration: {str(e)}")

    def get_server_config(self, server_name: str) -> Dict:
        """Get configuration for a specific server"""
        servers = self.config.get('mcpServers', {})
        if server_name not in servers:
            raise KeyError(f"Server '{server_name}' not found in configuration")
        return servers[server_name]

    def get_server_names(self) -> list:
        """Get list of all configured server names"""
        return list(self.config.get('mcpServers', {}).keys())

    def get_env_var(self, var_name: str, default: str = None) -> str:
        """Get environment variable with optional default"""
        return os.environ.get(var_name, default)

    def get_server_env(self, server_name: str) -> Dict:
        """Get environment variables for a specific server"""
        server_config = self.get_server_config(server_name)
        env = server_config.get('env', {})
        
        # Convert environment variables to actual values
        resolved_env = {}
        for key, value in env.items():
            if isinstance(value, str) and value.startswith('$'):
                # If value starts with $, treat it as an environment variable reference
                env_var_name = value[1:]  # Remove the $ prefix
                resolved_env[key] = self.get_env_var(env_var_name, '')
            else:
                resolved_env[key] = value
                
        return resolved_env
