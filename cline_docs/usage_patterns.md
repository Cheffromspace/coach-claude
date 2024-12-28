# Obsidian Server Usage Patterns

## Common Operations

### Creating Daily Logs
```typescript
// Create a daily log with basic information
{
  mood: 4,
  energy: 3,
  sessionType: "deep_dive",
  progressRating: 4,
  summary: "Key points from today's session",
  focusAreas: ["development", "documentation"]
}

// With metadata for pattern tracking
{
  mood: 4,
  energy: 3,
  sessionType: "deep_dive",
  progressRating: 4,
  summary: "Session focusing on pattern recognition",
  focusAreas: ["pattern_analysis"],
  metadata: {
    effectiveness: 4,
    trainingCategory: "pattern",
    privacyLevel: "private",
    qualityMarkers: ["in_progress"],
    patterns: ["behavior:problem_solving", "tool:documentation"]
  }
}
```

### Working with Insights
```typescript
// Basic insight creation
{
  title: "Effective Problem-Solving Pattern",
  description: "Identified a recurring pattern in problem-solving approach",
  status: "active",
  impactLevel: "high"
}

// Insight with relationships and metadata
{
  title: "Code Review Best Practices",
  description: "Systematic approach to reviewing and improving code",
  status: "active",
  impactLevel: "high",
  relatedTo: ["daily_logs/2024-03-19", "insights/problem-solving"],
  metadata: {
    effectiveness: 5,
    trainingCategory: "technique",
    privacyLevel: "public",
    patterns: ["behavior:code_review", "tool:static_analysis"]
  }
}
```

### Querying Notes
```typescript
// Search for notes containing specific text
{
  pattern: "problem[-\\s]solving",
  caseSensitive: false
}

// Query notes by type and metadata
{
  from: "insights",
  where: {
    "metadata.trainingCategory": "pattern",
    "metadata.effectiveness": { "$gte": 4 }
  },
  fields: ["title", "metadata"],
  format: "table"
}
```

## Error Handling

### Common Errors and Solutions

1. Invalid Path
```typescript
// Error: Invalid path contains parent directory traversal
path: "../outside/file.md"

// Solution: Use paths relative to vault root
path: "insights/file.md"
```

2. Invalid Metadata
```typescript
// Error: Invalid effectiveness rating
metadata: { effectiveness: 6 }

// Solution: Use rating 1-5
metadata: { effectiveness: 4 }
```

3. Missing Required Fields
```typescript
// Error: Missing required fields for daily log
{
  mood: 4,
  // missing sessionType and progressRating
}

// Solution: Include all required fields
{
  mood: 4,
  energy: 3,
  sessionType: "deep_dive",
  progressRating: 4,
  summary: "Session summary"
}
```

## Best Practices

1. Note Organization
   - Use consistent naming patterns for files
   - Place notes in appropriate directories (insights/, daily_logs/, etc.)
   - Use metadata to track relationships and patterns

2. Metadata Usage
   - Include metadata for pattern tracking when relevant
   - Use consistent pattern naming (e.g., "behavior:", "tool:")
   - Set appropriate privacy levels for sensitive information

3. Querying
   - Start with broad queries and narrow down
   - Use metadata fields for precise filtering
   - Include relevant fields in query results

4. Pattern Recognition
   - Use consistent pattern categories
   - Track effectiveness of identified patterns
   - Link related patterns across notes

## Workflow Examples

### Daily Progress Tracking
1. Create daily log
2. Add insights from the session
3. Update related notes
4. Query for patterns

### Pattern Analysis
1. Search for related notes
2. Create insight note
3. Link to supporting evidence
4. Update pattern metadata

### Knowledge Consolidation
1. Query notes by pattern
2. Create consolidated note
3. Link related insights
4. Update metadata relationships

## Troubleshooting Tips

1. Note Creation Issues
   - Verify directory exists
   - Check file naming
   - Validate metadata format

2. Query Problems
   - Verify note type exists
   - Check field names
   - Validate query syntax

3. Pattern Detection
   - Ensure consistent pattern naming
   - Verify metadata structure
   - Check relationship links
