import { z } from "zod"

// Metadata schema
export const MetadataSchema = z.object({
  effectiveness: z.number().min(1).max(5).optional(),
  privacyLevel: z.enum(['public', 'private', 'sensitive']).optional(),
  trainingCategory: z.enum(['technique', 'insight', 'pattern', 'strategy']).optional(),
  qualityMarkers: z.array(z.string()).optional(),
  clusters: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
  relationships: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional()
})

// Reflection schema
export const CreateReflectionSchema = z.object({
  title: z.string(),
  period: z.string(),
  focus_areas: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'completed', 'archived']).default('active'),
  progress_rating: z.number().min(1).max(5),
  metadata: MetadataSchema.optional(),
  key_observations: z.array(z.string()).optional(),
  progress_analysis: z.array(z.string()).optional(),
  challenges: z.array(z.string()).optional(),
  insights: z.array(z.string()).optional(),
  behavioral_patterns: z.array(z.string()).optional(),
  tool_usage_patterns: z.array(z.string()).optional(),
  success_patterns: z.array(z.string()).optional(),
  growth_trajectory: z.array(z.string()).optional(),
  strategy_evolution: z.array(z.string()).optional(),
  action_items: z.array(z.string()).optional(),
  supporting_evidence: z.array(z.string()).optional(),
  connected_insights: z.array(z.string()).optional(),
  similar_patterns: z.array(z.string()).optional(),
  references: z.array(z.string()).optional()
})

// Daily log schema
export const CreateDailyLogSchema = z.object({
  mood: z.number().min(1).max(5),
  energy: z.number().min(1).max(5),
  focus_areas: z.array(z.string()).optional(),
  session_type: z.enum(["checkin", "deep_dive", "followup"]),
  progress_rating: z.number().min(1).max(5),
  metadata: z.object({
    effectiveness: z.number().min(1).max(5),
    trainingCategory: z.enum(['technique', 'insight', 'pattern', 'strategy']),
    privacyLevel: z.enum(['public', 'private', 'sensitive']),
    qualityMarkers: z.array(z.string()).optional(),
    clusters: z.array(z.string()).optional(),
    patterns: z.array(z.string()).optional(),
    relationships: z.array(z.string()).optional()
  }),
  summary: z.string(),
  keyTopics: z.array(z.string()).optional(),
  progressUpdates: z.array(z.string()).optional(),
  insights: z.array(z.string()).optional(),
  actionItems: z.array(z.string()).optional(),
  followupPoints: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
  relatedNotes: z.array(z.string()).optional()
})

// Insight schema
export const CreateInsightSchema = z.object({
  title: z.string(),
  related_to: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'archived']).default('active'),
  impact_level: z.enum(['low', 'medium', 'high']).default('medium'),
  metadata: z.object({
    effectiveness: z.number().min(1).max(5),
    trainingCategory: z.enum(['technique', 'insight', 'pattern', 'strategy']),
    privacyLevel: z.enum(['public', 'private', 'sensitive']),
    qualityMarkers: z.array(z.string()).optional(),
    clusters: z.array(z.string()).optional(),
    patterns: z.array(z.string()).optional(),
    relationships: z.array(z.string()).optional()
  }),
  description: z.string(),
  context: z.string().optional(),
  impact: z.array(z.string()).optional(),
  action_items: z.array(z.string()).optional(),
  related_insights: z.array(z.string()).optional(),
  pattern_recognition: z.array(z.string()).optional(),
  evidence_examples: z.array(z.string()).optional(),
  references: z.array(z.string()).optional()
})

// Goal schema
export const GoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['outcome', 'process', 'identity']),
  status: z.enum(['active', 'completed', 'abandoned']).default('active'),
  targetDate: z.string().optional(),
  metrics: z.array(z.string()),
  relatedHabits: z.array(z.string()).optional(),
  progress: z.array(z.object({
    date: z.string(),
    value: z.number(),
    notes: z.string().optional()
  })).optional(),
  reflection: z.array(z.object({
    date: z.string(),
    content: z.string(),
    insights: z.array(z.string()).optional()
  })).optional(),
  identity: z.string().optional(),
  metadata: z.object({
    created: z.string(),
    modified: z.string(),
    effectiveness: z.number().min(1).max(5),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    tags: z.array(z.string()).optional(),
    privacyLevel: z.enum(['public', 'private', 'sensitive']),
    relationships: z.array(z.string()).optional()
  })
})

