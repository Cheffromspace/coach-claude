# Codebase Summary

## Project Architecture

### Backend (Python)
```
mcp_client/
├── server/
│   ├── api_server.py       # FastAPI server
│   ├── server_manager.py   # MCP server management
│   └── communication/      # WebSocket handling
```

### Frontend (Next.js)
```
nexus-frontend/
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/
│   │   ├── animations/      # Animation components
│   │   ├── chat/           # Chat interface
│   │   ├── core/           # Core UI components
│   │   ├── layout/         # Layout components
│   │   ├── plugins/        # Plugin-specific components
│   │   │   ├── core/       # Core plugin UI
│   │   │   ├── coaching/   # Coaching plugin UI
│   │   │   └── health/     # Health plugin UI
│   │   └── shared/         # Shared components
│   ├── hooks/              # Custom React hooks
│   ├── mcp/                # MCP integration
│   │   ├── client/         # MCP client & WebSocket
│   │   ├── context/        # React context providers
│   │   ├── hooks/          # MCP-specific hooks
│   │   └── types/          # TypeScript definitions
│   ├── styles/             # Global styles
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
```

## Core Components

### Backend Integration
- **FastAPI Server**
  - REST API endpoints
  - WebSocket support
  - Tool execution
  - Resource access
  - Error handling

- **Server Manager**
  - MCP server connections
  - Health monitoring
  - Process management
  - Resource cleanup

### Frontend Integration
- **MCPClient** (src/mcp/client/index.ts)
  - API communication with FastAPI server
  - WebSocket connection management
  - Tool execution interface
  - Error handling with MCPError
  - Real-time event handling

- **MCPProvider** (src/mcp/context/MCPProvider.tsx)
  - Client instance management
  - Connection state handling
  - Tool and resource access
  - WebSocket event management
  - Error boundary integration
  - Auto-reconnection support

- **Custom Hooks** (src/mcp/hooks/*)
  - useMCPTool: Tool execution with loading/error states
  - useMCPConnection: Connection management with status helpers
  - useMCPWebSocket: WebSocket event subscription
  - useToolExecutionEvent: Tool-specific event handling
  - useMCPError: Error management with retry support
  - useMCPErrorHandler: Error code-specific handling
  - useErrorRetry: Automatic operation retry logic

### Chat Interface
- **Chat.tsx**
  - MCP tool execution integration
  - Message state management
  - Tool execution feedback
  - Error handling
  - Real-time updates
  - Message type support:
    - User messages
    - Tool execution messages
    - Tool result messages
    - Error messages

- **ChatContainer.tsx**
  - Layout wrapper
  - Plugin status display
  - WebSocket status
  - Server component

- **MessageList.tsx**
  - Message type-aware rendering
  - Tool execution feedback
  - Resource previews
  - Real-time updates

- **InputArea.tsx**
  - Message input handling
  - Loading state feedback
  - Error state handling
  - Real-time feedback

### Plugin Components

#### Core Plugin UI
- **NoteEditor**
  - Rich text editing
  - File attachments
  - Tag management
  - Real-time sync

- **FileExplorer**
  - Directory navigation
  - File operations
  - Search integration
  - Drag and drop

#### Coaching Plugin UI
- **GoalTracker**
  - Goal visualization
  - Progress tracking
  - Achievement display
  - Status updates

- **HabitManager**
  - Habit tracking
  - Streak monitoring
  - Performance metrics
  - Reminder system

#### Health Plugin UI
- **MetricsDashboard**
  - Data visualization
  - Trend analysis
  - Progress tracking
  - Report generation

## State Management

### Backend State
- Server connections
- WebSocket connections
- Tool availability
- Resource cache

### Frontend State
- MCP connection status
- WebSocket state
- Tool execution state
- Resource cache
- UI state

### Real-time Updates
- WebSocket events
- Tool execution feedback
- Resource updates
- Error notifications

## Data Flow

### Tool Execution
1. Frontend initiates tool request
2. API server receives request
3. Server manager executes tool
4. Real-time updates via WebSocket
5. UI updates with results

### Resource Access
1. Frontend requests resource
2. API server checks cache
3. Server manager fetches if needed
4. Response sent via REST/WebSocket
5. UI updates with content

## Recent Changes
- Integrated chat interface with MCP client
- Implemented tool execution in Chat component
- Added message type support for tool execution
- Enhanced error handling in chat interface
- Added real-time tool execution feedback

## Next Steps
1. Implement resource preview integration
2. Develop Core Plugin Interface
3. Create plugin-specific UI components
4. Enhance message rendering with Markdown
5. Add file attachment support

*Note: This document is updated as the codebase evolves.*
