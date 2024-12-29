import { z } from "zod"

// Base metadata schema used across all note types
export const BaseMetadataSchema = z.object({
  created: z.string(),
  modified: z.string(),
  version: z.number().default(1),
  privacyLevel: z.enum(['public', 'private', 'sensitive']),
  tags: z.array(z.string()).default([])
})

// Link schema for tracking relationships between notes
export const LinkSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum(['reference', 'parent', 'child', 'related', 'sequence', 'custom']),
  label: z.string().optional(),
  metadata: z.object({
    created: z.string(),
    strength: z.number().min(1).max(5).optional(),
    notes: z.string().optional(),
    valid: z.boolean().default(true)
  })
})

// Version control schema
export const VersionSchema = z.object({
  version: z.number(),
  timestamp: z.string(),
  author: z.string(),
  changes: z.array(z.object({
    field: z.string(),
    previous: z.unknown(),
    current: z.unknown()
  })),
  message: z.string().optional()
})

// Tag operation schemas with enhanced relationship support
export const TagQuerySchema = z.object({
  tags: z.array(z.string()),
  operator: z.enum(['AND', 'OR']).default('AND'),
  includeChildren: z.boolean().default(false),
  caseSensitive: z.boolean().default(false)
})

export const TagHierarchySchema = z.object({
  tag: z.string(),
  parent: z.string().optional(),
  children: z.array(z.string()).default([]),
  relationships: z.array(z.object({
    relatedTag: z.string(),
    type: z.enum(['similar', 'opposite', 'broader', 'narrower', 'custom']),
    strength: z.number().min(1).max(5).optional()
  })).default([])
})

// Journal entry schema - flexible format for any type of note
export const CreateJournalSchema = z.object({
  title: z.string(),
  date: z.string(),
  content: z.string(),
  type: z.enum(['reflection', 'health', 'activity', 'misc']).default('misc'),
  mood: z.number().min(1).max(5).optional(),
  energy: z.number().min(1).max(5).optional(),
  metrics: z.array(z.object({
    name: z.string(),
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional()
  })).default([]),
  links: z.array(LinkSchema).default([]),
  metadata: BaseMetadataSchema,
  versions: z.array(VersionSchema).default([])
})

// Health metric schema - structured format for tracking specific metrics
export const CreateHealthMetricSchema = z.object({
  title: z.string(),
  date: z.string(),
  type: z.enum(['weight', 'blood_pressure', 'sleep', 'pain', 'medication', 'custom']),
  values: z.array(z.object({
    name: z.string(),
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional()
  })),
  note: z.string().optional(),
  links: z.array(LinkSchema).default([]),
  metadata: BaseMetadataSchema,
  versions: z.array(VersionSchema).default([])
})

// Habit schema - aligned with Atomic Habits principles
export const CreateHabitSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(['build', 'break']),
  // Atomic Habits components
  cue: z.string(),
  craving: z.string(),
  response: z.string(),
  reward: z.string(),
  implementation: z.object({
    frequency: z.enum(['daily', 'weekly', 'custom']),
    timeOfDay: z.string().optional(),
    duration: z.string().optional(),
    location: z.string().optional()
  }),
  tracking: z.object({
    streaks: z.object({
      current: z.number().default(0),
      longest: z.number().default(0)
    }),
    completion_history: z.array(z.object({
      date: z.string(),
      completed: z.boolean(),
      notes: z.string().optional()
    })).default([])
  }),
  links: z.array(LinkSchema).default([]),
  metadata: BaseMetadataSchema.extend({
    difficulty: z.number().min(1).max(5)
  }),
  versions: z.array(VersionSchema).default([])
})

// Goal schema
export const CreateGoalSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(['outcome', 'process', 'identity']),
  status: z.enum(['active', 'completed', 'abandoned']).default('active'),
  targetDate: z.string().optional(),
  metrics: z.array(z.object({
    name: z.string(),
    target: z.union([z.number(), z.string()]),
    unit: z.string().optional(),
    current: z.union([z.number(), z.string()]).optional()
  })),
  progress: z.array(z.object({
    date: z.string(),
    value: z.union([z.number(), z.string()]),
    notes: z.string().optional()
  })).default([]),
  links: z.array(LinkSchema).default([]),
  metadata: BaseMetadataSchema.extend({
    priority: z.enum(['low', 'medium', 'high']).default('medium')
  }),
  versions: z.array(VersionSchema).default([])
})

// Query schemas
export const ReadNotesArgsSchema = z.object({
  paths: z.array(z.string())
})

export const QueryNotesArgsSchema = z.object({
  query: z.string(),
  filters: z.object({
    tags: z.array(z.string()).optional(),
    type: z.string().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional(),
    linkType: z.string().optional()
  }).optional()
})
