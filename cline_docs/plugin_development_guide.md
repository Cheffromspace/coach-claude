# Plugin Development Guide

## Overview
This guide provides comprehensive documentation for developing plugins for the Obsidian MCP server. It covers essential concepts, best practices, and practical examples to help developers create robust and maintainable plugins.

## Table of Contents
1. [Plugin System Architecture](#plugin-system-architecture)
2. [API Reference](#api-reference)
3. [Best Practices](#best-practices)
4. [Example Implementations](#example-implementations)
5. [Migration Patterns](#migration-patterns)

## Plugin System Architecture

### Core Concepts
- Plugins are self-contained modules that extend server functionality
- Each plugin implements the `MCPPlugin` interface
- Plugins can provide tools, resources, and event handlers
- Plugin lifecycle is managed by the Plugin Manager

### Plugin Lifecycle
1. Registration
2. Initialization
3. Active operation
4. Deactivation
5. Cleanup

## API Reference

### MCPPlugin Interface
```typescript
interface MCPPlugin {
  // Required properties
  name: string;
  version: string;
  description?: string;

  // Lifecycle methods
  onLoad(): Promise<void>;
  onUnload(): Promise<void>;

  // Tool/Resource registration
  getTools(): ToolDefinition[];
  getResources?(): ResourceDefinition[];

  // Optional hooks
  onServerStart?(): Promise<void>;
  onServerStop?(): Promise<void>;
  onError?(error: Error): void;
}
```

### Tool Definition
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: ToolHandler;
}

type ToolHandler = (
  args: any,
  context: ToolContext
) => Promise<ToolResponse>;
```

### Resource Definition
```typescript
interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: ResourceHandler;
}

type ResourceHandler = (
  context: ResourceContext
) => Promise<ResourceResponse>;
```

### Plugin Context
```typescript
interface PluginContext {
  vault: VaultAPI;
  server: ServerAPI;
  logger: LoggerAPI;
  config: ConfigAPI;
}
```

### Event System
```typescript
interface EventEmitter {
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  emit(event: string, data: any): void;
}
```

## Best Practices

### 1. Plugin Structure
- Organize code into logical modules
- Keep plugin scope focused
- Use TypeScript for type safety
- Follow consistent naming conventions

```typescript
// Example plugin structure
src/
  ├── index.ts           // Plugin entry point
  ├── types.ts           // Type definitions
  ├── tools/             // Tool implementations
  ├── resources/         // Resource implementations
  ├── utils/             // Helper functions
  └── config.ts          // Plugin configuration
```

### 2. Error Handling
- Implement comprehensive error handling
- Use custom error types
- Provide meaningful error messages
- Handle async errors properly

```typescript
class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

async function handleOperation() {
  try {
    await riskyOperation();
  } catch (error) {
    throw new PluginError(
      'Operation failed',
      'OPERATION_ERROR',
      { originalError: error }
    );
  }
}
```

### 3. Resource Management
- Clean up resources in onUnload
- Use proper disposal patterns
- Implement timeout mechanisms
- Handle resource limits

```typescript
class ExamplePlugin implements MCPPlugin {
  private resources: Resource[] = [];

  async onLoad() {
    this.resources.push(await createResource());
  }

  async onUnload() {
    await Promise.all(
      this.resources.map(r => r.dispose())
    );
    this.resources = [];
  }
}
```

### 4. Configuration Management
- Use typed configuration
- Validate configuration
- Provide defaults
- Handle updates gracefully

```typescript
interface PluginConfig {
  enabled: boolean;
  timeout: number;
  features: string[];
}

class ConfigManager {
  private config: PluginConfig;

  constructor(initialConfig: Partial<PluginConfig>) {
    this.config = this.validateConfig({
      enabled: true,
      timeout: 5000,
      features: [],
      ...initialConfig
    });
  }

  private validateConfig(config: PluginConfig): PluginConfig {
    // Validation logic
    return config;
  }
}
```

## Example Implementations

### 1. Basic Plugin Template
```typescript
import { MCPPlugin, ToolDefinition } from '../core/interfaces';

export class BasicPlugin implements MCPPlugin {
  name = 'basic-plugin';
  version = '1.0.0';
  description = 'Basic plugin template';

  async onLoad() {
    // Initialization logic
  }

  async onUnload() {
    // Cleanup logic
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'example-tool',
        description: 'Example tool implementation',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        handler: async (args, context) => {
          // Tool implementation
          return {
            content: [{
              type: 'text',
              text: `Processed: ${args.input}`
            }]
          };
        }
      }
    ];
  }
}
```

### 2. Feature Plugin Example
```typescript
import { MCPPlugin, ToolDefinition, ResourceDefinition } from '../core/interfaces';

export class FeaturePlugin implements MCPPlugin {
  name = 'feature-plugin';
  version = '1.0.0';
  
  private cleanup: (() => Promise<void>)[] = [];

  async onLoad() {
    const feature = await this.initializeFeature();
    this.cleanup.push(feature.dispose);
  }

  async onUnload() {
    await Promise.all(this.cleanup.map(fn => fn()));
  }

  getTools(): ToolDefinition[] {
    return [
      // Tool definitions
    ];
  }

  getResources(): ResourceDefinition[] {
    return [
      // Resource definitions
    ];
  }

  private async initializeFeature() {
    // Feature initialization
    return {
      dispose: async () => {
        // Cleanup logic
      }
    };
  }
}
```

## Migration Patterns

### 1. Feature Migration
When moving features from core to plugins:

```typescript
// 1. Identify the feature boundary
const featureCode = {
  // ... existing feature code
};

// 2. Create plugin structure
export class FeaturePlugin implements MCPPlugin {
  // ... plugin implementation
}

// 3. Adapt the feature
class AdaptedFeature {
  constructor(private context: PluginContext) {}
  
  // Adapt existing methods to plugin context
}

// 4. Register with plugin system
export function register(context: PluginContext) {
  return new FeaturePlugin(context);
}
```

### 2. Data Migration
When plugin changes affect data structure:

```typescript
interface MigrationManager {
  async migrate(fromVersion: string, toVersion: string): Promise<void>;
}

class DataMigration implements MigrationManager {
  private migrations: Record<string, Migration> = {
    '1.0.0': async () => {
      // Migration logic
    }
  };

  async migrate(fromVersion: string, toVersion: string) {
    // Execute appropriate migrations
  }
}
```

### 3. API Evolution
When changing plugin APIs:

```typescript
// 1. Mark old API as deprecated
/** @deprecated Use newMethod instead */
async oldMethod() {
  return this.newMethod();
}

// 2. Provide new API
async newMethod() {
  // New implementation
}

// 3. Support transition period
const DEPRECATION_VERSION = '2.0.0';
```

## Testing Guidelines

### 1. Unit Testing
```typescript
describe('ExamplePlugin', () => {
  let plugin: ExamplePlugin;

  beforeEach(() => {
    plugin = new ExamplePlugin();
  });

  it('should initialize correctly', async () => {
    await plugin.onLoad();
    expect(plugin.isLoaded).toBe(true);
  });
});
```

### 2. Integration Testing
```typescript
describe('Plugin Integration', () => {
  let server: TestServer;
  let plugin: ExamplePlugin;

  beforeAll(async () => {
    server = await TestServer.create();
    plugin = await server.loadPlugin(ExamplePlugin);
  });

  it('should interact with server', async () => {
    const result = await plugin.performOperation();
    expect(result).toBeDefined();
  });
});
```

## Performance Considerations

### 1. Resource Usage
- Monitor memory consumption
- Implement proper cleanup
- Use resource pooling
- Cache expensive operations

### 2. Async Operations
- Use proper async patterns
- Implement timeouts
- Handle cancellation
- Manage concurrency

### 3. Event Handling
- Use event debouncing
- Implement throttling
- Clean up listeners
- Monitor event loops

## Security Guidelines

### 1. Input Validation
- Validate all inputs
- Sanitize data
- Use type checking
- Implement bounds checking

### 2. Resource Access
- Implement proper permissions
- Use secure defaults
- Validate file access
- Monitor resource usage

### 3. Error Handling
- Hide sensitive information
- Log securely
- Handle failures gracefully
- Implement timeout policies

## Documentation Requirements

### 1. Plugin Documentation
- Clear description
- Installation guide
- Configuration options
- API reference
- Example usage

### 2. Code Documentation
- JSDoc comments
- Type definitions
- Usage examples
- Error scenarios

### 3. Changelog
- Version history
- Breaking changes
- Migration guides
- Deprecation notices

*Note: This guide will be updated as the plugin system evolves and new patterns emerge.*
