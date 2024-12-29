import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

/**
 * ObsidianServer implements the MCP server interface for Obsidian vault operations.
 * 
 * Note on naming conventions:
 * - Tool method names use snake_case to align with MCP protocol conventions
 * - Class names and internal TypeScript methods follow standard TypeScript camelCase
 * - This ensures consistency with MCP standards while maintaining TypeScript best practices
 */
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { ToolHandlers } from "./tool-handlers.js"
import { normalizePath, expandHome } from "./utils.js"
import fs from "fs/promises"
import path from "path"

export class ObsidianServer {
  private server: Server
  private toolHandlers: ToolHandlers

  constructor(private vaultDirectories: string[]) {
    this.toolHandlers = new ToolHandlers(vaultDirectories[0])

    this.server = new Server(
      {
        name: "mcp-obsidian",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: this.toolHandlers.getToolDefinitions(),
        },
      }
    )

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error)
    process.on('SIGINT', async () => {
      await this.server.close()
      process.exit(0)
    })

    this.setupRequestHandlers()
  }

  private setupRequestHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.values(this.toolHandlers.getToolDefinitions()),
    }))

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        switch (name) {
          case "create_journal":
            return await this.toolHandlers.create_journal(args)
          case "read_notes":
            return await this.toolHandlers.read_notes(args)
          case "search_notes":
            return await this.toolHandlers.search_notes(args)
          case "query_notes":
            return await this.toolHandlers.query_notes(args)
          case "discover_vault":
            return await this.toolHandlers.discover_vault(args)
          case "create_goal":
            return await this.toolHandlers.create_goal(args)
          case "create_habit":
            return await this.toolHandlers.create_habit(args)
          case "update_goal_status":
            return await this.toolHandlers.update_goal_status(args)
          case "update_habit_tracking":
            return await this.toolHandlers.update_habit_tracking(args)
          case "create_health_metric":
            return await this.toolHandlers.create_health_metric(args)
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
  }

  async validateAndCreateDirectories() {
    await Promise.all(
      this.vaultDirectories.map(async (dir) => {
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
  }

  async run() {
    await this.validateAndCreateDirectories()
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error("MCP Obsidian Server running on stdio")
    console.error("Allowed directories:", this.vaultDirectories)
  }
}
