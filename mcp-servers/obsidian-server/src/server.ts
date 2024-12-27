import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { TOOL_DEFINITIONS } from "./schemas.js"
import { ToolHandlers } from "./tool-handlers.js"
import { normalizePath, expandHome } from "./utils.js"
import fs from "fs/promises"
import path from "path"

export class ObsidianServer {
  private server: Server
  private toolHandlers: ToolHandlers

  constructor(private vaultDirectories: string[]) {
    this.server = new Server(
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

    this.toolHandlers = new ToolHandlers(vaultDirectories[0])

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
      tools: Object.values(TOOL_DEFINITIONS),
    }))

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        switch (name) {
          case "create_daily_log":
            return await this.toolHandlers.createDailyLog(args)
          case "create_insight":
            return await this.toolHandlers.createInsight(args)
          case "create_reflection":
            return await this.toolHandlers.createReflection(args)
          case "list_templates":
            return await this.toolHandlers.listTemplates(args)
          case "create_from_template":
            return await this.toolHandlers.createFromTemplate(args)
          case "read_notes":
            return await this.toolHandlers.readNotes(args)
          case "search_notes":
            return await this.toolHandlers.searchNotes(args)
          case "write_note":
            return await this.toolHandlers.writeNote(args)
          case "query_notes":
            return await this.toolHandlers.queryNotes(args)
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
