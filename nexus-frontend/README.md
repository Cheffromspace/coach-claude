# Nexus Frontend

A Next.js frontend for interacting with MCP servers.

## Prerequisites

- Node.js 18+
- Python 3.8+
- npm or yarn

## Setup

1. Install JavaScript dependencies:
```bash
npm install
```

2. Install Python dependencies:
```bash
# From the root directory (one level up from nexus-frontend)
pip install -r requirements.txt
```

## Development

To run the development environment with MCP server:

```bash
npm run dev:all
```

This will:
1. Start the Python MCP server on port 3001
2. Start the Next.js development server on port 3000

You can also run the servers separately:

- Start only the MCP server:
```bash
npm run mcp
```

- Start only the Next.js development server:
```bash
npm run dev
```

## Architecture

The application consists of two main parts:

1. **Next.js Frontend**
   - React components for chat interface
   - MCP client integration
   - WebSocket connection for real-time updates

2. **Python MCP Server**
   - FastAPI server providing MCP functionality
   - WebSocket support for real-time communication
   - Tool execution and resource management

## MCP Integration

The chat interface is integrated with MCP through:

- WebSocket connection for real-time updates
- REST API for tool execution
- React context for MCP state management
- Custom hooks for MCP functionality

## Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run mcp` - Start Python MCP server
- `npm run dev:all` - Start both servers together
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run linting
