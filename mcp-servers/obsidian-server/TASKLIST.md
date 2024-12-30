# Server Migration Tasks

## Core Plugin Migration
- [x] Move search-related tools to core plugin
  - [x] read_notes
  - [x] search_notes
  - [x] query_notes
  - [x] discover_vault
- [x] Move schemas to respective plugins
  - [x] Core schemas to core/schemas.ts
  - [x] Coaching schemas to coaching/schemas.ts
- [x] Move query-engine.ts to core plugin
- [x] Move tag functionality to core plugin
  - [x] Move tag-manager.ts to core/tag-manager.ts
  - [x] Move tag-handlers.ts to core/tag-handlers.ts
  - [x] Update imports in core plugin
  - [x] Add tag tools to core plugin's getTools()
  - [x] Add tag tool handlers to core plugin's handleToolCall()

## Coaching Plugin Migration
- [x] Move coaching tools to coaching plugin
  - [x] create_goal
  - [x] create_habit
  - [x] update_goal_status
  - [x] update_habit_tracking
  - [x] create_health_metric
  - [x] create_journal
- [x] Create note-handlers.ts in coaching plugin
- [x] Update coaching plugin to use note handlers

## Cleanup
- [x] Remove tool-handlers.ts
- [x] Remove tool-definitions.ts
- [x] Remove schemas.ts
- [x] Remove query-engine.ts
- [x] Remove handlers/note-handlers.ts
- [x] Remove handlers/search-handlers.ts
- [x] Remove handlers/tag-handlers.ts
- [x] Remove handlers directory if empty
- [x] Remove tag-manager.ts from root

## Testing
- [ ] Test core plugin in isolation
  - [ ] Test search functionality
  - [ ] Test tag functionality
  - [ ] Test vault discovery
- [ ] Test coaching plugin with core dependency
  - [ ] Test goal creation and updates
  - [ ] Test habit creation and tracking
  - [ ] Test journal entries
  - [ ] Test health metrics
- [ ] Verify ENABLED_PLUGINS behavior
  - [ ] Test with only core enabled
  - [ ] Test with both plugins enabled
  - [ ] Test with invalid configurations

## Documentation
- [ ] Update plugin development guide
  - [ ] Document plugin system architecture
  - [ ] Add migration patterns section
  - [ ] Include configuration examples
- [ ] Add core plugin documentation
  - [ ] Document search capabilities
  - [ ] Document tag management
  - [ ] Document vault discovery
- [ ] Add coaching plugin documentation
  - [ ] Document goal management
  - [ ] Document habit tracking
  - [ ] Document journal entries
  - [ ] Document health metrics

## Final Steps
- [ ] Run full test suite
- [ ] Update README with plugin system changes
- [ ] Tag release with plugin system support
