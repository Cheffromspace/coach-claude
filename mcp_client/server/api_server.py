"""FastAPI server that exposes MCP functionality through a REST API."""

from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
import json
from typing import Dict, List, Optional, Any
from contextlib import AsyncExitStack

from ..config import ConfigManager
from .server_manager import ServerManager

# Set up logging
logger = logging.getLogger(__name__)

app = FastAPI(title="MCP API Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
config_manager: Optional[ConfigManager] = None
server_manager: Optional[ServerManager] = None
exit_stack: Optional[AsyncExitStack] = None
connected_websockets: List[WebSocket] = []

@app.on_event("startup")
async def startup_event():
    """Initialize MCP components on server startup."""
    global config_manager, server_manager, exit_stack
    
    logger.info("Starting MCP API server...")
    try:
        # Initialize components
        config_manager = ConfigManager()
        exit_stack = AsyncExitStack()
        server_manager = ServerManager(config_manager.config, exit_stack)
        
        # Initialize servers
        server_names = config_manager.get_server_names()
        for server_name in server_names:
            try:
                logger.info(f"Connecting to server {server_name}...")
                if await server_manager.connect_to_server(server_name):
                    logger.info(f"Successfully connected to {server_name}")
                else:
                    logger.error(f"Failed to connect to {server_name}")
            except Exception as e:
                logger.error(f"Error connecting to {server_name}: {str(e)}")
                
        logger.info("MCP API server started successfully")
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on server shutdown."""
    global server_manager, exit_stack
    
    logger.info("Shutting down MCP API server...")
    try:
        if server_manager:
            await server_manager.cleanup_all()
        if exit_stack:
            await exit_stack.aclose()
        logger.info("Cleanup completed")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")

@app.get("/api/servers")
async def get_servers():
    """Get list of connected MCP servers."""
    if not server_manager:
        raise HTTPException(status_code=503, detail="Server manager not initialized")
        
    return {
        "servers": list(server_manager.connected_servers)
    }

@app.get("/api/resources")
async def get_resources():
    """Get list of available resources from all connected servers."""
    if not server_manager:
        raise HTTPException(status_code=503, detail="Server manager not initialized")
        
    try:
        resources = await server_manager.get_all_resources()
        return {
            "resources": resources
        }
    except Exception as e:
        logger.error(f"Error getting resources: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/resource-templates")
async def get_resource_templates():
    """Get list of available resource templates from all connected servers."""
    if not server_manager:
        raise HTTPException(status_code=503, detail="Server manager not initialized")
        
    try:
        templates = await server_manager.get_all_resource_templates()
        return {
            "templates": templates
        }
    except Exception as e:
        logger.error(f"Error getting resource templates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/resources/{uri:path}")
async def get_resource(uri: str):
    """Get content of a specific resource."""
    if not server_manager:
        raise HTTPException(status_code=503, detail="Server manager not initialized")
        
    try:
        content = await server_manager.get_resource_content(uri)
        if content is None:
            raise HTTPException(status_code=404, detail=f"Resource {uri} not found")
            
        return content
    except Exception as e:
        logger.error(f"Error getting resource {uri}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tools")
async def get_tools():
    """Get list of available tools from all connected servers."""
    if not server_manager:
        raise HTTPException(status_code=503, detail="Server manager not initialized")
        
    try:
        tools = await server_manager.get_all_tools()
        return {
            "tools": tools
        }
    except Exception as e:
        logger.error(f"Error getting tools: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tools/{tool_name}/execute")
async def execute_tool(tool_name: str, args: Dict):
    """Execute a tool with the given arguments."""
    if not server_manager:
        raise HTTPException(status_code=503, detail="Server manager not initialized")
        
    try:
        result = await server_manager.call_tool(tool_name, args)
        if result is None:
            raise HTTPException(status_code=404, detail=f"Tool {tool_name} not found")
            
        # Notify WebSocket clients
        message = {
            "type": "tool_execution",
            "tool": tool_name,
            "result": result
        }
        await broadcast_ws_message(message)
        
        return result
    except Exception as e:
        logger.error(f"Error executing tool {tool_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await websocket.accept()
    connected_websockets.append(websocket)
    
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                # Handle client messages if needed
                logger.debug(f"Received WebSocket message: {message}")
            except json.JSONDecodeError:
                logger.error(f"Invalid WebSocket message format: {data}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        connected_websockets.remove(websocket)

async def broadcast_ws_message(message: Dict):
    """Broadcast a message to all connected WebSocket clients."""
    for websocket in connected_websockets:
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {str(e)}")
            try:
                connected_websockets.remove(websocket)
            except ValueError:
                pass

@app.post("/api/query")
async def process_query(query: Dict[str, Any]):
    """Process a query using the core query processor."""
    if not server_manager:
        raise HTTPException(status_code=503, detail="Server manager not initialized")
        
    try:
        # Extract query content and context
        content = query.get("content")
        context = query.get("context")
        
        if not content:
            raise HTTPException(status_code=400, detail="Query content is required")
            
        # Process query through message processor
        result = await server_manager.process_query(content, context)
        
        # Notify WebSocket clients
        message = {
            "type": "query_result",
            "content": content,
            "result": result
        }
        await broadcast_ws_message(message)
        
        return {
            "content": [
                {
                    "type": "text",
                    "text": result
                }
            ]
        }
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def start_server(config_path: str = 'config.json'):
    """Start the FastAPI server.
    
    Args:
        config_path: Path to the config file
    """
    # Set config path for ConfigManager to use
    ConfigManager.DEFAULT_CONFIG_PATH = config_path
    
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3001)

if __name__ == "__main__":
    start_server()
