import { z } from "zod"
import { BaseMetadataSchema, LinkSchema, VersionSchema } from "../core/schemas.js"

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