// Habit schema
export const HabitSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['build', 'break']),
  cue: z.string(),
  craving: z.string(),
  response: z.string(),
  reward: z.string(),
  implementation: z.object({
    frequency: z.enum(['daily', 'weekly', 'custom']),
    timeOfDay: z.string().optional(),
    location: z.string().optional(),
    duration: z.string().optional()
  }),
  tracking: z.object({
    streaks: z.object({
      current: z.number(),
      longest: z.number(),
      history: z.array(z.object({
        start: z.string(),
        end: z.string().optional()
      }))
    }),
    completion_history: z.array(z.object({
      date: z.string(),
      completed: z.boolean(),
      notes: z.string().optional()
    })),
    obstacles: z.array(z.object({
      date: z.string(),
      description: z.string(),
      solution: z.string().optional()
    })).optional(),
    adaptations: z.array(z.object({
      date: z.string(),
      change: z.string(),
      reason: z.string(),
      outcome: z.string().optional()
    })).optional()
  }),
  stacking: z.object({
    after: z.array(z.string()).optional(),
    before: z.array(z.string()).optional()
  }).optional(),
  metrics: z.array(z.object({
    name: z.string(),
    target: z.string(),
    current: z.string().optional()
  })).optional(),
  metadata: z.object({
    created: z.string(),
    modified: z.string(),
    effectiveness: z.number().min(1).max(5),
    difficulty: z.number().min(1).max(5),
    tags: z.array(z.string()).optional(),
    privacyLevel: z.enum(['public', 'private', 'sensitive']),
    relationships: z.array(z.string()).optional()
  })
})

// Create schemas that extend the base schemas with required fields for creation
export const CreateGoalSchema = GoalSchema.omit({ 
  id: true,
  metadata: true 
}).extend({
  metadata: MetadataSchema.extend({
    created: z.string(),
    modified: z.string(),
    priority: z.enum(['low', 'medium', 'high']).default('medium')
  }).optional()
})

export const CreateHabitSchema = HabitSchema.omit({ 
  id: true,
  metadata: true,
  tracking: true 
}).extend({
  metadata: MetadataSchema.extend({
    created: z.string(),
    modified: z.string(),
    difficulty: z.number().min(1).max(5)
  }).optional(),
  tracking: z.object({
    streaks: z.object({
      current: z.number().default(0),
      longest: z.number().default(0),
      history: z.array(z.object({
        start: z.string(),
        end: z.string().optional()
      })).default([])
    }).optional(),
    completion_history: z.array(z.object({
      date: z.string(),
      completed: z.boolean(),
      notes: z.string().optional()
    })).default([]),
    obstacles: z.array(z.object({
      date: z.string(),
      description: z.string(),
      solution: z.string().optional()
    })).optional(),
    adaptations: z.array(z.object({
      date: z.string(),
      change: z.string(),
      reason: z.string(),
      outcome: z.string().optional()
    })).optional()
  }).optional()
})

// Metric note schema
export const MetricNoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  numericValue: z.number(),
  unit: z.string(),
  textValue: z.string().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.object({
    created: z.string(),
    modified: z.string(),
    privacyLevel: z.enum(['public', 'private', 'sensitive']),
    effectiveness: z.number().min(1).max(5).optional(),
    relationships: z.array(z.string()).optional()
  })
})

// Create metric note schema that omits auto-generated fields
export const CreateMetricNoteSchema = MetricNoteSchema.omit({ 
  id: true,
  metadata: true 
}).extend({
  metadata: MetadataSchema.optional()
})

// Utility schemas
export const ReadNotesArgsSchema = z.object({
  paths: z.array(z.string())
})

export const QueryNotesArgsSchema = z.object({
  query: z.string()
})
