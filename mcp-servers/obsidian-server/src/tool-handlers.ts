import { z } from "zod"
import fs from "fs/promises"
import path from "path"
import {
  validatePath,
  normalizeNotePath,
  readTemplate,
  substituteVariables,
  readNote
} from "./utils.js"
import {
  CreateDailyLogArgsSchema,
  CreateInsightArgsSchema,
  CreateReflectionArgsSchema,
  CreateConsolidatedKnowledgeArgsSchema,
  CreateTrainingExampleArgsSchema,
  ReadNotesArgsSchema,
  WriteNoteArgsSchema,
  QueryNotesArgsSchema,
  QueryPatternsArgsSchema
} from "./schemas.js"
import { parseDataviewQuery, executeQuery } from "./query-engine.js"

export type ServerMode = 'session' | 'consolidation'

interface Section {
  title: string;
  items: string[] | undefined;
  prefix: string;
  suffix?: string;
}

type ToolResponse = {
  content: Array<{
    type: string;
    text: string;
  }>;
};

export class ToolHandlers {
  private mode: ServerMode = 'session'

  constructor(private vaultRoot: string) {}

  setMode(mode: ServerMode): void {
    this.mode = mode
  }

  getToolDefinitions() {
    const baseTools = {
      read_notes: {
        name: "read_notes",
        description: "Reads the full content of specified notes. Required fields:\n" +
          "- paths: string[] - Array of note paths relative to the vault root\n" +
          "Returns the complete content of each requested note.\n" +
          "Note: Paths should include the .md extension",
        example: {
          paths: [
            "daily_logs/2024-03-19.md",
            "insights/problem-solving-pattern.md"
          ]
        },
        inputSchema: ReadNotesArgsSchema
      },
      write_note: {
        name: "write_note",
        description: "Creates or updates a note at the specified path. Required fields:\n" +
          "- path: string - Target path relative to vault root (include .md extension)\n" +
          "- content: string - Complete content for the note\n" +
          "Note: Automatically creates any necessary directories in the path",
        example: {
          path: "projects/web-app/architecture.md",
          content: "# Web Application Architecture\n\n" +
            "## Overview\n" +
            "Key architectural decisions and component relationships.\n\n" +
            "## Components\n" +
            "- Frontend: React with TypeScript\n" +
            "- Backend: Node.js Express API\n" +
            "- Database: PostgreSQL"
        },
        inputSchema: WriteNoteArgsSchema
      },
      search_notes: {
        name: "search_notes",
        description: "Performs a regex-based full-text search across all markdown files. Required fields:\n" +
          "- pattern: string - Regular expression pattern to search for\n" +
          "Optional fields:\n" +
          "- caseSensitive: boolean - Whether to perform case-sensitive search (default: false)\n" +
          "Returns matches with surrounding context for better understanding",
        example: {
          pattern: "\\b(API|REST)\\b", // Matches whole words API or REST
          caseSensitive: true
        },
        inputSchema: z.object({
          pattern: z.string(),
          caseSensitive: z.boolean().optional()
        })
      },
      list_templates: {
        name: "list_templates",
        description: "Lists all available note templates in the templates directory.\n" +
          "No arguments required.\n" +
          "Returns an array of template filenames that can be used as references for creating new notes.",
        example: {}, // Empty object since no args needed
        inputSchema: z.object({})
      }
    }

    // Session mode tools
    if (this.mode === 'session') {
      return {
        ...baseTools,
        create_daily_log: {
          name: "create_daily_log",
          description: "Creates a daily log entry in the daily_logs directory. Required fields:\n" +
            "- mood: number (1-5) representing overall mood\n" +
            "- energy: number (1-5) representing energy level\n" +
            "- sessionType: one of ['checkin', 'deep_dive', 'followup']\n" +
            "- summary: string describing the session\n" +
            "Optional fields:\n" +
            "- keyTopics[]: key discussion points\n" +
            "- insights[]: new realizations or learnings\n" +
            "- actionItems[]: tasks to be completed\n" +
            "- notes[]: additional observations",
          example: {
            mode: "session",
            mood: 4,
            energy: 3,
            sessionType: "deep_dive",
            summary: "Productive session focused on project planning",
            keyTopics: ["architecture", "timeline"],
            actionItems: ["Create initial wireframes", "Set up development environment"]
          },
          inputSchema: CreateDailyLogArgsSchema
        },
        create_insight: {
          name: "create_insight",
          description: "Creates an insight entry in the insights directory. Required fields:\n" +
            "- title: string\n" +
            "- description: string\n" +
            "Optional fields:\n" +
            "- actionItems[]: tasks or next steps",
          example: {
            mode: "session",
            title: "Effective Communication Pattern",
            description: "Clear, direct communication leads to better outcomes",
            actionItems: ["Document communication guidelines", "Share with team"]
          },
          inputSchema: CreateInsightArgsSchema
        }
      }
    }

    // Consolidation mode tools
    return {
      ...baseTools,
      create_daily_log: {
        name: "create_daily_log",
        description: "Creates a daily log entry in the daily_logs directory. Required fields:\n" +
          "- mood: number (1-5) representing overall mood\n" +
          "- energy: number (1-5) representing energy level\n" +
          "- sessionType: one of ['checkin', 'deep_dive', 'followup']\n" +
          "- summary: string describing the session\n" +
          "- progressRating: number (1-5)\n" +
          "Optional fields:\n" +
          "- focusAreas[]: specific areas of concentration\n" +
          "- progressUpdates[]: status updates\n" +
          "- followupPoints[]: items needing follow-up\n" +
          "- relatedNotes[]: links to related content",
        example: {
          mode: "consolidation",
          mood: 4,
          energy: 3,
          sessionType: "deep_dive",
          summary: "Deep analysis of recent patterns",
          progressRating: 4,
          focusAreas: ["Pattern Analysis", "Strategy Development"],
          progressUpdates: ["Identified key patterns", "Developed action plan"],
          relatedNotes: ["patterns/problem-solving", "strategies/implementation"]
        },
        inputSchema: CreateDailyLogArgsSchema
      },
      create_insight: {
        name: "create_insight",
        description: "Creates an insight entry in the insights directory. Required fields:\n" +
          "- title: string\n" +
          "- description: string\n" +
          "Optional fields:\n" +
          "- relatedTo[]: connected topics or areas\n" +
          "- impact[]: effect on processes or outcomes\n" +
          "- actionItems[]: tasks or next steps\n" +
          "- relatedInsights[]: linked insights\n" +
          "- links[]: external references\n" +
          "- status: one of ['active', 'archived', 'in_progress']\n" +
          "- impactLevel: one of ['low', 'medium', 'high']",
        example: {
          mode: "consolidation",
          title: "Pattern: Iterative Problem Solving",
          description: "Breaking down complex problems into smaller, manageable steps leads to better solutions",
          impactLevel: "high",
          relatedTo: ["project planning", "development workflow"],
          actionItems: ["Document approach in team guidelines", "Create training examples"]
        },
        inputSchema: CreateInsightArgsSchema
      },
      create_consolidated_knowledge: {
        name: "create_consolidated_knowledge",
        description: "Creates a consolidated knowledge entry that synthesizes patterns and strategies. Required fields:\n" +
          "- title: string - Name of the consolidated knowledge entry\n" +
          "- knowledgeType: one of ['pattern', 'strategy', 'trajectory']\n" +
          "- overview: string - High-level description\n" +
          "- sourceNotes: string[] - References to source material\n" +
          "- keyPatterns: string[] - Core patterns identified\n" +
          "- analysis: object containing:\n" +
          "  - patternDetails: string[] - Detailed pattern descriptions\n" +
          "  - contextFactors: string[] - Relevant contextual elements\n" +
          "  - impactAssessment: string[] - Impact evaluation\n" +
          "- synthesis: object containing:\n" +
          "  - keyInsights: string[] - Main takeaways\n" +
          "  - strategicImplications: string[] - Strategic considerations\n" +
          "- implementation: object containing:\n" +
          "  - steps: string[] - Action items for implementation",
        example: {
          title: "Effective Problem Resolution Pattern",
          knowledgeType: "pattern",
          overview: "A systematic approach to resolving complex technical challenges",
          sourceNotes: ["daily_logs/2024-03-15", "insights/debugging-workflow"],
          keyPatterns: ["systematic debugging", "root cause analysis"],
          analysis: {
            patternDetails: ["Start with reproduction steps", "Isolate variables"],
            contextFactors: ["System complexity", "Time constraints"],
            impactAssessment: ["Reduced resolution time", "Improved accuracy"]
          },
          synthesis: {
            keyInsights: ["Systematic approach yields consistent results"],
            strategicImplications: ["Train team on methodology"]
          },
          implementation: {
            steps: ["Document current state", "Create debug checklist"]
          }
        },
        inputSchema: CreateConsolidatedKnowledgeArgsSchema
      },
      query_patterns: {
        name: "query_patterns",
        description: "Analyzes notes to identify recurring patterns. Required fields:\n" +
          "- noteTypes: Array of ['daily_log', 'insight', 'reflection', 'consolidated', 'training_example']\n" +
          "Optional fields:\n" +
          "- timeRange: object with optional start and end dates\n" +
          "- categories: string[] - Filter by training categories\n" +
          "- minOccurrences: number - Minimum pattern frequency\n" +
          "- metadata: object - Additional metadata filters\n" +
          "Returns analysis of behavioral, tool usage, and success patterns",
        example: {
          noteTypes: ["daily_log", "insight"],
          timeRange: {
            start: "2024-01-01",
            end: "2024-03-20"
          },
          categories: ["technique", "pattern"],
          minOccurrences: 3
        },
        inputSchema: QueryPatternsArgsSchema
      }
    }
  }

