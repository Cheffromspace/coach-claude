import { z } from "zod";
import { MCPPlugin, ToolDefinition, ServerConfig } from "../../core/interfaces.js";
import CorePlugin from "../core/index.js";
import { NoteHandlers } from "./note-handlers.js";

/**
 * Coaching plugin providing goal and habit tracking functionality
 */
export default class CoachingPlugin implements MCPPlugin {
  name = "coaching";
  version = "1.0.0";
  description = "Coaching functionality including goals and habits";

  private config: ServerConfig;
  private corePlugin: CorePlugin;
  private noteHandlers: NoteHandlers;

  constructor(config: ServerConfig, corePlugin: CorePlugin) {
    this.config = config;
    this.corePlugin = corePlugin;
    this.noteHandlers = new NoteHandlers(config.vaultDirectories[0]);
  }

  async onLoad(): Promise<void> {
    console.error('Coaching plugin loaded');
  }

  async onUnload(): Promise<void> {
    console.error('Coaching plugin unloaded');
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "create_journal",
        description: "Create a new journal entry",
        inputSchema: z.object({
          title: z.string(),
          date: z.string(),
          content: z.string(),
          type: z.enum(['reflection', 'health', 'activity', 'misc']).default('misc'),
          mood: z.number().min(1).max(5).optional(),
          energy: z.number().min(1).max(5).optional(),
          metrics: z.array(z.object({
            name: z.string(),
            value: z.union([z.number(), z.string()]),
            unit: z.string().optional()
          })).default([]),
          links: z.array(z.object({
            type: z.string(),
            target: z.string(),
            label: z.string().optional()
          })).default([]),
          metadata: z.object({
            privacyLevel: z.enum(['public', 'private', 'sensitive']),
            tags: z.array(z.string()).default([])
          })
        })
      },
      {
        name: "create_goal",
        description: "Create a new goal",
        inputSchema: z.object({
          title: z.string(),
          description: z.string(),
          type: z.string(),
          targetDate: z.string().optional(),
          metrics: z.array(z.object({
            name: z.string(),
            target: z.number(),
            current: z.number().optional(),
            unit: z.string().optional()
          })),
          progress: z.array(z.object({
            date: z.string(),
            value: z.number(),
            notes: z.string().optional()
          })).optional(),
          links: z.array(z.object({
            type: z.string(),
            target: z.string(),
            label: z.string().optional()
          })).optional(),
          metadata: z.object({
            priority: z.number().min(1).max(5),
            tags: z.array(z.string()),
            privacyLevel: z.number().min(1).max(5)
          })
        })
      },
      {
        name: "create_habit",
        description: "Create a new habit",
        inputSchema: z.object({
          title: z.string(),
          description: z.string(),
          type: z.string(),
          cue: z.string(),
          craving: z.string(),
          response: z.string(),
          reward: z.string(),
          implementation: z.object({
            frequency: z.string(),
            timeOfDay: z.string().optional(),
            duration: z.string().optional(),
            location: z.string().optional()
          }),
          metadata: z.object({
            difficulty: z.number().min(1).max(5).optional(),
            tags: z.array(z.string()).optional()
          }).optional()
        })
      },
      {
        name: "update_goal_status",
        description: "Update goal status or progress",
        inputSchema: z.object({
          title: z.string(),
          update_type: z.enum(['progress', 'reflection', 'status']),
          value: z.number().optional(),
          notes: z.string().optional(),
          content: z.string().optional(),
          insights: z.array(z.string()).optional(),
          new_status: z.enum(['active', 'completed', 'abandoned']).optional()
        })
      },
      {
        name: "update_habit_tracking",
        description: "Update habit tracking information",
        inputSchema: z.object({
          title: z.string(),
          update_type: z.enum(['completion', 'obstacle', 'adaptation']),
          completed: z.boolean().optional(),
          notes: z.string().optional(),
          description: z.string().optional(),
          solution: z.string().optional(),
          change: z.string().optional(),
          reason: z.string().optional(),
          outcome: z.string().optional()
        })
      }
    ];
  }

  async handleToolCall(toolName: string, args: unknown): Promise<any> {
    switch (toolName) {
      case "create_journal":
        return this.noteHandlers.createJournal(args);
      case "create_goal":
        return this.noteHandlers.createGoal(args);
      case "create_habit":
        return this.noteHandlers.createHabit(args);
      case "create_health_metric":
        return this.noteHandlers.createHealthMetric(args);
      case "update_goal_status":
        return this.noteHandlers.updateGoalStatus(args);
      case "update_habit_tracking":
        return this.noteHandlers.updateHabitTracking(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
