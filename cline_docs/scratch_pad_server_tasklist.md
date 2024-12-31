# Scratch Pad MCP Server Implementation Tasklist

The Goal of this task is to give Coach Claude a way to modify its own system prompt with personal profile data, recent developments, notes to self, etc. This would be a prompt appended to the system prompt array. The functionality will be exposed as a tool via MCP server.

## 1. Project Setup ✓
- [x] Create new TypeScript project in ~\source\coach-claude\mcp-servers\mcp-scratchpad
- [x] Initialize npm project and install dependencies
- [x] Configure TypeScript (tsconfig.json)
- [x] Set up build scripts in package.json

## 2. Core Server Implementation ✓
- [x] Set up file system utilities for scratch pad operations (file.ts)
- [x] Implement content validation (validation.ts)
- [x] Create base server class with MCP SDK
- [x] Implement error handling and logging
- [x] Add server lifecycle management (startup, shutdown)

## 3. Tool Implementation ✓
- [x] Implement update_scratch_pad tool
  - Input: content (string)
  - Functionality: Replace entire content
  - Return: Success confirmation

- [x] Implement get_scratch_pad tool
  - Input: none
  - Functionality: Retrieve current content
  - Return: Current scratch pad content

## 4. Resource Implementation ✓
- [x] Add scratch_pad://content resource
  - Direct access to current content
  - Read-only access
  - Auto-refresh on changes

## 5. Integration ✓
- [x] Add server configuration to MCP settings
  ```json
  {
    "mcpServers": {
      "scratch-pad": {
        "command": "node",
        "args": ["C:/Users/Jonathan/source/coach-claude/mcp-servers/mcp-scratchpad/build/index.js"]
      }
    }
  }
  ```
- [x] Update prompt manager to use new tools
- [x] Add error handling for server connection issues

## 6. Prompt System Integration ✓
- [x] Implement dynamic prompt loading in chat interface
- [x] Add scratchpad content to system prompts
- [x] Handle async initialization
- [x] Support session management (new/load)
- [x] Add error handling for prompt loading

## 7. Testing
- [ ] Unit tests for each tool
- [ ] Integration tests with prompt system
- [ ] Error handling tests
- [ ] File system operation tests
- [ ] Session management tests
- [ ] Dynamic prompt loading tests

## 8. Documentation ✓
- [x] Update codebaseSummary.md with scratchpad server
- [x] Update dynamic_prompts.md with new functionality
- [x] Document integration points
- [x] Add error handling guide
- [x] Include usage examples

## Next Steps
1. Implement comprehensive testing suite
2. Add automatic content summarization
3. Implement context age-out policies
4. Add integration with knowledge graph
5. Enhance error recovery mechanisms

## Implementation Details

### Tool Schemas
```typescript
// update_scratch_pad
{
  type: 'object',
  properties: {
    content: {
      type: 'string',
      description: 'New content to set'
    }
  },
  required: ['content']
}

// get_scratch_pad
{
  type: 'object',
  properties: {},
  required: []
}
```

### File Structure
```
scratch-pad-server/
├── src/
│   ├── index.ts           # Main server file (TODO)
│   ├── tools/             # Tool implementations
│   │   ├── update.ts      # TODO
│   │   └── get.ts         # TODO
│   ├── resources/         # Resource implementations
│   │   └── content.ts     # TODO
│   └── utils/            # Utility functions
│       ├── file.ts       # ✓ Completed
│       └── validation.ts # ✓ Completed
├── tests/                # Test files (TODO)
├── package.json          # ✓ Completed
└── tsconfig.json        # ✓ Completed
```

### Usage Example
```typescript
// In prompt_manager.py
async function updateContext(content: string) {
  await mcp.callTool('scratch-pad', 'update_scratch_pad', {
    content: content
  });
}

// In system prompt
const context = await mcp.getResource('scratch-pad', 'scratch_pad://content');
```

## Success Criteria
- [x] All tools functioning correctly
- [x] Seamless integration with prompt system
- [x] Proper error handling
- [x] Comprehensive documentation
- [ ] Full test coverage
- [ ] Performance optimization

*Note: This tasklist will be updated as implementation progresses and new requirements are identified.*
