# Core Plugin for Obsidian MCP Server

A foundational plugin that provides essential note management and querying capabilities for the Obsidian MCP server.

## Features

### Note Management
- Create, read, update, and delete notes
- Support for YAML frontmatter metadata
- Automatic date prefixing for notes
- Directory creation and management

### Advanced Querying
- Full-text search with regex support
- Dataview-style querying
- Context-aware search results
- Customizable search parameters
- Tag-based filtering

### Tag System
- Hierarchical tag organization
- Tag relationship management
- Tag usage statistics
- Custom relationship types
- Strength-based relationships

### Vault Discovery
- Automatic metadata field detection
- Folder structure analysis
- File organization insights
- Frontmatter field mapping

## Tools

### Note Operations
- `create_note`: Create new notes with optional metadata and date prefixing
- `update_note`: Modify existing notes and their metadata
- `delete_note`: Remove notes from the vault
- `get_note`: Retrieve note content
- `list_notes`: List notes in folders with recursive option

### Search and Query
- `read_notes`: Read content from multiple notes
- `search_notes`: Search notes using regex with context
- `query_notes`: Execute Dataview-style queries
- `discover_vault`: Analyze vault structure and metadata

### Tag Management
- `set_tag_relationship`: Define relationships between tags
- `set_tag_hierarchy`: Establish tag hierarchies
- `get_tag_stats`: Generate tag usage statistics

## Usage Examples

### Creating a Note
```typescript
{
  folder: "projects",
  title: "Project X",
  content: "# Project X\n\nProject details...",
  metadata: {
    status: "active",
    tags: ["work", "planning"]
  },
  useDate: true
}
```

### Searching Notes
```typescript
{
  pattern: "TODO|FIXME",
  caseSensitive: false,
  maxMatchesPerFile: 5,
  contextLines: 2
}
```

### Setting Tag Relationships
```typescript
{
  tag: "productivity",
  relatedTag: "efficiency",
  type: "similar",
  strength: 4
}
```

## License

Copyright (c) 2024 Jonathan

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
