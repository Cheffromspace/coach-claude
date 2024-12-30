import { z } from "zod";
import { MCPPlugin, ToolDefinition } from "../../core/interfaces.js";
import { HelpManager } from "./help-manager.js";
import { GetToolHelpSchema, ToolHelp } from "./types.js";

/**
 * Plugin that provides detailed help information for tools
 */
export default class ToolHelpPlugin implements MCPPlugin {
  name = "tool-help";
  version = "1.0.0";
  description = "Provides detailed help information for MCP tools";

  private helpManager: HelpManager;

  constructor() {
    this.helpManager = new HelpManager();
  }

  async onLoad(): Promise<void> {
    this.helpManager.registerPluginHelp(this, {
      "get_tool_help": {
        summary: "Get detailed help information for any tool",
        description: "Retrieves comprehensive documentation for a specified tool, including description, examples, and usage information.",
        examples: [
          'Get help for a tool: {"toolName": "create_note"}'
        ],
        sections: [
          {
            title: "Arguments",
            content: "An object containing `toolName`: the name of the tool to get help for"
          },
          {
            title: "Returns",
            content: "Detailed help information including description, examples, and any additional documentation"
          }
        ]
      }
    });
  }

  async onUnload(): Promise<void> {
    // No cleanup needed
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "get_tool_help",
        description: "Get detailed help information for any tool",
        inputSchema: z.object({
          toolName: z.string().describe("The name of the tool to get help for")
        })
      }
    ];
  }

  async handleToolCall(toolName: string, args: unknown): Promise<any> {
    if (toolName !== "get_tool_help") {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const { toolName: requestedTool } = await GetToolHelpSchema.parseAsync(args);
    const help = this.helpManager.getToolHelp(requestedTool);

    if (!help) {
      throw new Error(
        `No help found for tool '${requestedTool}'`
      );
    }

    return {
      content: [{
        type: "text",
        text: this.helpManager.formatHelpText(help)
      }]
    };
  }

  /**
   * Public method for other plugins to register their tool help information
   */
  registerPluginHelp(plugin: MCPPlugin, help: Record<string, ToolHelp>) {
    this.helpManager.registerPluginHelp(plugin, help);
  }

  /**
   * Public method to format error messages with help information
   */
  formatErrorHelp(toolName: string, pluginName: string | undefined, error: Error): string {
    return this.helpManager.formatErrorHelp(toolName, pluginName, error);
  }
}
