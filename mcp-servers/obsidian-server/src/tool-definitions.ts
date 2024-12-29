import { z } from "zod";
import {
  ReadNotesArgsSchema,
  QueryNotesArgsSchema,
  CreateGoalSchema,
  CreateHabitSchema,
  CreateHealthMetricSchema,
  CreateJournalSchema
} from "./schemas.js";

export const toolDefinitions = {
  get_help: {
    name: "get_help",
    description: "Get detailed documentation for any tool including field descriptions, examples, and usage patterns. Required: tool_name:string (name of tool to get help for)",
    inputSchema: z.object({
      tool_name: z.string()
    })
  },
  set_tag_hierarchy: {
    name: "set_tag_hierarchy",
    description: "Set parent-child relationships between tags. Required: tag:str\nOptional: parent:str, children:str[]",
    inputSchema: z.object({
      tag: z.string(),
      parent: z.string().optional(),
      children: z.array(z.string()).optional()
    })
  },
  set_tag_relationship: {
    name: "set_tag_relationship",
    description: "Set relationship between tags. Required: tag:str, relatedTag:str, type:('similar'|'opposite'|'broader'|'narrower'|'custom')\nOptional: strength:number(1-5)",
    inputSchema: z.object({
      tag: z.string(),
      relatedTag: z.string(),
      type: z.enum(['similar', 'opposite', 'broader', 'narrower', 'custom']),
      strength: z.number().min(1).max(5).optional()
    })
  },
  get_tag_stats: {
    name: "get_tag_stats",
    description: "Get statistics about tags including usage counts and hierarchies",
    inputSchema: z.object({})
  },
  read_notes: {
    name: "read_notes", 
    description: "Reads notes. Required: paths[]:str[] (relative paths with .md)",
    inputSchema: ReadNotesArgsSchema
  },
  search_notes: {
    name: "search_notes",
    description: "Searches notes. Required: pattern:regex\nOptional: caseSensitive:bool, maxMatches:num=3, contextLines:num=2, filePattern:regex",
    inputSchema: z.object({
      pattern: z.string(),
      caseSensitive: z.boolean().optional(),
      maxMatchesPerFile: z.number().optional(),
      contextLines: z.number().optional(),
      filePattern: z.string().optional()
    })
  },
  create_journal: {
    name: "create_journal",
    description: "Creates journal entry. Required: title:str, date:str, content:str\nOptional: type:('reflection'|'health'|'activity'|'misc'), mood:1-5, energy:1-5, metrics:[{name:str, value:num|str, unit?:str}], links:[{source:str, target:str, type:str}], metadata:{...}, versions:[{...}]",
    inputSchema: CreateJournalSchema
  },
  query_notes: {
    name: "query_notes",
    description: "Queries notes using Dataview. Required: query:str (e.g. 'FROM \"insights\" WHERE status=active')",
    inputSchema: QueryNotesArgsSchema
  },
  discover_vault: {
    name: "discover_vault",
    description: "Analyzes vault structure and available fields",
    inputSchema: z.object({})
  },
  create_goal: {
    name: "create_goal",
    description: "Creates goal. Required: title:str, description:str, type:('outcome'|'process'|'identity'), metrics[]\nOptional groups:\n" +
      "Context: targetDate:str, relatedHabits[], identity:str\n" +
      "Metadata: priority:('low'|'medium'|'high'), tags[], privacyLevel:str",
    inputSchema: CreateGoalSchema
  },
  create_habit: {
    name: "create_habit",
    description: "Creates habit. Required: title:str, description:str, type:('build'|'break'), cue:str, craving:str, response:str, reward:str, implementation:{frequency:str}\nOptional groups:\n" +
      "Implementation: timeOfDay:str, location:str, duration:str\n" +
      "Stacking: before[], after[]\n" +
      "Metadata: difficulty:1-5, tags[], privacyLevel:str",
    inputSchema: CreateHabitSchema
  },
  update_goal_status: {
    name: "update_goal_status",
    description: "Updates goal. Required: title:str, update_type:('progress'|'reflection'|'status')\nFields by type:\n" +
      "progress: value:num, notes?:str\n" +
      "reflection: content:str, insights?[]\n" +
      "status: new_status:('active'|'completed'|'abandoned')",
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
  update_habit_tracking: {
    name: "update_habit_tracking",
    description: "Updates habit. Required: title:str, update_type:('completion'|'obstacle'|'adaptation')\nFields by type:\n" +
      "completion: completed:bool, notes?:str\n" +
      "obstacle: description:str, solution?:str\n" +
      "adaptation: change:str, reason:str, outcome?:str",
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
  },
  create_health_metric: {
    name: "create_health_metric",
    description: "Creates health metric entry.\nRequired:\n- title:str\n- date:str\n- type:('weight'|'blood_pressure'|'sleep'|'pain'|'medication'|'custom')\n- values:[{name:str, value:num|str, unit?:str}]\n- metadata:{created:str, modified:str, privacyLevel:('public'|'private'|'sensitive')}\nOptional:\n- note:str\n- links:[{source:str, target:str, type:str}]\n- versions:[{...}]",
    inputSchema: CreateHealthMetricSchema
  }
};

export const toolHelp: Record<string, string> = {
  create_goal: `# Create Goal Tool Documentation

Required Fields:
---------------
- title: string
  Goal title/name

- description: string
  Detailed description of the goal

- type: "outcome" | "process" | "identity"
  The type of goal being created

- metrics: Array of:
  * name: string - Name of the metric
  * target: number|string - Target value
  * unit?: string - Optional unit of measurement
  * current?: number|string - Optional current value

- metadata:
  * created: string - ISO timestamp (YYYY-MM-DDTHH:mm:ssZ)
  * modified: string - ISO timestamp (YYYY-MM-DDTHH:mm:ssZ)
  * priority: "low" | "medium" | "high"
  * tags: string[] - Array of relevant tags
  * privacyLevel: "public" | "private" | "sensitive"

Optional Fields:
---------------
- targetDate?: string
  Target completion date

- progress?: Array of:
  * date: string
  * value: number|string
  * notes?: string

- links?: Array of:
  * source: string
  * target: string
  * type: string
  * label?: string

Example Usage:
-------------
{
  "title": "Learn TypeScript",
  "description": "Master TypeScript for better code quality",
  "type": "outcome",
  "metrics": [{
    "name": "projects_completed",
    "target": 5,
    "unit": "projects"
  }],
  "metadata": {
    "created": "2024-12-29T12:00:00Z",
    "modified": "2024-12-29T12:00:00Z",
    "priority": "high",
    "tags": ["programming", "skills"],
    "privacyLevel": "public"
  }
}`
  // The help text for the remaining tools are found in tool-help/index.ts
};