  private validateModeAccess(tool: string): void {
    const SESSION_MODE_TOOLS = [
      'create_daily_log',
      'create_insight', 
      'read_notes',
      'write_note',
      'search_notes',
      'list_templates'
    ]

    if (this.mode === 'session' && !SESSION_MODE_TOOLS.includes(tool)) {
      throw new Error(`Tool ${tool} is not available in session mode`)
    }
  }

  private assertParsedData<T>(parsed: z.SafeParseReturnType<any, T>): asserts parsed is { success: true; data: T } {
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error}`)
    }
  }

  private handleError(error: unknown, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to ${operation}: ${errorMessage}`)
  }

  async createDailyLog(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('create_daily_log')
    const parsed = CreateDailyLogArgsSchema.safeParse({
      mode: this.mode,
      ...(args as object)
    })
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_daily_log: ${parsed.error}`)
    }

    try {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const timestamp = now.toISOString().replace(/[:.]/g, '-')
      const data = parsed.data

      // Base variables for both modes
      const variables = {
        date: today,
        title: `Daily Log ${today}`,
        mood: String(data.mood),
        energy: String(data.energy),
        session_type: data.sessionType,
        summary: data.summary || "",
      }

      // Add mode-specific variables
      if (data.mode === 'consolidation') {
        Object.assign(variables, {
          focus_areas: data.focusAreas?.join(", ") || "[]",
          progress_rating: String(data.progressRating)
        })
      }

      // Read template and get just the content part (after frontmatter)
      const templateContent = await readTemplate(this.vaultRoot, 'daily_log.md')
      const contentStart = templateContent.indexOf('---\n', templateContent.indexOf('---\n') + 4) + 4
      const content = templateContent.slice(contentStart)

      // Create frontmatter based on mode
      let processedContent = `---
title: Daily Log ${today}
date: ${today}
date_based_filename: ${today}.md
type: daily_log
tags: []
mood: ${data.mood}
energy: ${data.energy}
session_type: ${data.sessionType}
${data.mode === 'consolidation' ? `focus_areas: [${data.focusAreas?.join(", ") || ""}]
progress_rating: ${data.progressRating}` : ''}
${data.metadata ? `metadata:
  effectiveness: ${data.metadata.effectiveness || ""}
  privacyLevel: ${data.metadata.privacyLevel || ""}
  ${data.mode === 'consolidation' ? `trainingCategory: ${data.metadata.trainingCategory || ""}
  qualityMarkers: [${data.metadata.qualityMarkers?.map(m => `"${m}"`).join(", ") || ""}]
  clusters: [${data.metadata.clusters?.map(c => `"${c}"`).join(", ") || ""}]
  patterns: [${data.metadata.patterns?.map(p => `"${p}"`).join(", ") || ""}]
  relationships: [${data.metadata.relationships?.map(r => `"${r}"`).join(", ") || ""}]` : ''}` : ""}
---

`

      // Add summary
      processedContent += content.replace('<!-- Brief overview of the coaching session -->', parsed.data.summary || '')

      // Add key topics for both modes
      if (data.keyTopics?.length) {
        processedContent = processedContent.replace('- \n', data.keyTopics.map(topic => `- ${topic}`).join('\n') + '\n')
      }

      // Add progress updates for consolidation mode
      if (data.mode === 'consolidation' && data.progressUpdates?.length) {
        processedContent = processedContent.replace('- [ ] \n', data.progressUpdates.map(item => `- [ ] ${item}`).join('\n') + '\n')
      }

      // Add common sections for both modes
      const sections: Section[] = [
        {
          title: '## New Insights',
          items: data.insights,
          prefix: '- ',
          suffix: ''
        },
        {
          title: '## Action Items',
          items: [...(data.actionItems || []), `Consolidate daily logs during next consolidation period`],
          prefix: '- [ ] ',
          suffix: ''
        },
        {
          title: '## Notes',
          items: data.notes,
          prefix: '- ',
          suffix: ''
        }
      ]

      // Add consolidation mode sections
      if (data.mode === 'consolidation') {
        sections.push(
          {
            title: '## Follow-up Points',
            items: data.followupPoints,
            prefix: '- ',
            suffix: ''
          },
          {
            title: '## Related Notes',
            items: data.relatedNotes,
            prefix: '- [[',
            suffix: ']]'
          }
        )
      }

      // Process all sections
      for (const section of sections) {
        if (section.items?.length) {
          const sectionStart = processedContent.indexOf(section.title)
          const nextSection = processedContent.indexOf('##', sectionStart + 1)
          const content = section.items.map(item => 
            `${section.prefix}${item}${section.suffix || ''}`
          ).join('\n')
          
          processedContent = processedContent.slice(0, sectionStart) +
            `${section.title}\n${content}\n\n` +
            (nextSection > -1 ? processedContent.slice(nextSection) : '')
        }
      }

      // Write the processed content to file using timestamp-based filename
      const notePath = `daily_logs/${timestamp}.md`
      const normalizedPath = normalizeNotePath(notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      await fs.mkdir(path.dirname(validPath), { recursive: true })
      await fs.writeFile(validPath, processedContent, "utf-8")

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

  async createInsight(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('create_insight')
    const parsed = CreateInsightArgsSchema.safeParse({
      mode: this.mode,
      ...(args as object)
    })
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_insight: ${parsed.error}`)
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const notePath = `insights/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`
      const normalizedPath = normalizeNotePath(notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      const data = parsed.data
      
      // Create content based on mode
      let content = `---
title: ${data.title}
date: ${today}
type: insight
${data.mode === 'consolidation' ? `related_to: [${data.relatedTo?.map(item => `[[${item}]]`).join(", ") || ""}]
status: ${data.status || "active"}
impact_level: ${data.impactLevel || "medium"}` : ''}
tags: []
${data.metadata ? `metadata:
  effectiveness: ${data.metadata.effectiveness || ""}
  privacyLevel: ${data.metadata.privacyLevel || ""}
  ${data.mode === 'consolidation' ? `trainingCategory: ${data.metadata.trainingCategory || ""}
  qualityMarkers: [${data.metadata.qualityMarkers?.join(", ") || ""}]
  clusters: [${data.metadata.clusters?.join(", ") || ""}]
  patterns: [${data.metadata.patterns?.join(", ") || ""}]
  relationships: [${data.metadata.relationships?.join(", ") || ""}]` : ''}` : ""}
---

## Description
${parsed.data.description || ""}

## Context
<!-- What led to this insight? What was happening at the time? -->

${data.mode === 'consolidation' ? `## Impact
${data.impact ? data.impact.map(item => `- ${item}`).join("\n") : ""}` : ''}

## Action Items
${data.actionItems ? data.actionItems.map(item => `- [ ] ${item}`).join("\n") : ""}

${data.mode === 'consolidation' ? `## Related Insights
${data.relatedInsights ? data.relatedInsights.map(item => `- [[${item}]]`).join("\n") : ""}` : ''}

## Pattern Recognition
<!-- Identify any patterns this insight relates to or reveals -->
- 

## Evidence & Examples
<!-- Supporting observations or specific instances -->
- 

${data.mode === 'consolidation' ? `## References
${data.links ? data.links.map(link => `- ${link}`).join("\n") : ""}` : ''}`

      await fs.mkdir(path.dirname(validPath), { recursive: true })
      await fs.writeFile(validPath, content, "utf-8")

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

  async createReflection(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('create_reflection')
    const parsed = CreateReflectionArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_reflection: ${parsed.error}`)
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const notePath = `reflections/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`
      const normalizedPath = normalizeNotePath(notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      // Create content
      let content = `---
title: ${parsed.data.title}
date: ${today}
type: reflection
period: ${parsed.data.period}
focus_areas: [${parsed.data.focusAreas?.join(", ") || ""}]
tags: []
status: ${parsed.data.status || "active"}
progress_rating: ${parsed.data.progressRating || ""}
${parsed.data.metadata ? `metadata:
  effectiveness: ${parsed.data.metadata.effectiveness || ""}
  trainingCategory: ${parsed.data.metadata.trainingCategory || ""}
  privacyLevel: ${parsed.data.metadata.privacyLevel || ""}
  qualityMarkers: [${parsed.data.metadata.qualityMarkers?.join(", ") || ""}]
  clusters: [${parsed.data.metadata.clusters?.join(", ") || ""}]
  patterns: [${parsed.data.metadata.patterns?.join(", ") || ""}]
  relationships: [${parsed.data.metadata.relationships?.join(", ") || ""}]` : ""}
---

## Key Observations
${parsed.data.observations ? parsed.data.observations.map(item => `- ${item}`).join("\n") : ""}

## Progress Analysis
${parsed.data.progress ? parsed.data.progress.map(item => `- ${item}`).join("\n") : ""}

## Challenges
${parsed.data.challenges ? parsed.data.challenges.map(item => `- ${item}`).join("\n") : ""}

## Pattern Recognition
### Behavioral Patterns
- 

### Tool Usage Patterns
- 

### Success Patterns
- 

## Knowledge Synthesis
### Growth Trajectory
- 

### Strategy Evolution
- 

## Action Plan
${parsed.data.nextSteps ? parsed.data.nextSteps.map(item => `- [ ] ${item}`).join("\n") : ""}

## Related Notes
### Supporting Evidence
${parsed.data.relatedNotes ? parsed.data.relatedNotes.map(note => `- [[${note}]]`).join("\n") : ""}

### Connected Insights
- 

### Similar Patterns
- 

## References
${parsed.data.links ? parsed.data.links.map(link => `- ${link}`).join("\n") : ""}`

      await fs.mkdir(path.dirname(validPath), { recursive: true })
      await fs.writeFile(validPath, content, "utf-8")

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

  async readNotes(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('read_notes')
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

  async writeNote(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('write_note')
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

  async createConsolidatedKnowledge(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('create_consolidated_knowledge')
    const parsed = CreateConsolidatedKnowledgeArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_consolidated_knowledge: ${parsed.error}`)
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const notePath = `consolidated/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`
      const normalizedPath = normalizeNotePath(notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      // Create content
      let content = `---
title: ${parsed.data.title}
date: ${today}
type: consolidated
knowledge_type: ${parsed.data.knowledgeType}
status: ${parsed.data.status || "active"}
metadata:
  effectiveness: ${parsed.data.metadata.effectiveness || ""}
  trainingCategory: ${parsed.data.metadata.trainingCategory || ""}
  privacyLevel: ${parsed.data.metadata.privacyLevel || ""}
  qualityMarkers: [${parsed.data.metadata.qualityMarkers?.join(", ") || ""}]
  clusters: [${parsed.data.metadata.clusters?.join(", ") || ""}]
  patterns: [${parsed.data.metadata.patterns?.join(", ") || ""}]
  relationships: [${parsed.data.metadata.relationships?.join(", ") || ""}]
---

## Overview
${parsed.data.overview || ""}

## Evidence Base
### Source Notes
${parsed.data.sourceNotes ? parsed.data.sourceNotes.map(note => `- [[${note}]]`).join("\n") : ""}

### Key Patterns
${parsed.data.keyPatterns ? parsed.data.keyPatterns.map(pattern => `- ${pattern}`).join("\n") : ""}

### Supporting Data
${parsed.data.supportingData ? parsed.data.supportingData.map(data => `- ${data}`).join("\n") : ""}

## Analysis
### Pattern Details
${parsed.data.analysis.patternDetails ? parsed.data.analysis.patternDetails.map(detail => `- ${detail}`).join("\n") : ""}

### Context Factors
${parsed.data.analysis.contextFactors ? parsed.data.analysis.contextFactors.map(factor => `- ${factor}`).join("\n") : ""}

### Impact Assessment
${parsed.data.analysis.impactAssessment ? parsed.data.analysis.impactAssessment.map(impact => `- ${impact}`).join("\n") : ""}

## Synthesis
### Key Insights
${parsed.data.synthesis.keyInsights ? parsed.data.synthesis.keyInsights.map(insight => `- ${insight}`).join("\n") : ""}

### Strategic Implications
${parsed.data.synthesis.strategicImplications ? parsed.data.synthesis.strategicImplications.map(implication => `- ${implication}`).join("\n") : ""}

### Growth Indicators
${parsed.data.synthesis.growthIndicators ? parsed.data.synthesis.growthIndicators.map(indicator => `- ${indicator}`).join("\n") : ""}

## Application
### Implementation Steps
${parsed.data.implementation.steps ? parsed.data.implementation.steps.map(step => `- [ ] ${step}`).join("\n") : ""}

### Success Metrics
${parsed.data.implementation.successMetrics ? parsed.data.implementation.successMetrics.map(metric => `- ${metric}`).join("\n") : ""}

### Risk Factors
${parsed.data.implementation.riskFactors ? parsed.data.implementation.riskFactors.map(risk => `- ${risk}`).join("\n") : ""}

## Relationships
### Related Patterns
${parsed.data.relationships.relatedPatterns ? parsed.data.relationships.relatedPatterns.map(pattern => `- [[${pattern}]]`).join("\n") : ""}

### Connected Strategies
${parsed.data.relationships.connectedStrategies ? parsed.data.relationships.connectedStrategies.map(strategy => `- [[${strategy}]]`).join("\n") : ""}

### Historical Context
${parsed.data.relationships.historicalContext ? parsed.data.relationships.historicalContext.map(context => `- ${context}`).join("\n") : ""}`

      await fs.mkdir(path.dirname(validPath), { recursive: true })
      await fs.writeFile(validPath, content, "utf-8")

      return {
        content: [
          {
            type: "text",
            text: `Successfully created consolidated knowledge note at ${normalizedPath}`,
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create consolidated knowledge note: ${errorMessage}`)
    }
  }

  async createTrainingExample(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('create_training_example')
    const parsed = CreateTrainingExampleArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_training_example: ${parsed.error}`)
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const notePath = `training/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`
      const normalizedPath = normalizeNotePath(notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      // Create content
      let content = `---
title: ${parsed.data.title}
date: ${today}
type: training_example
category: ${parsed.data.category}
status: ${parsed.data.status || "active"}
metadata:
  effectiveness: ${parsed.data.metadata.effectiveness || ""}
  trainingCategory: ${parsed.data.metadata.trainingCategory || ""}
  privacyLevel: ${parsed.data.metadata.privacyLevel || ""}
  qualityMarkers: [${parsed.data.metadata.qualityMarkers?.join(", ") || ""}]
  clusters: [${parsed.data.metadata.clusters?.join(", ") || ""}]
  patterns: [${parsed.data.metadata.patterns?.join(", ") || ""}]
  relationships: [${parsed.data.metadata.relationships?.join(", ") || ""}]
---

## Context
### Situation
${parsed.data.context.situation || ""}

### User State
${parsed.data.context.userState || ""}

### Relevant History
${parsed.data.context.relevantHistory ? parsed.data.context.relevantHistory.map(item => `- ${item}`).join("\n") : ""}

## Interaction
### Initial Input
${parsed.data.interaction.initialInput || ""}

### Approach Used
${parsed.data.interaction.approachUsed ? parsed.data.interaction.approachUsed.map(item => `- ${item}`).join("\n") : ""}

### Tool Usage
${parsed.data.interaction.toolUsage ? parsed.data.interaction.toolUsage.map(tool => `- ${tool}`).join("\n") : ""}

### Key Moments
${parsed.data.interaction.keyMoments ? parsed.data.interaction.keyMoments.map(moment => `- ${moment}`).join("\n") : ""}

## Outcomes
### Immediate Results
${parsed.data.outcomes.immediateResults || ""}

### User Response
${parsed.data.outcomes.userResponse || ""}

### Follow-up Effects
${parsed.data.outcomes.followupEffects ? parsed.data.outcomes.followupEffects.map(effect => `- ${effect}`).join("\n") : ""}

## Analysis
### Success Factors
${parsed.data.analysis.successFactors ? parsed.data.analysis.successFactors.map(factor => `- ${factor}`).join("\n") : ""}

### Challenges Faced
${parsed.data.analysis.challengesFaced ? parsed.data.analysis.challengesFaced.map(challenge => `- ${challenge}`).join("\n") : ""}

### Pattern Recognition
${parsed.data.analysis.patternRecognition ? parsed.data.analysis.patternRecognition.map(pattern => `- ${pattern}`).join("\n") : ""}

## Learning Points
### Effective Strategies
${parsed.data.learningPoints.effectiveStrategies ? parsed.data.learningPoints.effectiveStrategies.map(strategy => `- ${strategy}`).join("\n") : ""}

### Areas for Improvement
${parsed.data.learningPoints.areasForImprovement ? parsed.data.learningPoints.areasForImprovement.map(area => `- ${area}`).join("\n") : ""}

### Adaptability Notes
${parsed.data.learningPoints.adaptabilityNotes ? parsed.data.learningPoints.adaptabilityNotes.map(note => `- ${note}`).join("\n") : ""}

## Relationships
### Similar Cases
${parsed.data.relationships.similarCases ? parsed.data.relationships.similarCases.map(case_ => `- [[${case_}]]`).join("\n") : ""}

### Related Patterns
${parsed.data.relationships.relatedPatterns ? parsed.data.relationships.relatedPatterns.map(pattern => `- [[${pattern}]]`).join("\n") : ""}

### Connected Insights
${parsed.data.relationships.connectedInsights ? parsed.data.relationships.connectedInsights.map(insight => `- [[${insight}]]`).join("\n") : ""}`

      await fs.mkdir(path.dirname(validPath), { recursive: true })
      await fs.writeFile(validPath, content, "utf-8")

      return {
        content: [
          {
            type: "text",
            text: `Successfully created training example note at ${normalizedPath}`,
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create training example note: ${errorMessage}`)
    }
  }

  async queryPatterns(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('query_patterns')
    const parsed = QueryPatternsArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for query_patterns: ${parsed.error}`)
    }

    try {
      // Build query parameters for each note type
      const queries = parsed.data.noteTypes.map(type => ({
        from: type,
        where: {
          ...(parsed.data.timeRange?.start && { date: { $gte: parsed.data.timeRange.start } }),
          ...(parsed.data.timeRange?.end && { date: { $lte: parsed.data.timeRange.end } }),
          ...(parsed.data.categories?.length && { 'metadata.trainingCategory': { $in: parsed.data.categories } }),
          ...(parsed.data.metadata?.patterns?.length && { 'metadata.patterns': { $containsAny: parsed.data.metadata.patterns } }),
          ...(parsed.data.metadata?.clusters?.length && { 'metadata.clusters': { $containsAny: parsed.data.metadata.clusters } })
        },
        fields: ['title', 'date', 'metadata', 'type'],
        format: "table" as const
      }))

      // Execute queries and combine results
      const results = await Promise.all(
        queries.map(async query => {
          const result = await executeQuery(this.vaultRoot, query)
          return result
        })
      )

      // Process results to identify patterns
      const patterns = {
        behavioral: new Map<string, number>(),
        tool: new Map<string, number>(),
        success: new Map<string, number>()
      }

      // Count pattern occurrences
      results.forEach(result => {
        const notes = JSON.parse(result)
        notes.forEach((note: any) => {
          if (note.metadata?.patterns) {
            note.metadata.patterns.forEach((pattern: string) => {
              if (pattern.startsWith('behavior:')) {
                const count = patterns.behavioral.get(pattern) || 0
                patterns.behavioral.set(pattern, count + 1)
              } else if (pattern.startsWith('tool:')) {
                const count = patterns.tool.get(pattern) || 0
                patterns.tool.set(pattern, count + 1)
              } else if (pattern.startsWith('success:')) {
                const count = patterns.success.get(pattern) || 0
                patterns.success.set(pattern, count + 1)
              }
            })
          }
        })
      })

      // Filter patterns by minimum occurrences
      const minOccurrences = parsed.data.minOccurrences || 1
      const formatPatterns = (patternMap: Map<string, number>) => 
        Array.from(patternMap.entries())
          .filter(([_, count]) => count >= minOccurrences)
          .sort((a, b) => b[1] - a[1])
          .map(([pattern, count]) => `${pattern} (${count} occurrences)`)
          .join('\n')

      const output = `# Pattern Analysis

## Behavioral Patterns
${formatPatterns(patterns.behavioral) || '- No patterns found'}

## Tool Usage Patterns
${formatPatterns(patterns.tool) || '- No patterns found'}

## Success Patterns
${formatPatterns(patterns.success) || '- No patterns found'}`

      return {
        content: [{
          type: "text",
          text: output
        }]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to query patterns: ${errorMessage}`)
    }
  }

  async listTemplates(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('list_templates')
    try {
      const templatesDir = path.join(this.vaultRoot, "templates")
      const files = await fs.readdir(templatesDir)
      const templates = files.filter(file => file.endsWith('.md'))
      return {
        content: [{ type: "text", text: templates.join('\n') }]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to list templates: ${errorMessage}`)
    }
  }

  async searchNotes(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('search_notes')
    const parsed = z.object({
      pattern: z.string(),
      caseSensitive: z.boolean().optional()
    }).safeParse(args)

    if (!parsed.success) {
      throw new Error(`Invalid arguments for search_notes: ${parsed.error}`)
    }

    try {
      const flags = parsed.data.caseSensitive ? '' : 'i'
      const regex = new RegExp(parsed.data.pattern, flags)
      const results: string[] = []

      const searchDir = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          
          if (entry.isDirectory()) {
            await searchDir(fullPath)
          } else if (entry.name.endsWith('.md')) {
            const content = await fs.readFile(fullPath, 'utf-8')
            if (regex.test(content)) {
              const relativePath = path.relative(this.vaultRoot, fullPath)
              results.push(`${relativePath}:\n${content}\n`)
            }
          }
        }
      }

      await searchDir(this.vaultRoot)

      return {
        content: [{ type: "text", text: results.join('\n---\n') }]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to search notes: ${errorMessage}`)
    }
  }

  async createFromTemplate(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('create_from_template')
    const parsed = z.object({
      template: z.string(),
      path: z.string(),
      variables: z.record(z.string()).optional()
    }).safeParse(args)
    
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_from_template: ${parsed.error}`)
    }

    try {
      // Read the template content
      const templateContent = await readTemplate(this.vaultRoot, parsed.data.template)
      
      // Substitute variables if provided
      const processedContent = parsed.data.variables 
        ? substituteVariables(templateContent, parsed.data.variables)
        : templateContent

      // Normalize the note path and join with vault directory
      const normalizedPath = normalizeNotePath(parsed.data.path)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(validPath), { recursive: true })
      
      // Write the processed content
      await fs.writeFile(validPath, processedContent, "utf-8")

      return {
        content: [
          {
            type: "text",
            text: `Successfully created note from template at ${normalizedPath}`
          }
        ]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create note from template: ${errorMessage}`)
    }
  }

  async queryNotes(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.validateModeAccess('query_notes')
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
