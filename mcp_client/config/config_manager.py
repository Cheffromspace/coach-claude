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

    def _load_config(self) -> Dict:
        """Load MCP server configuration from config file"""
        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)
            return config
        except Exception as e:
            logger.error(f"Failed to load config file: {str(e)}")
            return {"mcpServers": {}}

    def get_server_config(self, server_name: str) -> Dict:
        """Get configuration for a specific server"""
        return self.config.get('mcpServers', {}).get(server_name, {})

    def get_all_server_names(self) -> list:
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
