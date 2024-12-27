import fs from "fs/promises"
import path from "path"
import {
  validatePath,
  normalizeNotePath,
  readTemplate,
  listTemplates,
  substituteVariables,
  searchNotes,
  readNote
} from "./utils.js"
import {
  CreateDailyLogArgsSchema,
  CreateInsightArgsSchema,
  CreateReflectionArgsSchema,
  CreateFromTemplateArgsSchema,
  ListTemplatesArgsSchema,
  ReadNotesArgsSchema,
  SearchNotesArgsSchema,
  WriteNoteArgsSchema,
  QueryNotesArgsSchema
} from "./schemas.js"
import { parseDataviewQuery, executeQuery } from "./query-engine.js"

export class ToolHandlers {
  constructor(private vaultRoot: string) {}

  async createDailyLog(args: unknown) {
    const parsed = CreateDailyLogArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_daily_log: ${parsed.error}`)
    }

    try {
      // Read the daily log template
      const templateContent = await readTemplate(this.vaultRoot, 'daily_log.md')
      
      // Get today's date
      const today = new Date().toISOString().split('T')[0]
      
      // Prepare variables for template substitution
      const variables = {
        date: today,
        mood: String(parsed.data.mood),
        energy: String(parsed.data.energy),
        focus_areas: parsed.data.focusAreas?.join(", ") || "",
        session_type: parsed.data.sessionType,
        progress_rating: String(parsed.data.progressRating),
        summary: parsed.data.summary,
        key_topics: parsed.data.keyTopics?.map(topic => `- ${topic}`).join("\n") || "",
        progress_updates: parsed.data.progressUpdates?.map(item => `- [ ] ${item}`).join("\n") || "",
        insights: parsed.data.insights?.map(insight => `- ${insight}`).join("\n") || "",
        action_items: parsed.data.actionItems?.map(item => `- [ ] ${item}`).join("\n") || "",
        followup_points: parsed.data.followupPoints?.map(point => `- ${point}`).join("\n") || "",
        notes: parsed.data.notes?.map(note => `- ${note}`).join("\n") || "",
        related_notes: parsed.data.relatedNotes?.map(note => `- [[${note}]]`).join("\n") || ""
      }

      // Fill the template
      const filledContent = substituteVariables(templateContent, variables)
      const notePath = `daily_logs/${today}.md`
      
      // Use write_note functionality to create the file
      const normalizedPath = normalizeNotePath(notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      await fs.mkdir(path.dirname(validPath), { recursive: true })
      await fs.writeFile(validPath, filledContent, "utf-8")

      return {
        content: [
          {
            type: "text",
            text: `Successfully created daily log at ${normalizedPath}`,
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create daily log: ${errorMessage}`)
    }
  }

  async createInsight(args: unknown) {
    const parsed = CreateInsightArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_insight: ${parsed.error}`)
    }

    try {
      // Read the insight template
      const templateContent = await readTemplate(this.vaultRoot, 'insight.md')
      
      // Prepare variables for template substitution
      const variables = {
        title: parsed.data.title,
        date: new Date().toISOString().split('T')[0],
        related_to: parsed.data.relatedTo?.map(item => `[[${item}]]`).join(", ") || "",
        description: parsed.data.description || "",
        impact: parsed.data.impact?.join("\n- ") || "",
        action_items: parsed.data.actionItems?.map(item => `- [ ] ${item}`).join("\n") || "",
        related_insights: parsed.data.relatedInsights?.map(item => `[[${item}]]`).join("\n- ") || "",
        links: parsed.data.links?.join("\n- ") || ""
      }

      // Fill the template
      const filledContent = substituteVariables(templateContent, variables)
      const notePath = `insights/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`
      
      // Use write_note functionality to create the file
      const normalizedPath = normalizeNotePath(notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      await fs.mkdir(path.dirname(validPath), { recursive: true })
      await fs.writeFile(validPath, filledContent, "utf-8")

      return {
        content: [
          {
            type: "text",
            text: `Successfully created insight note at ${normalizedPath}`,
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create insight note: ${errorMessage}`)
    }
  }

  async createReflection(args: unknown) {
    const parsed = CreateReflectionArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_reflection: ${parsed.error}`)
    }

    try {
      // Read the reflection template
      const templateContent = await readTemplate(this.vaultRoot, 'reflection.md')
      
      // Prepare variables for template substitution
      const variables = {
        title: parsed.data.title,
        date: new Date().toISOString().split('T')[0],
        period: parsed.data.period,
        focus_areas: parsed.data.focusAreas?.join(", ") || "",
        observations: parsed.data.observations?.join("\n- ") || "",
        patterns: parsed.data.patterns?.join("\n- ") || "",
        progress: parsed.data.progress?.join("\n- ") || "",
        challenges: parsed.data.challenges?.join("\n- ") || "",
        next_steps: parsed.data.nextSteps?.map(item => `- [ ] ${item}`).join("\n") || "",
        related_notes: parsed.data.relatedNotes?.map(item => `[[${item}]]`).join("\n- ") || "",
        links: parsed.data.links?.join("\n- ") || ""
      }

      // Fill the template
      const filledContent = substituteVariables(templateContent, variables)
      const notePath = `reflections/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`
      
      // Use write_note functionality to create the file
      const normalizedPath = normalizeNotePath(notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      await fs.mkdir(path.dirname(validPath), { recursive: true })
      await fs.writeFile(validPath, filledContent, "utf-8")

      return {
        content: [
          {
            type: "text",
            text: `Successfully created reflection note at ${normalizedPath}`,
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create reflection note: ${errorMessage}`)
    }
  }

  async listTemplates(args: unknown) {
    const parsed = ListTemplatesArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for list_templates: ${parsed.error}`)
    }
    
    const templates = await listTemplates(this.vaultRoot, parsed.data.folder)
    return {
      content: [
        {
          type: "text",
          text: templates.length > 0 ? templates.join("\n") : "No templates found",
        },
      ],
    }
  }

  async createFromTemplate(args: unknown) {
    const parsed = CreateFromTemplateArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_from_template: ${parsed.error}`)
    }

    try {
      const templateContent = await readTemplate(this.vaultRoot, parsed.data.templateName)
      const filledContent = substituteVariables(templateContent, parsed.data.variables)
      
      // Use write_note functionality to create the file
      const normalizedPath = normalizeNotePath(parsed.data.notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      await fs.mkdir(path.dirname(validPath), { recursive: true })
      await fs.writeFile(validPath, filledContent, "utf-8")

      return {
        content: [
          {
            type: "text",
            text: `Successfully created note from template ${parsed.data.templateName} at ${normalizedPath}`,
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create note from template: ${errorMessage}`)
    }
  }

  async readNotes(args: unknown) {
    const parsed = ReadNotesArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for read_notes: ${parsed.error}`)
    }

    const results = await Promise.all(
      parsed.data.paths.map(async (filePath: string) => {
        try {
          // Normalize the note path and join with vault directory
          const normalizedPath = normalizeNotePath(filePath)
          const validPath = await validatePath(
            path.join(this.vaultRoot, normalizedPath),
            [this.vaultRoot]
          )
          const content = await fs.readFile(validPath, "utf-8")
          return `${filePath}:\n${content}\n`
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          return `${filePath}: Error - ${errorMessage}`
        }
      })
    )
    return {
      content: [{ type: "text", text: results.join("\n---\n") }],
    }
  }

  async searchNotes(args: unknown) {
    const parsed = SearchNotesArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for search_notes: ${parsed.error}`)
    }

    const results = await searchNotes(parsed.data.query, this.vaultRoot, 200)
    return {
      content: [
        {
          type: "text",
          text: results.length > 0 ? results.join("\n") : "No matches found",
        },
      ],
    }
  }

  async writeNote(args: unknown) {
    const parsed = WriteNoteArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for write_note: ${parsed.error}`)
    }

    try {
      // Normalize the note path and join with vault directory
      const normalizedPath = normalizeNotePath(parsed.data.path)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      // Write the file
      await fs.writeFile(validPath, parsed.data.content, "utf-8")

      return {
        content: [{ type: "text", text: `Successfully wrote note to ${normalizedPath}` }],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to write note: ${errorMessage}`)
    }
  }

  async queryNotes(args: unknown) {
    const parsed = QueryNotesArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for query_notes: ${parsed.error}`)
    }

    try {
      // Parse Dataview query if provided
      const queryParams = parsed.data.query ? parseDataviewQuery(parsed.data.query) : {}
      
      // Merge explicit parameters with query parameters
      const finalParams = {
        from: parsed.data.from || queryParams.from,
        where: parsed.data.where || queryParams.where,
        sort: parsed.data.sort || queryParams.sort,
        limit: parsed.data.limit || queryParams.limit,
        fields: parsed.data.fields || queryParams.fields,
        format: parsed.data.format
      }

      const result = await executeQuery(this.vaultRoot, finalParams)

      return {
        content: [{
          type: "text",
          text: result
        }]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to query notes: ${errorMessage}`)
    }
  }
}
