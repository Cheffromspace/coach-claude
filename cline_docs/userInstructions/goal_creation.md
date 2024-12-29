# Goal Creation Guide

## Overview
The create_goal tool helps create structured goal entries in your Obsidian vault. This guide provides detailed information about required fields and usage patterns.

## Schema Structure

### Required Fields
```typescript
{
  title: string,              // Goal title
  description: string,        // Detailed description
  type: "outcome" | "process" | "identity",  // Goal type
  metrics: [{                 // At least one metric required
    name: string,            // Metric name
    target: number|string,   // Target value
    unit?: string,           // Optional unit
    current?: number|string  // Optional current value
  }],
  metadata: {                // Required metadata
    created: string,         // ISO timestamp
    modified: string,        // ISO timestamp
    priority: "low" | "medium" | "high",
    tags: string[],
    privacyLevel: "public" | "private" | "sensitive"
  }
}
```

### Optional Fields
```typescript
{
  targetDate?: string,        // Target completion date
  progress?: [{              // Progress tracking
    date: string,
    value: number|string,
    notes?: string
  }],
  links?: [{                 // Related note links
    source: string,
    target: string,
    type: string,
    label?: string
  }],
  versions?: [{             // Version history
    version: number,
    timestamp: string,
    author: string,
    changes: [{
      field: string,
      previous: any,
      current: any
    }],
    message?: string
  }]
}
```

## Example Usage

```typescript
{
  "title": "Learn TypeScript",
  "description": "Master TypeScript for better code quality",
  "type": "outcome",
  "metrics": [{
    "name": "projects_completed",
    "target": 5,
    "unit": "projects"
  }],
  "metadata": {
    "created": "2024-12-29T12:00:00Z",
    "modified": "2024-12-29T12:00:00Z",
    "priority": "high",
    "tags": ["programming", "skills"],
    "privacyLevel": "public"
  }
}
```

## Notes
- Timestamps must be in ISO format (YYYY-MM-DDTHH:mm:ssZ)
- At least one metric is required
- All metadata fields are required
- The tool will create a structured note in your goals folder
- Progress can be updated later using update_goal_status tool

## Common Issues
1. Missing Required Fields
   - Ensure all required metadata fields are provided
   - Include at least one metric
   - Use proper timestamp format

2. Invalid Enums
   - type must be: "outcome", "process", or "identity"
   - priority must be: "low", "medium", or "high"
   - privacyLevel must be: "public", "private", or "sensitive"

## Best Practices
1. Use descriptive titles
2. Include measurable metrics
3. Set realistic target dates
4. Add relevant tags for organization
5. Choose appropriate privacy levels
