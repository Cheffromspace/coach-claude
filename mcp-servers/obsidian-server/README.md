# obsidian-server MCP Server

A Model Context Protocol server

This is a TypeScript-based MCP server that implements a simple notes system. It demonstrates core MCP concepts by providing:

- Resources representing text notes with URIs and metadata
- Tools for creating new notes
- Prompts for generating summaries of notes

## Features

### Resources
- List and access notes via `note://` URIs
- Each note has a title, content and metadata
- Plain text mime type for simple content access

### Tools

#### Note Management
- `create_journal` - Create a new journal entry
- `read_notes` - Read notes from the vault
- `search_notes` - Search notes using patterns
- `query_notes` - Advanced note querying
- `discover_vault` - Explore vault structure

#### Goal and Habit Tracking
- `create_goal` - Create a new goal
- `create_habit` - Create a new habit
- `update_goal_status` - Update goal progress
- `update_habit_tracking` - Track habit completion
- `create_health_metric` - Create health-related metrics

### Naming Conventions

This server follows specific naming conventions to maintain consistency with MCP standards:

- Tool method names use snake_case (e.g., `create_journal`, `read_notes`)
- Internal TypeScript code follows standard TypeScript conventions (camelCase for methods, PascalCase for classes)

### Breaking Changes

#### Version 1.0.0
- **Method Naming Convention Change**: All tool method names have been updated to use snake_case instead of camelCase
  - Example: `createJournal` → `create_journal`
  - This change affects all tool method calls
  - Update any custom integrations to use the new snake_case method names

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "obsidian-server": {
      "command": "/path/to/obsidian-server/build/index.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
