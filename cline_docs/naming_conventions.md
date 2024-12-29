# Naming Conventions

## General Principles
- Use snake_case as the default naming convention across the codebase
- Be descriptive but concise
- Prioritize clarity and readability over brevity
- Be consistent within each context

## Files and Directories
- Use snake_case for all file and directory names
- Add appropriate extensions: `.py`, `.ts`, `.md`, etc.
- Test files should end with `_test` or `test_`
- Type definition files should end with `.types`
Examples:
```
message_processor.py
note_handlers.ts
daily_log.md
cache_manager_test.py
test_system_prompts.py
schema.types.ts
```

## Classes and Interfaces
- Use PascalCase for classes and interfaces
- Classes should be nouns
- Interfaces in TypeScript should start with 'I'
Examples:
```python
class MessageProcessor:
class CacheManager:
```
```typescript
interface INote:
interface ISearchResult:
```

## Functions and Methods
- Use snake_case for functions and methods
- Start with verbs for actions
- Be descriptive about the operation
Examples:
```python
def process_message():
def create_daily_log():
def get_cache_statistics():
```
```typescript
function create_note():
function search_by_pattern():
function update_metadata():
```

## Variables and Constants
- Use snake_case for variables
- Use SCREAMING_SNAKE_CASE for constants and environment variables
- Be descriptive about the content
Examples:
```python
message_count = 0
current_session = None
MAX_CACHE_SIZE = 1000
DEFAULT_CHUNK_SIZE = 2000
```
```typescript
note_content = ''
search_results = []
MAX_SEARCH_RESULTS = 100
```

## Type Definitions (TypeScript)
- Use PascalCase for type names
- Use descriptive names that indicate the type's purpose
Examples:
```typescript
type NoteMetadata = {
  created_at: string;
  updated_at: string;
  tags: string[];
}

type SearchOptions = {
  query: string;
  max_results: number;
  include_archived: boolean;
}
```

## Component-Specific Conventions

### MCP Tools and Resources
- Use snake_case for tool and resource names
- Be descriptive about the functionality
Examples:
```typescript
create_note
search_notes
list_templates
add_tags
```

### Cache Keys
- Use snake_case with colons as separators for hierarchical keys
Examples:
```
session:12345:messages
cache:system_prompts:default
```

### Configuration Keys
- Use snake_case for configuration keys
- Group related settings with dots
Examples:
```json
{
  "cache.max_size": 1000,
  "server.host": "localhost",
  "logging.level": "info"
}
```

## ESLint Configuration
```json
{
  "rules": {
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "default",
        "format": ["snake_case"]
      },
      {
        "selector": "typeLike",
        "format": ["PascalCase"]
      },
      {
        "selector": "interface",
        "format": ["PascalCase"],
        "prefix": ["I"]
      },
      {
        "selector": "variable",
        "format": ["snake_case"]
      },
      {
        "selector": "variable",
        "modifiers": ["const", "global"],
        "format": ["UPPER_CASE"]
      }
    ]
  }
}
```

## Implementation Strategy
1. Apply these conventions to new code immediately
2. Gradually refactor existing code to match these conventions
3. Use ESLint to enforce conventions automatically
4. Document any exceptions or special cases as they arise

## Exceptions
- Keep external library/framework conventions when directly interfacing with them
- Document any necessary deviations from these conventions
- Maintain consistency within specific contexts even if they differ from the global conventions

*Note: These conventions may be updated as the project evolves and new patterns emerge.*
