# MCP Client Implementation Reference

## Setup Requirements
- Python (latest version)
- uv package manager
- Anthropic API key

## Project Initialization
```bash
uv init mcp-client
cd mcp-client
uv venv
# Activate venv (Windows: .venv\Scripts\activate, Unix/Mac: source .venv/bin/activate)
uv add mcp anthropic python-dotenv
```

## Core Components

### 1. Basic Structure
```python
class MCPClient:
    def __init__(self):
        self.session = None
        self.exit_stack = AsyncExitStack()
        self.anthropic = Anthropic()
```

### 2. Server Connection
```python
async def connect_to_server(self, server_script_path: str):
    # Validate script type (Python/Node)
    command = "python" if server_script_path.endswith('.py') else "node"
    server_params = StdioServerParameters(command=command, args=[server_script_path])
    
    # Setup transport and session
    stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
    self.stdio, self.write = stdio_transport
    self.session = await self.exit_stack.enter_async_context(ClientSession(self.stdio, self.write))
    await self.session.initialize()
```

### 3. Query Processing
```python
async def process_query(self, query: str) -> str:
    # Initial message setup
    messages = [{"role": "user", "content": query}]
    
    # Get available tools
    response = await self.session.list_tools()
    available_tools = [{
        "name": tool.name,
        "description": tool.description,
        "input_schema": tool.inputSchema
    } for tool in response.tools]
    
    # Process with Claude and handle tool calls
    response = self.anthropic.messages.create(
        model="claude-3-5-sonnet-20241022",
        messages=messages,
        tools=available_tools
    )
    
    # Handle tool calls and responses
    # Return combined results
```

## Key Implementation Notes

1. **Error Handling**
   - Validate server script type
   - Handle tool call failures
   - Manage connection issues

2. **Resource Management**
   - Use AsyncExitStack for cleanup
   - Proper session initialization/cleanup
   - Handle graceful shutdowns

3. **Security**
   - Store API keys in .env
   - Add .env to .gitignore
   - Validate server inputs

4. **Best Practices**
   - Maintain conversation context
   - Handle tool results appropriately
   - Clean error reporting
   - Regular commits on working builds

## Usage
```bash
python client.py <path_to_server_script>
```

Source: https://modelcontextprotocol.io/quickstart/client