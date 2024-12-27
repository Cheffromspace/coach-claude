import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { ToolSchema } from "@modelcontextprotocol/sdk/types.js"

// Schema definitions
export const ReadNotesArgsSchema = z.object({
  paths: z.array(z.string()),
})

export const SearchNotesArgsSchema = z.object({
  query: z.string(),
})

export const WriteNoteArgsSchema = z.object({
  path: z.string(),
  content: z.string(),
})

export const ListTemplatesArgsSchema = z.object({
  folder: z.string().optional(),
})

export const CreateFromTemplateArgsSchema = z.object({
  templateName: z.string(),
  notePath: z.string(),
  variables: z.record(z.string()).optional(),
})

export const CreateInsightArgsSchema = z.object({
  title: z.string(),
  relatedTo: z.array(z.string()).optional(),
  description: z.string().optional(),
  impact: z.array(z.string()).optional(),
  actionItems: z.array(z.string()).optional(),
  relatedInsights: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
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
})

export const CreateDailyLogArgsSchema = z.object({
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
})

export const QueryNotesArgsSchema = z.object({
  query: z.string(),
  from: z.string().optional(),
  where: z.record(z.any()).optional(),
  sort: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  format: z.enum(['table', 'list']).default('table'),
  fields: z.array(z.string()).optional()
})

export const ToolInputSchema = ToolSchema.shape.inputSchema
export type ToolInput = z.infer<typeof ToolInputSchema>

// Tool definitions
export const TOOL_DEFINITIONS = {
  create_daily_log: {
    name: "create_daily_log",
    description: "Creates a new daily log note using the daily_log template with YAML frontmatter. The note will be created in the daily_logs directory. The date and other metadata are automatically added to the frontmatter.",
    inputSchema: zodToJsonSchema(CreateDailyLogArgsSchema) as ToolInput,
  },
  read_notes: {
    name: "read_notes",
    description: "Read the contents of multiple notes. Each note's content is returned with its path as a reference. Notes use YAML frontmatter for metadata. Failed reads for individual notes won't stop the entire operation. Reading too many at once may result in an error.",
    inputSchema: zodToJsonSchema(ReadNotesArgsSchema) as ToolInput,
  },
  search_notes: {
    name: "search_notes", 
    description: "Searches for a note by its name. The search is case-insensitive and matches partial names. Queries can also be a valid regex. Returns paths of the notes that match the query.",
    inputSchema: zodToJsonSchema(SearchNotesArgsSchema) as ToolInput,
  },
  write_note: {
    name: "write_note",
    description: "Creates or updates a note in the vault. The path should be relative to the vault root. Will create any necessary directories. Content should be in markdown format with YAML frontmatter for metadata.",
    inputSchema: zodToJsonSchema(WriteNoteArgsSchema) as ToolInput,
  },
  list_templates: {
    name: "list_templates",
    description: "Lists available note templates in the templates directory. All templates use YAML frontmatter for metadata. Optionally specify a subfolder to list templates from that folder only.",
    inputSchema: zodToJsonSchema(ListTemplatesArgsSchema) as ToolInput,
  },
  create_from_template: {
    name: "create_from_template",
    description: "Creates a new note from a template. Templates use YAML frontmatter for metadata. Variables in the template ({{variable}}) will be replaced with provided values. The {{date}} variable is automatically replaced with the current date.",
    inputSchema: zodToJsonSchema(CreateFromTemplateArgsSchema) as ToolInput,
  },
  create_insight: {
    name: "create_insight",
    description: "Creates a new insight note using the insight template with YAML frontmatter. The note will be created in the insights directory. The date and other metadata are automatically added to the frontmatter.",
    inputSchema: zodToJsonSchema(CreateInsightArgsSchema) as ToolInput,
  },
  query_notes: {
    name: "query_notes",
    description: "Query notes using Dataview-style syntax. Supports TABLE and list formats, FROM/WHERE/SORT/LIMIT clauses, and field aliases. Results are formatted in markdown.",
    inputSchema: zodToJsonSchema(QueryNotesArgsSchema) as ToolInput,
  },
  create_reflection: {
    name: "create_reflection",
    description: "Creates a new reflection note using the reflection template with YAML frontmatter. The note will be created in the reflections directory. The date, period, and other metadata are automatically added to the frontmatter.",
    inputSchema: zodToJsonSchema(CreateReflectionArgsSchema) as ToolInput,
  },
}
