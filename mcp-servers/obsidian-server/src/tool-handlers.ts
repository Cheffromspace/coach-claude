import { z } from "zod"
import fs from "fs/promises"
import path from "path"
import {
  validatePath,
  normalizeNotePath,
  readNote
} from "./utils.js"
import {
  CreateDailyLogSchema,
  CreateInsightSchema,
  CreateReflectionSchema,
  ReadNotesArgsSchema,
  QueryNotesArgsSchema,
  CreateGoalSchema,
  CreateHabitSchema
} from "./schemas.js"
import { parseDataviewQuery, executeQuery, getMarkdownFiles } from "./query-engine.js"

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
  constructor(private vaultRoot: string) {}

  getToolDefinitions() {
    return {
      create_reflection: {
        name: "create_reflection",
        description: "Creates a reflection note analyzing progress and insights. Required: title (string), period (string), progress_rating (1-5). Optional fields in groups:\n" +
          "- Context: focus_areas[], tags[], status ('active'|'completed'|'archived')\n" +
          "- Analysis: key_observations[], progress_analysis[], challenges[], insights[]\n" +
          "- Patterns: behavioral[], tool_usage[], success[], growth_trajectory[]\n" +
          "- Planning: strategy_evolution[], action_items[]\n" +
          "- References: supporting_evidence[], connected_insights[], similar_patterns[], references[]",
        example: {
          title: "Q1 2024 Progress Review",
          period: "2024 Q1",
          progress_rating: 4,
          focus_areas: ["Tool Development", "Pattern Recognition"],
          status: "active",
          metadata: {
            effectiveness: 4,
            trainingCategory: "pattern"
          }
        },
        inputSchema: CreateReflectionSchema
      },
      read_notes: {
        name: "read_notes",
        description: "Reads full content of specified notes. Required: paths[] (note paths relative to vault root, include .md extension)",
        example: {
          paths: [
            "daily_logs/2024-03-19.md",
            "insights/problem-solving-pattern.md"
          ]
        },
        inputSchema: ReadNotesArgsSchema
      },
      search_notes: {
        name: "search_notes",
        description: "Searches all markdown files using regex. Required: pattern (regex string). Optional: caseSensitive (boolean, default false). Returns matches with context.",
        example: {
          pattern: "\\b(API|REST)\\b",
          caseSensitive: true
        },
        inputSchema: z.object({
          pattern: z.string(),
          caseSensitive: z.boolean().optional()
        })
      },
      create_daily_log: {
        name: "create_daily_log",
        description: "Creates daily log entry. Required: mood (1-5), energy (1-5), session_type ('checkin'|'deep_dive'|'followup'), progress_rating (1-5), metadata (effectiveness, trainingCategory, privacyLevel), summary. Optional fields in groups:\n" +
          "- Context: focus_areas[], keyTopics[]\n" +
          "- Progress: progressUpdates[], insights[], actionItems[]\n" +
          "- Follow-up: followupPoints[], notes[], relatedNotes[]\n" +
          "- Metadata: qualityMarkers[], clusters[], patterns[], relationships[]",
        example: {
          mood: 4,
          energy: 3,
          session_type: "deep_dive",
          progress_rating: 4,
          metadata: {
            effectiveness: 4,
            trainingCategory: "technique",
            privacyLevel: "private",
            qualityMarkers: ["clear_communication", "actionable_outcomes"]
          },
          focus_areas: ["Project Planning", "Architecture"],
          summary: "Productive session focused on project planning",
          keyTopics: ["System Architecture", "Development Timeline"],
          progressUpdates: ["Completed initial research phase"],
          actionItems: ["Create initial wireframes", "Set up development environment"],
          followupPoints: ["Review architecture decisions next session"]
        },
        inputSchema: CreateDailyLogSchema
      },
      create_insight: {
        name: "create_insight",
        description: "Creates insight entry. Required: title, description, metadata (effectiveness, trainingCategory, privacyLevel). Optional fields in groups:\n" +
          "- Context: related_to[], tags[], status ('active'|'archived'), impact_level ('low'|'medium'|'high')\n" +
          "- Analysis: context, impact[], action_items[]\n" +
          "- Connections: related_insights[], pattern_recognition[], evidence_examples[], references[]\n" +
          "- Metadata: qualityMarkers[], clusters[], patterns[], relationships[]",
        example: {
          title: "Effective Pattern Recognition",
          description: "Systematic approach to identifying recurring patterns leads to better insights",
          status: "active",
          impact_level: "high",
          metadata: {
            effectiveness: 4,
            trainingCategory: "pattern",
            privacyLevel: "public",
            qualityMarkers: ["clear_pattern", "actionable"]
          },
          impact: ["Improves decision making", "Enables proactive responses"],
          action_items: ["Document pattern recognition process", "Create pattern template"]
        },
        inputSchema: CreateInsightSchema
      },
      query_notes: {
        name: "query_notes",
        description: "Query notes using Dataview syntax (e.g. 'FROM \"insights\" WHERE status=active SORT date LIMIT 5')",
        example: {
          query: "FROM \"insights\" WHERE status=active SORT date LIMIT 5"
        },
        inputSchema: QueryNotesArgsSchema
      },
      discover_vault: {
        name: "discover_vault",
        description: "Analyze vault structure to discover available folders and fields for querying",
        example: {},
        inputSchema: z.object({})
      },
      create_goal: {
        name: "create_goal",
        description: "Creates a goal entry incorporating identity-based habits principles. Required: title, description, type ('outcome'|'process'|'identity'), metrics[]. Optional fields in groups:\n" +
          "- Context: targetDate, relatedHabits[], identity\n" +
          "- Progress: progress[], reflection[]\n" +
          "- Metadata: priority ('low'|'medium'|'high'), tags[], privacyLevel",
        example: {
          title: "Master TypeScript Development",
          description: "Become proficient in TypeScript for better code quality",
          type: "process",
          metrics: ["Complete TypeScript course", "Convert 3 projects to TypeScript"],
          identity: "I am a developer who values type safety",
          metadata: {
            priority: "high",
            tags: ["development", "learning"]
          }
        },
        inputSchema: CreateGoalSchema
      },
      create_habit: {
        name: "create_habit",
        description: "Creates a habit entry using Atomic Habits framework. Required: title, description, type ('build'|'break'), cue, craving, response, reward, implementation.frequency. Optional fields in groups:\n" +
          "- Implementation: timeOfDay, location, duration\n" +
          "- Tracking: streaks, completion_history, obstacles, adaptations\n" +
          "- Stacking: before[], after[]\n" +
          "- Metadata: difficulty (1-5), tags[], privacyLevel",
        example: {
          title: "Morning Code Review",
          description: "Review code first thing each morning",
          type: "build",
          cue: "Arriving at desk with morning coffee",
          craving: "Feeling prepared and proactive",
          response: "Open GitHub PRs and spend 30 mins reviewing",
          reward: "Satisfaction of helping team and learning",
          implementation: {
            frequency: "daily",
            timeOfDay: "9:00 AM",
            duration: "30 minutes"
          },
          metadata: {
            difficulty: 3,
            tags: ["development", "team"]
          }
        },
        inputSchema: CreateHabitSchema
      },
      update_goal_status: {
        name: "update_goal_status",
        description: "Updates goal progress and status. Required: title, update_type ('progress'|'reflection'|'status'). Fields by update_type:\n" +
          "- progress: value (number), notes (optional)\n" +
          "- reflection: content, insights[] (optional)\n" +
          "- status: new_status ('active'|'completed'|'abandoned')",
        example: {
          title: "Master TypeScript Development",
          update_type: "progress",
          value: 75,
          notes: "Completed advanced TypeScript course modules"
        },
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
        description: "Updates habit tracking information. Required: title, update_type ('completion'|'obstacle'|'adaptation'). Fields by update_type:\n" +
          "- completion: completed (boolean), notes (optional)\n" +
          "- obstacle: description, solution (optional)\n" +
          "- adaptation: change, reason, outcome (optional)",
        example: {
          title: "Morning Code Review",
          update_type: "completion",
          completed: true,
          notes: "Reviewed 3 PRs and provided detailed feedback"
        },
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
    }
  }

  async updateGoalStatus(args: unknown): Promise<ToolResponse> {
    const parsed = z.object({
      title: z.string(),
      update_type: z.enum(['progress', 'reflection', 'status']),
      value: z.number().optional(),
      notes: z.string().optional(),
      content: z.string().optional(),
      insights: z.array(z.string()).optional(),
      new_status: z.enum(['active', 'completed', 'abandoned']).optional()
    }).safeParse(args)

    if (!parsed.success) {
      throw new Error(`Invalid arguments for update_goal_status: ${parsed.error}`)
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const notePath = `goals/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`
      const normalizedPath = normalizeNotePath(notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      // Read existing note
      const content = await fs.readFile(validPath, 'utf-8')
      const [frontmatter, ...bodyParts] = content.split('---\n').filter(Boolean)
      const body = bodyParts.join('---\n')

      // Update frontmatter based on update type
      let updatedFrontmatter = frontmatter
      if (parsed.data.update_type === 'status' && parsed.data.new_status) {
        updatedFrontmatter = frontmatter.replace(
          /status: .*$/m,
          `status: ${parsed.data.new_status}`
        )
      }

      // Update appropriate section based on update type
      let updatedBody = body
      const data = parsed.data
      
      if (data.update_type === 'progress' && data.value !== undefined) {
        const progressEntry = `### ${today}\n- Progress: ${data.value}${data.notes ? `\n- Notes: ${data.notes}` : ''}\n\n`
        const progressSection = '## Progress Tracking'
        updatedBody = body.replace(
          new RegExp(`${progressSection}.*?(?=##|$)`, 's'),
          `${progressSection}\n<!-- Record specific progress updates -->\n${progressEntry}`
        )
      } else if (data.update_type === 'reflection' && data.content) {
        const reflectionEntry = `### ${today}\n${data.content}\n\n**Insights:**\n${data.insights?.map(i => `- ${i}`).join('\n') || ''}\n\n`
        const reflectionSection = '## Reflections'
        updatedBody = body.replace(
          new RegExp(`${reflectionSection}.*?(?=##|$)`, 's'),
          `${reflectionSection}\n<!-- Regular reflections on progress and learning -->\n${reflectionEntry}`
        )
      }

      // Write updated content
      await fs.writeFile(validPath, `---\n${updatedFrontmatter}---\n${updatedBody}`)

      return {
        content: [{
          type: "text",
          text: `Successfully updated goal status for ${parsed.data.title}`
        }]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to update goal status: ${errorMessage}`)
    }
  }

  async createReflection(args: unknown): Promise<ToolResponse> {
    const parsed = CreateReflectionSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_reflection: ${parsed.error}`);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const notePath = `reflections/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      const normalizedPath = normalizeNotePath(notePath);
      const fullPath = path.join(this.vaultRoot, normalizedPath);
      const validPath = await validatePath(fullPath, [this.vaultRoot]);

      const content = `---
title: ${parsed.data.title}
period: ${parsed.data.period}
progress_rating: ${parsed.data.progress_rating}
focus_areas: ${JSON.stringify(parsed.data.focus_areas || [])}
status: ${parsed.data.status || 'active'}
tags: ${JSON.stringify(parsed.data.tags || [])}
created: ${today}
---

# ${parsed.data.title}

## Key Observations
${(parsed.data.key_observations || []).map(obs => `- ${obs}`).join('\n')}

## Progress Analysis
${(parsed.data.progress_analysis || []).map(analysis => `- ${analysis}`).join('\n')}

## Challenges
${(parsed.data.challenges || []).map(challenge => `- ${challenge}`).join('\n')}

## Insights
${(parsed.data.insights || []).map(insight => `- ${insight}`).join('\n')}

## Action Items
${(parsed.data.action_items || []).map(item => `- [ ] ${item}`).join('\n')}

## References
${(parsed.data.references || []).map(ref => `- ${ref}`).join('\n')}
`;

      await fs.writeFile(validPath, content);

      return {
        content: [{
          type: "text",
          text: `Successfully created reflection note: ${notePath}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create reflection: ${errorMessage}`);
    }
  }

  async createDailyLog(args: unknown): Promise<ToolResponse> {
    const parsed = CreateDailyLogSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_daily_log: ${parsed.error}`);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const notePath = `daily_logs/${today}.md`;
      const normalizedPath = normalizeNotePath(notePath);
      const fullPath = path.join(this.vaultRoot, normalizedPath);
      const validPath = await validatePath(fullPath, [this.vaultRoot]);

      const content = `---
date: ${today}
mood: ${parsed.data.mood}
energy: ${parsed.data.energy}
session_type: ${parsed.data.session_type}
progress_rating: ${parsed.data.progress_rating}
focus_areas: ${JSON.stringify(parsed.data.focus_areas || [])}
metadata:
  effectiveness: ${parsed.data.metadata.effectiveness}
  trainingCategory: ${parsed.data.metadata.trainingCategory}
  privacyLevel: ${parsed.data.metadata.privacyLevel}
---

# Daily Log - ${today}

## Summary
${parsed.data.summary}

## Key Topics
${(parsed.data.keyTopics || []).map(topic => `- ${topic}`).join('\n')}

## Progress Updates
${(parsed.data.progressUpdates || []).map(update => `- ${update}`).join('\n')}

## Action Items
${(parsed.data.actionItems || []).map(item => `- [ ] ${item}`).join('\n')}

## Follow-up Points
${(parsed.data.followupPoints || []).map(point => `- ${point}`).join('\n')}

## Notes
${(parsed.data.notes || []).map(note => `- ${note}`).join('\n')}
`;

      await fs.writeFile(validPath, content);

      return {
        content: [{
          type: "text",
          text: `Successfully created daily log: ${notePath}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create daily log: ${errorMessage}`);
    }
  }

  async createInsight(args: unknown): Promise<ToolResponse> {
    const parsed = CreateInsightSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_insight: ${parsed.error}`);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const notePath = `insights/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      const normalizedPath = normalizeNotePath(notePath);
      const fullPath = path.join(this.vaultRoot, normalizedPath);
      const validPath = await validatePath(fullPath, [this.vaultRoot]);

      const content = `---
title: ${parsed.data.title}
created: ${today}
status: ${parsed.data.status || 'active'}
impact_level: ${parsed.data.impact_level || 'medium'}
metadata:
  effectiveness: ${parsed.data.metadata.effectiveness}
  trainingCategory: ${parsed.data.metadata.trainingCategory}
  privacyLevel: ${parsed.data.metadata.privacyLevel}
tags: ${JSON.stringify(parsed.data.tags || [])}
---

# ${parsed.data.title}

## Description
${parsed.data.description}

## Context
${parsed.data.context || ''}

## Impact
${(parsed.data.impact || []).map(imp => `- ${imp}`).join('\n')}

## Action Items
${(parsed.data.action_items || []).map(item => `- [ ] ${item}`).join('\n')}

## Related Insights
${(parsed.data.related_insights || []).map(insight => `- ${insight}`).join('\n')}

## References
${(parsed.data.references || []).map(ref => `- ${ref}`).join('\n')}
`;

      await fs.writeFile(validPath, content);

      return {
        content: [{
          type: "text",
          text: `Successfully created insight note: ${notePath}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create insight: ${errorMessage}`);
    }
  }

  async readNotes(args: unknown): Promise<ToolResponse> {
    const parsed = ReadNotesArgsSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for read_notes: ${parsed.error}`);
    }

    try {
      const contents = await Promise.all(
        parsed.data.paths.map(async (notePath) => {
          const normalizedPath = normalizeNotePath(notePath);
          const fullPath = path.join(this.vaultRoot, normalizedPath);
          const validPath = await validatePath(fullPath, [this.vaultRoot]);
          const content = await readNote(validPath);
          return JSON.stringify(content, null, 2);
        })
      );

      return {
        content: contents.map(content => ({
          type: "text",
          text: content
        }))
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read notes: ${errorMessage}`);
    }
  }

  async searchNotes(args: unknown): Promise<ToolResponse> {
    const parsed = z.object({
      pattern: z.string(),
      caseSensitive: z.boolean().optional()
    }).safeParse(args);

    if (!parsed.success) {
      throw new Error(`Invalid arguments for search_notes: ${parsed.error}`);
    }

    try {
      const files = await getMarkdownFiles(this.vaultRoot, this.vaultRoot);
      const results: string[] = [];

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const regex = new RegExp(parsed.data.pattern, parsed.data.caseSensitive ? 'g' : 'gi');
        const matches = content.match(regex);

        if (matches) {
          const relativePath = path.relative(this.vaultRoot, file);
          results.push(`File: ${relativePath}`);
          results.push('Matches:');
          matches.forEach(match => {
            const context = content.substring(
              Math.max(0, content.indexOf(match) - 50),
              Math.min(content.length, content.indexOf(match) + match.length + 50)
            );
            results.push(`...${context}...`);
          });
          results.push('---');
        }
      }

      return {
        content: [{
          type: "text",
          text: results.join('\n')
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to search notes: ${errorMessage}`);
    }
  }

  async queryNotes(args: unknown): Promise<ToolResponse> {
    const parsed = QueryNotesArgsSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for query_notes: ${parsed.error}`);
    }

    try {
      const results = await executeQuery(this.vaultRoot, {
        from: parsed.data.query,
        format: "list"
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to execute query: ${errorMessage}`);
    }
  }

  async discoverVault(args: unknown): Promise<ToolResponse> {
    try {
      const files = await getMarkdownFiles(this.vaultRoot, this.vaultRoot);
      const structure: Record<string, Set<string>> = {};

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(this.vaultRoot, file);
        const folder = path.dirname(relativePath);

        if (!structure[folder]) {
          structure[folder] = new Set();
        }

        // Extract frontmatter fields
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/m) || [];
        if (frontmatterMatch) {
          const lines = frontmatterMatch[1].split('\n');
          lines.forEach(line => {
            const match = line.match(/^(\w+):/);
            if (match) {
              structure[folder].add(match[1]);
            }
          });
        }
      }

      const result = Object.entries(structure).map(([folder, fields]) => ({
        folder,
        fields: Array.from(fields)
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to discover vault structure: ${errorMessage}`);
    }
  }

  async createGoal(args: unknown): Promise<ToolResponse> {
    const parsed = CreateGoalSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_goal: ${parsed.error}`);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const notePath = `goals/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      const normalizedPath = normalizeNotePath(notePath);
      const fullPath = path.join(this.vaultRoot, normalizedPath);
      const validPath = await validatePath(fullPath, [this.vaultRoot]);

      const content = `---
title: ${parsed.data.title}
created: ${today}
type: ${parsed.data.type}
status: active
targetDate: ${parsed.data.targetDate || 'TBD'}
priority: ${parsed.data.metadata?.priority || 'medium'}
tags: ${JSON.stringify(parsed.data.metadata?.tags || [])}
---

# ${parsed.data.title}

## Description
${parsed.data.description}

## Identity Statement
${parsed.data.identity || ''}

## Metrics
${parsed.data.metrics.map(metric => `- [ ] ${metric}`).join('\n')}

## Related Habits
${(parsed.data.relatedHabits || []).map(habit => `- ${habit}`).join('\n')}

## Progress Tracking
<!-- Record specific progress updates -->

## Reflections
<!-- Regular reflections on progress and learning -->
`;

      await fs.writeFile(validPath, content);

      return {
        content: [{
          type: "text",
          text: `Successfully created goal: ${notePath}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create goal: ${errorMessage}`);
    }
  }

  async createHabit(args: unknown): Promise<ToolResponse> {
    const parsed = CreateHabitSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_habit: ${parsed.error}`);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const notePath = `habits/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      const normalizedPath = normalizeNotePath(notePath);
      const fullPath = path.join(this.vaultRoot, normalizedPath);
      const validPath = await validatePath(fullPath, [this.vaultRoot]);

      const content = `---
title: ${parsed.data.title}
created: ${today}
type: ${parsed.data.type}
frequency: ${parsed.data.implementation.frequency}
timeOfDay: ${parsed.data.implementation.timeOfDay || 'flexible'}
duration: ${parsed.data.implementation.duration || 'N/A'}
difficulty: ${parsed.data.metadata?.difficulty || 3}
tags: ${JSON.stringify(parsed.data.metadata?.tags || [])}
---

# ${parsed.data.title}

## Description
${parsed.data.description}

## Implementation Strategy

### Cue
${parsed.data.cue}

### Craving
${parsed.data.craving}

### Response
${parsed.data.response}

### Reward
${parsed.data.reward}

### Location
${parsed.data.implementation.location || 'Flexible'}

## Habit Stacking
${parsed.data.stacking?.before ? '### Before\n' + parsed.data.stacking.before.map((h: string) => `- ${h}`).join('\n') : ''}
${parsed.data.stacking?.after ? '### After\n' + parsed.data.stacking.after.map((h: string) => `- ${h}`).join('\n') : ''}

### Completion History
<!-- Track daily completions -->

### Obstacles Encountered
<!-- Document challenges and solutions -->

### Adaptations Made
<!-- Record changes to implementation -->
`;

      await fs.writeFile(validPath, content);

      return {
        content: [{
          type: "text",
          text: `Successfully created habit: ${notePath}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create habit: ${errorMessage}`);
    }
  }

  async updateHabitTracking(args: unknown): Promise<ToolResponse> {
    const parsed = z.object({
      title: z.string(),
      update_type: z.enum(['completion', 'obstacle', 'adaptation']),
      completed: z.boolean().optional(),
      notes: z.string().optional(),
      description: z.string().optional(),
      solution: z.string().optional(),
      change: z.string().optional(),
      reason: z.string().optional(),
      outcome: z.string().optional()
    }).safeParse(args)

    if (!parsed.success) {
      throw new Error(`Invalid arguments for update_habit_tracking: ${parsed.error}`)
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const notePath = `habits/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`
      const normalizedPath = normalizeNotePath(notePath)
      const fullPath = path.join(this.vaultRoot, normalizedPath)
      const validPath = await validatePath(fullPath, [this.vaultRoot])

      // Read existing note
      const content = await fs.readFile(validPath, 'utf-8')
      const [frontmatter, ...bodyParts] = content.split('---\n').filter(Boolean)
      const body = bodyParts.join('---\n')

      // Update appropriate section based on update type
      let updatedBody = body
      const data = parsed.data

      if (data.update_type === 'completion' && data.completed !== undefined) {
        const completionEntry = `- [${data.completed ? 'x' : ' '}] ${today}${data.notes ? ` - ${data.notes}` : ''}\n`
        const completionSection = '### Completion History'
        updatedBody = body.replace(
          new RegExp(`${completionSection}.*?(?=###|$)`, 's'),
          `${completionSection}\n${completionEntry}`
        )
      } else if (data.update_type === 'obstacle' && data.description) {
        const obstacleEntry = `#### ${today}\n**Challenge:** ${data.description}\n**Solution:** ${data.solution || 'Not yet resolved'}\n\n`
        const obstacleSection = '### Obstacles Encountered'
        updatedBody = body.replace(
          new RegExp(`${obstacleSection}.*?(?=###|$)`, 's'),
          `${obstacleSection}\n${obstacleEntry}`
        )
      } else if (data.update_type === 'adaptation' && data.change && data.reason) {
        const adaptationEntry = `#### ${today}\n**Change:** ${data.change}\n**Reason:** ${data.reason}\n**Outcome:** ${data.outcome || 'Pending'}\n\n`
        const adaptationSection = '### Adaptations Made'
        updatedBody = body.replace(
          new RegExp(`${adaptationSection}.*?(?=###|$)`, 's'),
          `${adaptationSection}\n${adaptationEntry}`
        )
      }

      // Write updated content
      await fs.writeFile(validPath, `---\n${frontmatter}---\n${updatedBody}`)

      return {
        content: [{
          type: "text",
          text: `Successfully updated habit tracking for ${parsed.data.title}`
        }]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to update habit tracking: ${errorMessage}`)
    }
  }
}
