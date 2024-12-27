# Codebase Summary

## Key Components and Their Interactions

### MCP Client Core (`mcp_client/`)
The foundation of our system, implementing the Model Context Protocol for AI model interaction.

#### Configuration (`config/`)
- **Config Manager** (`config_manager.py`)
  - Handles configuration loading and management
  - Manages environment variables
  - Provides server settings management
  - Ensures consistent configuration across components

#### Server Management (`server/`)
- **Server Manager** (`server_manager.py`)
  - Manages MCP server lifecycle
  - Handles server connections
  - Implements error recovery
  - Coordinates resource access

#### Processing (`processing/`)
- **Message Processor** (`message_processor.py`)
  - Handles message formatting
  - Manages message routing
  - Implements processing pipeline

- **Query Processor** (`query_processor.py`)
  - Manages query handling
  - Implements response processing
  - Coordinates tool usage

#### Utilities (`utils/`)
- **Logging Config** (`logging_config.py`)
  - Configures system logging
  - Manages log formats and outputs

### Chat Interface (`mcp_chat/`)
- **Chat Implementation** (`chat.py`)
  - Provides user interaction layer
  - Integrates conversation and prompt management
  - Handles message flow and commands
  - Supports session management

- **Conversation Manager** (`conversation_manager.py`)
  - Manages conversation sessions
  - Tracks message history and tool usage
  - Handles metadata and context
  - Provides session persistence

- **System Prompts** (`system_prompts.py`)
  - Manages prompt templates
  - Handles variable substitution
  - Provides default system prompts
  - Supports template categorization

## Data Flow
1. User Input → Chat Interface
   - Command processing
   - Message capture
   - Session management
   - System prompt integration

2. Chat Interface → Conversation Manager
   - Message recording
   - Context management
   - Tool usage tracking
   - Metadata handling

3. Conversation Manager → Message Processor
   - Message formatting with context
   - System prompt integration
   - Pipeline initialization

4. Message Processor → Query Processor
   - Query extraction with context
   - Tool discovery and coordination
   - Response preparation and tracking

5. Query Processor → Server Manager
   - Server selection and health checks
   - Tool execution and monitoring
   - Response management and error handling

5. Server Manager → MCP Servers
   - Protocol handling
   - Resource management
   - Error handling
   - Obsidian integration via dedicated server
     * Note reading/writing
     * Template handling
     * Backlink support

## External Dependencies
Key dependencies from pyproject.toml and requirements.txt:
- Python core libraries
- MCP implementation requirements
- Development tools (UV)
- Testing frameworks

### MCP Servers
- **Obsidian Server**: Note operations, templates, backlinks
- **Filesystem Server**: File system operations
- **GitHub Server**: Repository operations
- **Fetch Server**: Web content retrieval
- **Brave Search Server**: Web search capabilities
- **Weather Server**: Weather data access

## Recent Significant Changes
1. Core Integration
   - Enhanced conversation management
   - Implemented system prompt handling
   - Added session persistence
   - Improved tool usage tracking

2. User Interface
   - Added session management commands
   - Enhanced message display
   - Improved error handling
   - Added metadata support

3. System Architecture
   - Integrated conversation and prompt management
   - Enhanced context handling
   - Improved tool orchestration
   - Added session persistence

2. Documentation
   - Created comprehensive project documentation
   - Established project roadmap
   - Documented technology stack
   - Created development guidelines

3. Architecture
   - Defined system architecture
   - Established component boundaries
   - Implemented core interfaces
   - Set up basic infrastructure

## Project Structure
```
coach-claude/
├── mcp_client/               # Core MCP implementation
│   ├── config/              # Configuration management
│   ├── server/              # Server handling
│   ├── processing/          # Message and query processing
│   └── utils/               # Utility functions
├── mcp_chat/                # Chat interface
├── cline_docs/              # Project documentation
├── chat_history/            # Conversation records
└── logs/                    # System logs
```

## Additional Documentation
All project documentation is maintained in `cline_docs/`:
- `projectRoadmap.md`: Project vision and milestones
- `currentTask.md`: Active development focus
- `techStack.md`: Technology choices and rationale
- `codebaseSummary.md`: This document

### Obsidian Templates
Located in `Documents/coach-claude/templates/`:
- `insight.md`: Template for capturing key insights
  - Context tracking with dates and relationships
  - Impact assessment
  - Action items
  - Related insights linking
  
- `reflection.md`: Template for periodic reflections
  - Flexible periods (daily/weekly/monthly)
  - Key observations and patterns
  - Progress tracking
  - Challenge identification
  - Next steps planning

## Next Steps in Development
1. Knowledge Management
   - Implement Obsidian integration
   - Create logging system
   - Develop consolidation workflows

2. Core Features
   - Enhance conversation management
   - Implement pattern recognition
   - Develop insight extraction

3. Infrastructure
   - Set up testing framework
   - Implement monitoring
   - Enhance error handling

*Note: This document will be updated as the codebase evolves and new components are added.*
