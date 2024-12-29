import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
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
          case "create_reflection":
            return await this.toolHandlers.createReflection(args)
          case "create_daily_log":
            return await this.toolHandlers.createDailyLog(args)
          case "create_insight":
            return await this.toolHandlers.createInsight(args)
          case "read_notes":
            return await this.toolHandlers.readNotes(args)
          case "search_notes":
            return await this.toolHandlers.searchNotes(args)
          case "query_notes":
            return await this.toolHandlers.queryNotes(args)
          case "discover_vault":
            return await this.toolHandlers.discoverVault(args)
          case "create_goal":
            return await this.toolHandlers.createGoal(args)
          case "create_habit":
            return await this.toolHandlers.createHabit(args)
          case "update_goal_status":
            return await this.toolHandlers.updateGoalStatus(args)
          case "update_habit_tracking":
            return await this.toolHandlers.updateHabitTracking(args)
          case "create_metric_note":
            return await this.toolHandlers.createMetricNote(args)
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
