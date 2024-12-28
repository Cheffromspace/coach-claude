import { z } from "zod"

// Full metadata schema for consolidation mode
const ConsolidationMetadataSchema = z.object({
  effectiveness: z.number().min(1).max(5).optional(),
  trainingCategory: z.enum(['technique', 'insight', 'pattern', 'strategy']).optional(),
  privacyLevel: z.enum(['public', 'private', 'sensitive']).optional(),
  qualityMarkers: z.array(z.enum(['verified', 'needs_review', 'consolidated', 'in_progress'])).optional(),
  clusters: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
  relationships: z.array(z.string()).optional()
})

// Simplified metadata schema for session mode
const SessionMetadataSchema = z.object({
  effectiveness: z.number().min(1).max(5).optional(),
  privacyLevel: z.enum(['public', 'private', 'sensitive']).optional()
})

// Session mode schemas
export const CreateDailyLogSessionSchema = z.object({
  mood: z.number().min(1).max(5),
  energy: z.number().min(1).max(5),
  sessionType: z.enum(["checkin", "deep_dive", "followup"]),
  summary: z.string(),
  keyTopics: z.array(z.string()).optional(),
  insights: z.array(z.string()).optional(),
  actionItems: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
  metadata: SessionMetadataSchema.optional()
})

// Consolidation mode schemas
export const CreateDailyLogConsolidationSchema = z.object({
  mood: z.number().min(1).max(5),
  energy: z.number().min(1).max(5),
  focusAreas: z.array(z.string()).optional(),
  sessionType: z.enum(["checkin", "deep_dive", "followup"]),
  progressRating: z.number().min(1).max(5),
  summary: z.string(),
  keyTopics: z.array(z.string()).optional(),
  progressUpdates: z.array(z.string()).optional(),
  insights: z.array(z.string()).optional(),
  actionItems: z.array(z.string()).optional(),
  followupPoints: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
  relatedNotes: z.array(z.string()).optional(),
  metadata: ConsolidationMetadataSchema.optional()
})

// Session mode insight schema
export const CreateInsightSessionSchema = z.object({
  title: z.string(),
  description: z.string(),
  actionItems: z.array(z.string()).optional(),
  metadata: SessionMetadataSchema.optional()
})

// Consolidation mode insight schema
export const CreateInsightConsolidationSchema = z.object({
  title: z.string(),
  relatedTo: z.array(z.string()).optional(),
  description: z.string().optional(),
  impact: z.array(z.string()).optional(),
  actionItems: z.array(z.string()).optional(),
  relatedInsights: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
  status: z.enum(['active', 'archived', 'in_progress']).optional(),
  impactLevel: z.enum(['low', 'medium', 'high']).optional(),
  metadata: ConsolidationMetadataSchema.optional()
})

export const CreateReflectionArgsSchema = z.object({
  title: z.string(),
  period: z.enum(["daily", "weekly", "monthly"]),
  focusAreas: z.array(z.string()).optional(),
  observations: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
  progress: z.array(z.string()).optional(),
  challenges: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
  relatedNotes: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
  status: z.enum(['active', 'archived', 'in_progress']).optional(),
  progressRating: z.number().min(1).max(5).optional(),
  metadata: ConsolidationMetadataSchema.optional()
})

// New schema for consolidated knowledge
export const CreateConsolidatedKnowledgeArgsSchema = z.object({
  title: z.string(),
  knowledgeType: z.enum(['pattern', 'strategy', 'trajectory']),
  overview: z.string(),
  sourceNotes: z.array(z.string()),
  keyPatterns: z.array(z.string()),
  supportingData: z.array(z.string()).optional(),
  analysis: z.object({
    patternDetails: z.array(z.string()),
    contextFactors: z.array(z.string()),
    impactAssessment: z.array(z.string())
  }),
  synthesis: z.object({
    keyInsights: z.array(z.string()),
    strategicImplications: z.array(z.string()),
    growthIndicators: z.array(z.string()).optional()
  }),
  implementation: z.object({
    steps: z.array(z.string()),
    successMetrics: z.array(z.string()).optional(),
    riskFactors: z.array(z.string()).optional()
  }),
  relationships: z.object({
    relatedPatterns: z.array(z.string()).optional(),
    connectedStrategies: z.array(z.string()).optional(),
    historicalContext: z.array(z.string()).optional()
  }),
  status: z.enum(['active', 'archived', 'in_progress']).optional(),
  metadata: ConsolidationMetadataSchema
})

// New schema for training examples
export const CreateTrainingExampleArgsSchema = z.object({
  title: z.string(),
  category: z.enum(['pattern_recognition', 'tool_usage', 'intervention']),
  context: z.object({
    situation: z.string(),
    userState: z.string(),
    relevantHistory: z.array(z.string()).optional()
  }),
  interaction: z.object({
    initialInput: z.string(),
    approachUsed: z.array(z.string()),
    toolUsage: z.array(z.string()).optional(),
    keyMoments: z.array(z.string())
  }),
  outcomes: z.object({
    immediateResults: z.string(),
    userResponse: z.string(),
    followupEffects: z.array(z.string()).optional()
  }),
  analysis: z.object({
    successFactors: z.array(z.string()),
    challengesFaced: z.array(z.string()),
    patternRecognition: z.array(z.string())
  }),
  learningPoints: z.object({
    effectiveStrategies: z.array(z.string()),
    areasForImprovement: z.array(z.string()).optional(),
    adaptabilityNotes: z.array(z.string()).optional()
  }),
  relationships: z.object({
    similarCases: z.array(z.string()).optional(),
    relatedPatterns: z.array(z.string()).optional(),
    connectedInsights: z.array(z.string()).optional()
  }),
  status: z.enum(['active', 'archived', 'in_progress']).optional(),
  metadata: ConsolidationMetadataSchema
})

// Existing utility schemas
export const ReadNotesArgsSchema = z.object({
  paths: z.array(z.string())
})

export const WriteNoteArgsSchema = z.object({
  path: z.string(),
  content: z.string()
})

export const QueryNotesArgsSchema = z.object({
  query: z.string().optional(),
  from: z.string().optional(),
  where: z.record(z.any()).optional(),
  sort: z.string().optional(),
  limit: z.number().optional(),
  fields: z.array(z.string()).optional(),
  format: z.enum(["table", "list"]).default("table")
})

// New schema for pattern detection
export const QueryPatternsArgsSchema = z.object({
  noteTypes: z.array(z.enum(['daily_log', 'insight', 'reflection', 'consolidated', 'training_example'])),
  timeRange: z.object({
    start: z.string().optional(),
    end: z.string().optional()
  }).optional(),
  categories: z.array(z.string()).optional(),
  minOccurrences: z.number().optional(),
  metadata: ConsolidationMetadataSchema.optional()
})

// Type guards for mode-specific schemas
export const isSessionMode = (mode: string): mode is 'session' => mode === 'session'

// Combined schemas with discriminator
export const CreateDailyLogArgsSchema = z.discriminatedUnion('mode', [
  CreateDailyLogSessionSchema.extend({ mode: z.literal('session') }),
  CreateDailyLogConsolidationSchema.extend({ mode: z.literal('consolidation') })
])

export const CreateInsightArgsSchema = z.discriminatedUnion('mode', [
  CreateInsightSessionSchema.extend({ mode: z.literal('session') }),
  CreateInsightConsolidationSchema.extend({ mode: z.literal('consolidation') })
])
