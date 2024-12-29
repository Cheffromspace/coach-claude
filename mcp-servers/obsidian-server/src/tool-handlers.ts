import { TagManager } from "./tag-manager.js";
import { TagHandlers } from "./handlers/tag-handlers.js";
import { SearchHandlers } from "./handlers/search-handlers.js";
import { NoteHandlers } from "./handlers/note-handlers.js";
import { toolDefinitions, toolHelp } from "./tool-definitions.js";
import { ToolResponse } from "./types.js";

export class ToolHandlers {
  private tagHandlers: TagHandlers;
  private searchHandlers: SearchHandlers;
  private noteHandlers: NoteHandlers;

  constructor(private vaultRoot: string) {
    const tagManager = new TagManager();
    // Initialize tag manager
    tagManager.initialize(vaultRoot).catch(error => {
      console.error("Failed to initialize tag manager:", error);
    });

    this.tagHandlers = new TagHandlers(tagManager);
    this.searchHandlers = new SearchHandlers(vaultRoot);
    this.noteHandlers = new NoteHandlers(vaultRoot);
  }

  getToolDefinitions() {
    return toolDefinitions;
  }

  async get_help(args: unknown): Promise<ToolResponse> {
    const parsed = toolDefinitions.get_help.inputSchema.safeParse(args);

    if (!parsed.success) {
      const errors = parsed.error.errors.map(err => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for get_help:\n${errors}\n\nTool requires a single string argument 'tool_name' specifying which tool to get help for.`);
    }

    return {
      content: [{
        type: "text",
        text: toolHelp[parsed.data.tool_name] || `No detailed help available for tool: ${parsed.data.tool_name}`
      }]
    };
  }

  // Tag-related tools
  async set_tag_relationship(args: unknown): Promise<ToolResponse> {
    return this.tagHandlers.setTagRelationship(args);
  }

  async set_tag_hierarchy(args: unknown): Promise<ToolResponse> {
    return this.tagHandlers.setTagHierarchy(args);
  }

  async get_tag_stats(args: unknown): Promise<ToolResponse> {
    return this.tagHandlers.getTagStats(args);
  }

  // Search and query tools
  async read_notes(args: unknown): Promise<ToolResponse> {
    return this.searchHandlers.readNotes(args);
  }

  async search_notes(args: unknown): Promise<ToolResponse> {
    return this.searchHandlers.searchNotes(args);
  }

  async query_notes(args: unknown): Promise<ToolResponse> {
    return this.searchHandlers.queryNotes(args);
  }

  async discover_vault(args: unknown): Promise<ToolResponse> {
    return this.searchHandlers.discoverVault(args);
  }

  // Note creation and management tools
  async create_journal(args: unknown): Promise<ToolResponse> {
    return this.noteHandlers.createJournal(args);
  }

  async create_goal(args: unknown): Promise<ToolResponse> {
    return this.noteHandlers.createGoal(args);
  }

  async create_habit(args: unknown): Promise<ToolResponse> {
    return this.noteHandlers.createHabit(args);
  }

  async create_health_metric(args: unknown): Promise<ToolResponse> {
    return this.noteHandlers.createHealthMetric(args);
  }

  async update_goal_status(args: unknown): Promise<ToolResponse> {
    return this.noteHandlers.updateGoalStatus(args);
  }

  async update_habit_tracking(args: unknown): Promise<ToolResponse> {
    return this.noteHandlers.updateHabitTracking(args);
  }
}
