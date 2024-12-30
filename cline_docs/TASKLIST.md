# Server Decoupling TASKLIST

## Phase 1: Core Infrastructure Setup

### 1. Directory Structure Creation
- [x] Create `/src/core` directory
  - Purpose: House base server functionality and plugin system
  - Contains: Base server, plugin manager, interfaces
  - Why: Separate core MCP protocol handling from plugin-specific code

- [x] Create `/src/shared` directory
  - Purpose: Common utilities and types used across all plugins
  - Contains: File operations, path handling, logging
  - Why: Avoid code duplication and maintain consistency

- [x] Create `/src/plugins` directory
  - Purpose: Container for all plugin implementations
  - Structure: Each plugin in its own subdirectory
  - Why: Clear separation of plugin code and dependencies

### 2. Core Interface Definition
- [x] Create `core/interfaces.ts`
  - Purpose: Define plugin system contracts
  - Contains: Plugin interface, lifecycle hooks, event system
  - Why: Establish clear boundaries between core and plugins

### 3. Plugin Manager Implementation
- [x] Create `core/plugin-manager.ts`
  - Purpose: Handle plugin lifecycle and registration
  - Features:
    - [x] Plugin loading/unloading
    - [x] Dependency resolution
    - [x] Event handling
    - [x] Error management
  - Why: Centralize plugin management and ensure proper isolation

### 4. Base Server Refactoring
- [x] Create `core/base-server.ts`
  - Purpose: Extract core MCP functionality
  - Features:
    - [x] MCP protocol handling
    - [x] Plugin system integration
    - [x] Server lifecycle management
  - Why: Separate protocol handling from business logic

## Phase 2: Plugin Migration

### 1. Core Plugin
- [x] Create `/src/plugins/core/index.ts`
  - Purpose: Basic Obsidian functionality
  - Components migrated:
    - [x] Note CRUD operations
    - [x] File system management
    - [x] Metadata handling
  - Why: Establish foundation for vault operations

### 2. Coaching Plugin
- [x] Create `/src/plugins/coaching/index.ts`
  - Purpose: Goal and habit tracking
  - Components migrated:
    - [x] Goal creation/management
    - [x] Habit tracking
    - [x] Progress monitoring
  - Why: Isolate coaching-specific features

### 3. Health Plugin
- [ ] Create `/src/plugins/health/index.ts`
  - Purpose: Health metrics and tracking
  - Components to migrate:
    - [ ] Health metric creation
    - [ ] Tracking functionality
    - [ ] Data visualization
  - Why: Separate health-related features

## Phase 3: Shared Infrastructure

### 1. Utility Functions
- [ ] Create `shared/utils.ts`
  - Purpose: Common functionality
  - Components:
    - [ ] File operations
    - [ ] Path normalization
    - [ ] Type checking
  - Why: Centralize commonly used functions

### 2. Type Definitions
- [ ] Create `shared/types.ts`
  - Purpose: Shared type definitions
  - Components:
    - [ ] Note types
    - [ ] Tool responses
    - [ ] Common interfaces
  - Why: Maintain type consistency across plugins

## Phase 4: Integration and Testing

### 1. Plugin Loading
- [ ] Update `src/index.ts`
  - Purpose: Initialize plugin system
  - Tasks:
    - [ ] Configure plugin manager
    - [ ] Load core plugins
    - [ ] Handle startup sequence
  - Why: Ensure proper system initialization

### 2. Testing Infrastructure
- [ ] Create test structure for plugins
  - Purpose: Validate plugin functionality
  - Components:
    - [ ] Core plugin tests
    - [ ] Coaching plugin tests
    - [ ] Health plugin tests
  - Why: Ensure reliability and isolation

## Phase 5: Documentation

### 1. Plugin Development Guide
- [ ] Create plugin documentation
  - Purpose: Guide for plugin creation
  - Components:
    - [ ] API reference
    - [ ] Best practices
    - [ ] Example implementations
  - Why: Enable future plugin development

### 2. Migration Guide
- [ ] Document migration process
  - Purpose: Help transition existing code
  - Components:
    - [ ] Step-by-step guide
    - [ ] Common patterns
    - [ ] Troubleshooting
  - Why: Facilitate smooth transitions

## Success Criteria
1. All plugins function independently
2. Core server handles plugin lifecycle
3. No cross-plugin dependencies
4. Clean separation of concerns
5. Comprehensive test coverage
6. Clear documentation

## Notes
- Each step builds on previous work
- Focus on maintaining functionality while refactoring
- Test thoroughly after each migration
- Document changes as they occur
- Consider backward compatibility
