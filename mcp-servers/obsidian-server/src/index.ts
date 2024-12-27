#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

// Maximum number of search results to return
const SEARCH_LIMIT = 200

// Command line argument parsing
const args = process.argv.slice(2)
if (args.length === 0) {
  console.error("Usage: mcp-obsidian <vault-directory>")
  process.exit(1)
}

// Normalize all paths consistently
function normalizePath(p: string): string {
  // Convert to forward slashes and lowercase
  return path.normalize(p).replace(/\\/g, '/').toLowerCase()
}

// Handle relative paths within vault
function normalizeNotePath(notePath: string): string {
  // Remove leading slashes and normalize
  return notePath.replace(/^[/\\]+/, '').replace(/\\/g, '/')
}

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return path.join(os.homedir(), filepath.slice(1))
  }
  return filepath
}

// Store allowed directories in normalized form
const vaultDirectories = [normalizePath(path.resolve(expandHome(args[0])))]

// Create directories if they don't exist and validate accessibility
await Promise.all(
  args.map(async (dir) => {
    try {
      await fs.mkdir(dir, { recursive: true })
      const stats = await fs.stat(dir)
      if (!stats.isDirectory()) {
        console.error(`Error: ${dir} is not a directory`)
        process.exit(1)
      }
    } catch (error) {
      console.error(`Error creating/accessing directory ${dir}:`, error)
      process.exit(1)
    }
  })
)

// Security utilities
async function validatePath(requestedPath: string): Promise<string> {
  // Ignore hidden files/directories starting with "."
  const pathParts = requestedPath.split(path.sep)
  if (pathParts.some((part) => part.startsWith("."))) {
    throw new Error("Access denied - hidden files/directories not allowed")
  }

  const expandedPath = expandHome(requestedPath)
  const absolute = path.isAbsolute(expandedPath)
    ? path.resolve(expandedPath)
    : path.resolve(process.cwd(), expandedPath)

  const normalizedRequested = normalizePath(absolute)

  // Check if path is within allowed directories
  const isAllowed = vaultDirectories.some((dir) =>
    normalizedRequested.startsWith(dir)
  )
  if (!isAllowed) {
    throw new Error(
      `Access denied - path outside allowed directories: ${absolute} not in ${vaultDirectories.join(
        ", "
      )}`
    )
  }

  // Create parent directory if it doesn't exist
  const parentDir = path.dirname(absolute)
  await fs.mkdir(parentDir, { recursive: true })

  // Handle symlinks by checking their real path
  try {
    const realPath = await fs.realpath(absolute)
    const normalizedReal = normalizePath(realPath)
    const isRealPathAllowed = vaultDirectories.some((dir) =>
      normalizedReal.startsWith(dir)
    )
    if (!isRealPathAllowed) {
      throw new Error(
        "Access denied - symlink target outside allowed directories"
      )
    }
    return realPath
  } catch (error) {
    // For new files that don't exist yet, return the absolute path
    return absolute
  }
}

// Schema definitions
const ReadNotesArgsSchema = z.object({
  paths: z.array(z.string()),
})

const SearchNotesArgsSchema = z.object({
  query: z.string(),
})

const WriteNoteArgsSchema = z.object({
  path: z.string(),
  content: z.string(),
})

const ListTemplatesArgsSchema = z.object({
  folder: z.string().optional(),
})

const CreateFromTemplateArgsSchema = z.object({
  templateName: z.string(),
  notePath: z.string(),
  variables: z.record(z.string()).optional(),
})

const CreateInsightArgsSchema = z.object({
  title: z.string(),
  relatedTo: z.array(z.string()).optional(),
  description: z.string().optional(),
  impact: z.array(z.string()).optional(),
  actionItems: z.array(z.string()).optional(),
  relatedInsights: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
})

