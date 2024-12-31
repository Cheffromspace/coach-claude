"""Script to start the MCP FastAPI server."""

import sys
import os
import subprocess
import time
import requests
from pathlib import Path

def is_server_running():
    """Check if the MCP server is already running."""
    try:
        response = requests.get("http://localhost:3001/api/servers")
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        return False

def start_server():
    """Start the MCP FastAPI server."""
    # Get the path to the mcp_client package and config file
    root_dir = Path(__file__).parent.parent.parent
    mcp_client_path = root_dir / "mcp_client"
    config_path = root_dir / "config.json"
    
    # Add the parent directory to Python path so it can find the mcp_client package
    sys.path.append(str(mcp_client_path.parent))
    
    # Import and start the server with config path
    from mcp_client.server.api_server import start_server
    start_server(config_path=str(config_path))

if __name__ == "__main__":
    if not is_server_running():
        print("Starting MCP server...")
        start_server()
    else:
        print("MCP server is already running")
