# Coach Claude - Extensible AI Development Platform

Coach Claude is a collection of interoperable projects built on the Model Context Protocol (MCP), focusing on extensible AI integration with knowledge management systems. The platform currently consists of two main projects that will be separated into independent repositories:

1. A Windows-optimized MCP client for AI model integration
2. An extensible Obsidian MCP server with a powerful plugin system

![MCP Architecture](docs/images/mcp-architecture.png)

## 🏗️ Project Architecture

### MCP Client (Windows-focused)
A standalone Python-based client that implements the Model Context Protocol:

- **Extensible Message Processing**
  - Pluggable message processors
  - Custom tool handlers
  - Flexible caching strategies
  - Query processing pipeline

- **Server Management**
  - Dynamic server discovery
  - Connection lifecycle management
  - Health monitoring
  - Process isolation

- **Configuration System**
  - Server configuration
  - Tool definitions
  - Environment management
  - Logging infrastructure

### Obsidian MCP Server
A TypeScript-based server providing extensible Obsidian integration:

- **Plugin System Architecture**
```typescript
interface MCPPlugin {
  name: string;
  version: string;
  description?: string;
  
  onLoad(): Promise<void>;
  onUnload(): Promise<void>;
  
  getTools(): ToolDefinition[];
  getResources?(): ResourceDefinition[];
}
```

- **Core Plugin Features**
  - Note operations (CRUD)
  - Advanced search capabilities
  - Tag management system
  - Metadata handling

- **Specialized Plugins**
  - Coaching functionality
  - Health tracking
  - Tool documentation
  - Custom plugin support

## 🛠️ Technology Stack

### MCP Client
- Python 3.8+
- UV for dependency management
- Windows-optimized socket operations
- Protocol buffers
- asyncio for async operations

### Obsidian Server
- TypeScript
- Node.js
- MCP SDK
- Plugin architecture

## 🔌 Extensibility

### MCP Client Extensions
- Custom message processors
- Tool handler plugins
- Cache strategy implementations
- Server type definitions

### Obsidian Server Plugins
Plugins can be developed independently and will be distributed as separate packages:

- **Core Plugin** (Will be separate package)
  - Essential Obsidian operations
  - Base functionality for other plugins

- **Coaching Plugin** (Will be separate package)
  - Personal development features
  - Goal tracking system

- **Health Plugin** (Will be separate package)
  - Wellness tracking
  - Metric management

## 🚀 Getting Started

### System Requirements
- Windows 10 or later
- Python 3.8+
- Node.js 18+
- Obsidian desktop app

### Installation

1. **Clone Current Repository**
   ```cmd
   git clone https://github.com/yourusername/coach-claude.git
   cd coach-claude
   ```

2. **MCP Client Setup**
   ```cmd
   cd mcp_client
   python -m venv .venv
   .venv\Scripts\activate
   uv pip install -r requirements.txt
   ```

3. **Obsidian Server Setup**
   ```cmd
   cd mcp-servers/obsidian-server
   npm install
   ```

### Configuration
1. Configure MCP servers in `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
2. Set up Obsidian vault path
3. Configure plugin settings as needed

## 🔒 Security

- Local-first architecture
- Process isolation
- Controlled resource access
- Standardized security protocols

## 📝 Documentation

- [System Architecture](docs/system-architecture.md)
- [Plugin Development Guide](docs/plugin-development-guide.md)
- [API Reference](docs/api-reference.md)

## 🎯 Future Development

### Project Separation
The following components will become independent projects:

1. MCP Client
   - Core protocol implementation
   - Extension system
   - Server management

2. Obsidian MCP Server
   - Base server functionality
   - Plugin management system
   - Core Obsidian operations

3. Individual Plugin Packages
   - Core Plugin
   - Coaching Plugin
   - Health Plugin
   - Community plugins

4. Web Interface (Planned)
   - Next.js-based dashboard
   - Real-time updates
   - Plugin management

## 📄 Licensing

This project consists of multiple components with different licenses:

1. **Obsidian MCP Server (Base)**
   - MIT License
   - Free to use, modify, and distribute
   - See [mcp-servers/obsidian-server/LICENSE](mcp-servers/obsidian-server/LICENSE)

2. **MCP Client & Coaching Plugin**
   - Proprietary License
   - All rights reserved
   - Commercial use restricted to the copyright holder

## 📧 Contact

For questions and support, please open an issue or contact the maintainers.

---

Built with ❤️ by the Coach Claude team