const CreateReflectionArgsSchema = z.object({
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

const ToolInputSchema = ToolSchema.shape.inputSchema
type ToolInput = z.infer<typeof ToolInputSchema>

// Template utilities
async function listTemplates(folder?: string): Promise<string[]> {
  const templatesPath = path.join(vaultDirectories[0], 'templates', folder || '')
  try {
    await validatePath(templatesPath)
    const entries = await fs.readdir(templatesPath, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
      .map(entry => folder ? path.join(folder, entry.name) : entry.name)
  } catch (error) {
    console.error('Error listing templates:', error)
    return []
  }
}

async function readTemplate(templateName: string): Promise<string> {
  const templatePath = path.join(vaultDirectories[0], 'templates', templateName)
  try {
    await validatePath(templatePath)
    return await fs.readFile(templatePath, 'utf-8')
  } catch (error) {
    throw new Error(`Failed to read template ${templateName}: ${error}`)
  }
}

function substituteVariables(content: string, variables?: Record<string, string>): string {
  if (!variables) return content
  
  return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim()
    if (trimmedKey === 'date') {
      return new Date().toISOString().split('T')[0]
    }
    return variables[trimmedKey] || match
  })
}

// Server setup
const server = new Server(
  {
    name: "mcp-obsidian",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

/**
 * Search for notes in the allowed directories that match the query.
 * @param query - The query to search for.
 * @returns An array of relative paths to the notes (from root) that match the query.
 */
async function searchNotes(query: string): Promise<string[]> {
  const results: string[] = []

  async function search(basePath: string, currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)

      try {
        // Validate each path before processing
        await validatePath(fullPath)

        let matches = entry.name.toLowerCase().includes(query.toLowerCase())
        try {
          matches =
            matches ||
            new RegExp(query.replace(/[*]/g, ".*"), "i").test(entry.name)
        } catch {
          // Ignore invalid regex
        }

        if (entry.name.endsWith(".md") && matches) {
          // Turn into relative path
          // Ensure we get a clean relative path
          const relativePath = path.relative(basePath, fullPath)
          results.push(normalizeNotePath(relativePath))
        }

        if (entry.isDirectory()) {
          await search(basePath, fullPath)
        }
      } catch (error) {
        // Skip invalid paths during search
        continue
      }
    }
  }

  await Promise.all(vaultDirectories.map((dir) => search(dir, dir)))
  return results
}

// Tool definitions
const TOOL_DEFINITIONS = {
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
  create_reflection: {
    name: "create_reflection",
    description: "Creates a new reflection note using the reflection template with YAML frontmatter. The note will be created in the reflections directory. The date, period, and other metadata are automatically added to the frontmatter.",
    inputSchema: zodToJsonSchema(CreateReflectionArgsSchema) as ToolInput,
  },
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.values(TOOL_DEFINITIONS),
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params

    switch (name) {
      case "create_insight": {
        const parsed = CreateInsightArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for create_insight: ${parsed.error}`)
        }

        try {
          // Read the insight template
          const templateContent = await readTemplate('insight.md')
          
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
          const fullPath = path.join(vaultDirectories[0], normalizedPath)
          const validPath = await validatePath(fullPath)

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

      case "create_reflection": {
        const parsed = CreateReflectionArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for create_reflection: ${parsed.error}`)
        }

        try {
          // Read the reflection template
          const templateContent = await readTemplate('reflection.md')
          
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
          const fullPath = path.join(vaultDirectories[0], normalizedPath)
          const validPath = await validatePath(fullPath)

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

      case "list_templates": {
        const parsed = ListTemplatesArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for list_templates: ${parsed.error}`)
        }
        
        const templates = await listTemplates(parsed.data.folder)
        return {
          content: [
            {
              type: "text",
              text: templates.length > 0 ? templates.join("\n") : "No templates found",
            },
          ],
        }
      }

      case "create_from_template": {
        const parsed = CreateFromTemplateArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for create_from_template: ${parsed.error}`)
        }

        try {
          const templateContent = await readTemplate(parsed.data.templateName)
          const filledContent = substituteVariables(templateContent, parsed.data.variables)
          
          // Use write_note functionality to create the file
          const normalizedPath = normalizeNotePath(parsed.data.notePath)
          const fullPath = path.join(vaultDirectories[0], normalizedPath)
          const validPath = await validatePath(fullPath)

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

      case "read_notes": {
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
                path.join(vaultDirectories[0], normalizedPath)
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
      case "search_notes": {
        const parsed = SearchNotesArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for search_notes: ${parsed.error}`)
        }
        const results = await searchNotes(parsed.data.query)

        const limitedResults = results.slice(0, SEARCH_LIMIT)
        return {
          content: [
            {
              type: "text",
              text:
                (limitedResults.length > 0
                  ? limitedResults.join("\n")
                  : "No matches found") +
                (results.length > SEARCH_LIMIT
                  ? `\n\n... ${
                      results.length - SEARCH_LIMIT
                    } more results not shown.`
                  : ""),
            },
          ],
        }
      }
      case "write_note": {
        const parsed = WriteNoteArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for write_note: ${parsed.error}`)
        }

        try {
          // Normalize the note path and join with vault directory
          const normalizedPath = normalizeNotePath(parsed.data.path)
          const fullPath = path.join(vaultDirectories[0], normalizedPath)
          const validPath = await validatePath(fullPath)

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
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    }
  }
})

// Start server
async function runServer() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("MCP Obsidian Server running on stdio")
  console.error("Allowed directories:", vaultDirectories)
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error)
  process.exit(1)
})
