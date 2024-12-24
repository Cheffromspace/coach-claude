"""Tests for the configuration manager module."""
import pytest
import json
import os
from pathlib import Path
from mcp_client.config.config_manager import ConfigManager
from unittest.mock import mock_open, patch, MagicMock

@pytest.fixture
def mock_env():
    """Mock environment variables."""
    with patch.dict(os.environ, {'CONFIG_PATH': 'config.json'}):
        yield

@pytest.fixture
def valid_config():
    """Valid configuration fixture."""
    return {
        "mcpServers": {
            "test-server": {
                "command": "node",
                "args": ["test-server.js"],
                "env": {"TEST_ENV": "value"}
            }
        }
    }

@pytest.fixture
def invalid_config():
    """Invalid configuration fixture."""
    return {
        "mcpServers": {
            "test-server": {
                "args": ["test-server.js"]  # Missing required 'command' field
            }
        }
    }

def test_config_manager_init(mock_env):
    """Test ConfigManager initialization."""
    with patch('builtins.open', mock_open(read_data='{}')):
        config_manager = ConfigManager()
        assert isinstance(config_manager.config, dict)

def test_load_valid_config(mock_env, valid_config):
    """Test loading a valid configuration file."""
    with patch('builtins.open', mock_open(read_data=json.dumps(valid_config))):
        config_manager = ConfigManager()
        assert config_manager.config == valid_config
        assert "test-server" in config_manager.get_server_names()

def test_load_invalid_config(mock_env, invalid_config):
    """Test loading an invalid configuration file."""
    with patch('builtins.open', mock_open(read_data=json.dumps(invalid_config))):
        with pytest.raises(ValueError) as exc_info:
            ConfigManager()
        assert "Invalid server configuration" in str(exc_info.value)

def test_get_server_config(mock_env, valid_config):
    """Test retrieving server configuration."""
    with patch('builtins.open', mock_open(read_data=json.dumps(valid_config))):
        config_manager = ConfigManager()
        server_config = config_manager.get_server_config("test-server")
        assert server_config == valid_config["mcpServers"]["test-server"]
        
        with pytest.raises(KeyError):
            config_manager.get_server_config("nonexistent-server")

def test_validate_server_config():
    """Test server configuration validation."""
    config_manager = ConfigManager()
    
    # Valid config
    valid = {
        "command": "node",
        "args": ["server.js"],
        "env": {}
    }
    assert config_manager._validate_server_config(valid) is None
    
    # Missing command
    invalid_missing_command = {
        "args": ["server.js"],
        "env": {}
    }
    with pytest.raises(ValueError):
        config_manager._validate_server_config(invalid_missing_command)
    
    # Invalid args type
    invalid_args = {
        "command": "node",
        "args": "server.js",  # Should be a list
        "env": {}
    }
    with pytest.raises(ValueError):
        config_manager._validate_server_config(invalid_args)
    
    # Invalid env type
    invalid_env = {
        "command": "node",
        "args": ["server.js"],
        "env": []  # Should be a dict
    }
    with pytest.raises(ValueError):
        config_manager._validate_server_config(invalid_env)
