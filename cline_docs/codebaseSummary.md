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
  - Cache performance monitoring and statistics
  - Documentation caching commands
  - Enhanced /cache command with block statistics

- **Conversation Manager** (`conversation_manager.py`)
  - Manages conversation sessions
  - Tracks message history and tool usage
  - Handles metadata and context
  - Provides session persistence
  - Implements chunked conversation caching:
    * Splits messages into manageable chunks
    * Size-based chunk management (5 messages/2000 tokens)
    * Individual cache blocks per chunk
    * Automatic chunk size optimization
  - Cache block management:
    * Tracks active, cleaned, and total blocks
    * Automatic cleanup on session load
    * Block creation and cleanup monitoring
    * Performance statistics tracking
  - Tracks cache performance metrics:
    * Block allocation/deallocation rates
    * Cache hit/miss ratios
    * Memory usage patterns
    * Token savings calculations

- **System Prompts** (`system_prompts.py`)
  - Advanced NLP-based context analysis using spaCy:
    * Linguistic feature analysis
    * Named entity recognition
    * Part-of-speech tagging
    * Sentiment analysis
  - High-performance pattern matching with flashtext:
    * O(n) complexity keyword matching
    * Efficient tool and context detection
    * Extensible keyword dictionaries
  - Enhanced context detection:
    * Message type classification (task/reflection/insight/planning)
    * Complexity estimation
    * Interaction phase detection
    * Tool requirement prediction
  - Intelligent prompt management:
    * Dynamic template selection
    * Context-aware prompt generation
    * Cache control optimization
    * Support for specialized contexts (privacy, tools, etc.)

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
   - Cache block management
   - Chunk size optimization

3. Conversation Manager → Message Processor
   - Message formatting with context
   - System prompt integration
   - Pipeline initialization
   - Cache control handling

4. Message Processor → Query Processor
   - Query extraction with context
   - Tool discovery and coordination
   - Response preparation and tracking
   - Cache performance monitoring

5. Query Processor → Server Manager
   - Server selection and health checks
   - Tool execution and monitoring
   - Response management and error handling
   - Prompt effectiveness tracking:
     * Tool success rates
     * Cache hit rates
     * Usage patterns
     * Context adaptation

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
- NLP and Pattern Matching:
  * spaCy (>=3.7.2): Advanced natural language processing
  * flashtext (>=2.7): High-performance keyword matching

### MCP Servers
- **Obsidian Server**: Note operations, templates, backlinks
- **Filesystem Server**: File system operations
- **GitHub Server**: Repository operations
- **Fetch Server**: Web content retrieval
- **Brave Search Server**: Web search capabilities
- **Weather Server**: Weather data access

## Recent Significant Changes
1. Cache Management Improvements
   - Implemented chunked conversation caching
   - Added cache block tracking and cleanup
   - Enhanced cache performance monitoring
   - Improved cache statistics reporting
   - Added automatic chunk size management
   - Implemented session-level cache cleanup

2. Core Integration
   - Enhanced conversation management with context awareness
   - Implemented dynamic system prompt selection
   - Added session persistence with effectiveness tracking
   - Improved tool usage tracking with pattern analysis
   - Added comprehensive prompt caching system
   - Integrated context-based prompt adaptation

3. User Interface
   - Added session management commands
   - Enhanced message display
   - Improved error handling
   - Added metadata support
   - Enhanced /cache command with block statistics

4. System Architecture
   - Integrated conversation and prompt management
   - Enhanced context handling
   - Improved tool orchestration
   - Added session persistence
   - Implemented cache block management

5. Documentation
   - Created comprehensive project documentation
   - Established project roadmap
   - Documented technology stack
   - Created development guidelines
   - Added cache management documentation

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
1. Testing & Validation
   - Validate system prompt effectiveness
   - Test knowledge consolidation workflow
   - Verify note relationship functionality
   - Monitor cache performance metrics

2. Knowledge Management
   - Test memory retrieval accuracy
   - Validate context building
   - Verify pattern recognition
   - Test insight extraction

3. Performance Optimization
   - Monitor cache block usage
   - Track prompt selection metrics
   - Analyze tool usage patterns
   - Optimize conversation chunking

4. Infrastructure
   - Enhance error handling
   - Improve monitoring systems
   - Expand test coverage

*Note: This document will be updated as the codebase evolves and new components are added.*
