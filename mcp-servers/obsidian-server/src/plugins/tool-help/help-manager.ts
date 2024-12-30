import { ToolHelp, ToolHelpStore } from "./types.js";
import { MCPPlugin } from "../../core/interfaces.js";

export class HelpManager {
  private helpStore: ToolHelpStore = {};

  registerPluginHelp(plugin: MCPPlugin, help: Record<string, ToolHelp>) {
    this.helpStore[plugin.name] = help;
  }

  getToolHelp(toolName: string, pluginName?: string): ToolHelp | undefined {
    if (pluginName) {
      return this.helpStore[pluginName]?.[toolName];
    }

    // Search all plugins if plugin name not specified
    for (const plugin of Object.values(this.helpStore)) {
      const help = plugin[toolName];
      if (help) {
        return help;
      }
    }
    return undefined;
  }

  getAllHelp(): ToolHelpStore {
    return this.helpStore;
  }

  formatHelpText(help: ToolHelp): string {
    let text = `${help.summary}\n\n`;
    text += `Description:\n${help.description}\n\n`;
    
    if (help.examples.length > 0) {
      text += "Examples:\n";
      help.examples.forEach((example, i) => {
        text += `${i + 1}. ${example}\n`;
      });
      text += "\n";
    }

    if (help.sections?.length) {
      help.sections.forEach(section => {
        text += `${section.title}:\n${section.content}\n\n`;
      });
    }

    return text.trim();
  }

  formatErrorHelp(toolName: string, pluginName: string | undefined, error: Error): string {
    const help = this.getToolHelp(toolName, pluginName);
    if (!help) {
      return `Error: ${error.message}\n\nNo additional help available for tool '${toolName}'`;
    }

    return [
      `Error: ${error.message}`,
      "",
      "Tool Help:",
      this.formatHelpText(help)
    ].join("\n");
  }
}
