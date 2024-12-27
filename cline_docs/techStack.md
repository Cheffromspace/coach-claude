# Technology Stack

## Core Technologies

### Programming Language
- Python
  - Primary development language
  - Strong ecosystem for data processing and analysis
  - Excellent integration capabilities
  - Rich library support for planned features

### Knowledge Management
- Obsidian
  - Markdown-based note-taking system
  - Local-first approach aligning with privacy principles
  - Powerful linking and organization capabilities
  - Extensible through plugins
  - Custom vault structure support

### Model Context Protocol (MCP)
- Custom Python-based MCP client implementation
  - Server management system
  - Configuration handling
  - Message processing pipeline
  - Query processing system
  - Tool orchestration capabilities

### MCP Servers
- **Obsidian Server**
  - Direct integration with Obsidian vault
  - Note reading and writing capabilities
  - Support for Obsidian-specific features (backlinks, templates)
  - Vault: C:/Users/Jonathan/Documents/coach-claude

- **Filesystem Server**
  - Local file system operations
  - Directory and file management
  - Root: C:/Users/Jonathan

- **GitHub Server**
  - GitHub repository integration
  - API access with authentication
  - Repository operations and management

- **Fetch Server**
  - Web content retrieval
  - URL fetching and content extraction
  - Support for various content types

- **Brave Search Server**
  - Web search capabilities
  - API-based search operations
  - Result filtering and processing

- **Weather Server**
  - Weather data retrieval
  - Forecast information
  - Weather-related operations

## Project Components

### Caching System
- **Conversation Caching**
  - Chunked conversation management:
    * 5 messages or 2000 tokens per chunk
    * Individual cache blocks per chunk
    * Automatic chunk size optimization
    * Dynamic chunk allocation
  - Cache block management:
    * Active block tracking
    * Automatic cleanup on session load
    * Block creation monitoring
    * Usage statistics tracking

- **Prompt Caching**
  - Ephemeral caching with 5-minute TTL
  - System prompt caching
  - Documentation caching
  - Performance tracking
  - Token usage analytics

- **Cache Control**
  - Automatic caching for large content (>1024 chars)
  - Selective caching for static content
  - Cache hit tracking
  - Token savings calculation
  - Cache effectiveness metrics
  - Block-level statistics:
    * Active/cleaned blocks
    * Block creation rates
    * Block lifetime tracking
    * Memory usage patterns

### MCP Client (`mcp_client/`)
- **Configuration Management** (`config/`)
  - JSON-based configuration system
  - Environment variable support
  - Flexible server configuration

- **Server Management** (`server/`)
  - MCP server lifecycle management
  - Connection handling
  - Error recovery
  - Resource management
  - Windows networking optimization:
    * Winsock initialization and cleanup
    * DNS resolution configuration
    * Network stack management
    * Process networking setup
  - Process management:
    * Health check system
    * Detailed monitoring
    * Graceful cleanup
    * Comprehensive logging

- **Processing Pipeline** (`processing/`)
  - Message processor
  - Query processor
  - Extensible processing system

- **Utilities** (`utils/`)
  - Logging configuration
  - Helper functions
  - Common utilities

### Chat Interface (`mcp_chat/`)
- User interaction layer
- Message handling
- Response formatting
- Session management
- Cache performance monitoring
- Documentation caching commands
- Enhanced cache statistics reporting

## Development Tools

### Package Management
- UV for dependency management
  - Fast, reliable Python package installation
  - Lock file support
  - Deterministic builds

### Project Configuration
- pyproject.toml
  - Modern Python project configuration
  - Dependency specification
  - Build system configuration

### Version Control
- Git
  - Source code management
  - Change tracking
  - Collaboration support

## Planned Integrations

### Health Data
- Samsung Health API (planned)
  - Activity tracking
  - Health metrics
  - Sleep data
  - Wellness indicators

### Knowledge Processing
- Natural Language Processing
  - Pattern recognition
  - Insight extraction
  - Text analysis
  - Semantic understanding

## Architecture Decisions

### Why Chunked Caching?
1. Performance
   - Prevents cache block exhaustion
   - Optimizes memory usage
   - Enables efficient cleanup
   - Reduces context loss risk

2. Efficiency
   - Granular cache control
   - Optimized chunk sizes
   - Automatic resource management
   - Improved memory utilization

3. Reliability
   - Automatic cleanup mechanisms
   - Session-level cache management
   - Block tracking and monitoring
   - Performance statistics

### Why Caching?
1. Performance
   - Reduced token processing
   - Faster response times
   - Lower API costs
   - Optimized memory usage

2. Efficiency
   - Reuse of static content
   - Optimized conversation history
   - Smart documentation handling
   - Granular cache control

3. Analytics
   - Cache performance tracking
   - Token usage monitoring
   - Cost optimization insights
   - Block-level statistics

### Why Python?
1. Rapid Development
   - Quick prototyping capabilities
   - Rich ecosystem
   - Extensive library support

2. Data Processing
   - Strong data analysis libraries
   - Machine learning capabilities
   - Text processing tools

3. Integration Support
   - API connectivity
   - File system operations
   - Process management

### Why Obsidian?
1. Privacy-First
   - Local file storage
   - User-controlled data
   - No cloud dependency

2. Flexibility
   - Custom vault structure
   - Markdown-based
   - Extensible system

3. Knowledge Graph
   - Bidirectional linking
   - Relationship visualization
   - Emergent structure

### Why Custom MCP Client?
1. Control
   - Custom implementation
   - Specific feature support
   - Integration flexibility

2. Extensibility
   - Custom tool support
   - Resource management
   - Processing pipeline control

3. Privacy
   - Local processing
   - Data control
   - Security management

## Future Considerations
- Local model integration possibilities
- Additional data source integrations
- Enhanced pattern recognition systems
- Advanced visualization tools
- Specialized processing pipelines
- Advanced cache optimization strategies:
  * Predictive chunk sizing
  * Dynamic TTL adjustment
  * Context-aware caching
  * Memory usage optimization

*Note: This document will be updated as technology choices evolve and new components are added to the system.*
