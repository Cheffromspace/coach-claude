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
