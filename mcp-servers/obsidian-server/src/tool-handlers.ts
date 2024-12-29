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
  CreateHabitSchema,
  CreateMetricNoteSchema
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
        description: "Creates reflection note. Required: title:str, period:str, progress_rating:1-5\nOptional groups:\n" +
          "Context: focus_areas[], tags[], status:('active'|'completed'|'archived')\n" +
          "Analysis: key_observations[], progress_analysis[], challenges[], insights[]\n" +
          "Planning: action_items[], references[]",
        inputSchema: CreateReflectionSchema
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
      create_daily_log: {
        name: "create_daily_log",
        description: "Creates daily log. Required: mood:1-5, energy:1-5, session_type:('checkin'|'deep_dive'|'followup'), progress_rating:1-5, metadata:{effectiveness:num, trainingCategory:('technique'|'insight'|'pattern'|'strategy'), privacyLevel:('public'|'private'|'sensitive')}, summary:str\nOptional groups:\n" +
          "Context: focus_areas[], keyTopics[]\n" +
          "Progress: progressUpdates[], insights[], actionItems[]\n" +
          "Follow-up: followupPoints[], notes[], relatedNotes[]",
        inputSchema: CreateDailyLogSchema
      },
      create_insight: {
        name: "create_insight",
        description: "Creates insight. Required: title:str, description:str, metadata:{effectiveness:num, trainingCategory:('technique'|'insight'|'pattern'|'strategy'), privacyLevel:('public'|'private'|'sensitive')}\nOptional groups:\n" +
          "Context: related_to[], tags[], status:('active'|'archived'), impact:('low'|'medium'|'high')\n" +
          "Analysis: context:str, impact[], action_items[]\n" +
          "Connections: related_insights[], pattern_recognition[], evidence[]",
        inputSchema: CreateInsightSchema
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
      create_metric_note: {
        name: "create_metric_note",
        description: "Creates metric note. Required: title:str, numericValue:num, unit:str\nOptional: textValue:str, note:str, tags:str[], metadata:{privacyLevel:('public'|'private'|'sensitive'), effectiveness:1-5}",
        inputSchema: CreateMetricNoteSchema
      }
    }
  }

  async createMetricNote(args: unknown): Promise<ToolResponse> {
    const parsed = CreateMetricNoteSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_metric_note: ${parsed.error}`);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const notePath = `metrics/${timestamp}-${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      const normalizedPath = normalizeNotePath(notePath);
      const fullPath = path.join(this.vaultRoot, normalizedPath);
      const validPath = await validatePath(fullPath, [this.vaultRoot]);

      const content = `---
title: ${parsed.data.title}
created: ${today}
modified: ${today}
numericValue: ${parsed.data.numericValue}
unit: ${parsed.data.unit}
textValue: ${parsed.data.textValue || ''}
tags: ${JSON.stringify(parsed.data.tags || [])}
privacyLevel: ${parsed.data.metadata?.privacyLevel || 'private'}
effectiveness: ${parsed.data.metadata?.effectiveness || 3}
---

# ${parsed.data.title}

## Value
- Numeric: ${parsed.data.numericValue} ${parsed.data.unit}
${parsed.data.textValue ? `- Text: ${parsed.data.textValue}` : ''}

## Note
${parsed.data.note || 'No additional notes.'}

## History
<!-- Track value changes over time -->
### ${today}
- Initial value: ${parsed.data.numericValue} ${parsed.data.unit}
${parsed.data.textValue ? `- Initial text: ${parsed.data.textValue}` : ''}
`;

      await fs.writeFile(validPath, content);

      return {
        content: [{
          type: "text",
          text: `Successfully created metric note: ${notePath}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create metric note: ${errorMessage}`);
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
      caseSensitive: z.boolean().optional(),
      maxMatchesPerFile: z.number().optional(),
      contextLines: z.number().optional(),
      filePattern: z.string().optional()
    }).safeParse(args);

    if (!parsed.success) {
      throw new Error(`Invalid arguments for search_notes: ${parsed.error}`);
    }

    try {
      const maxMatchesPerFile = parsed.data.maxMatchesPerFile || 3;
      const contextLines = parsed.data.contextLines || 2;
      const fileRegex = parsed.data.filePattern ? new RegExp(parsed.data.filePattern) : null;
      
      const files = await getMarkdownFiles(this.vaultRoot, this.vaultRoot);
      const results: Array<{
        file: string;
        matches: Array<{
          line: number;
          content: string;
          context: string[];
        }>;
      }> = [];

      for (const file of files) {
        const relativePath = path.relative(this.vaultRoot, file);
        
        // Skip if file doesn't match pattern
        if (fileRegex && !fileRegex.test(relativePath)) {
          continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        const regex = new RegExp(parsed.data.pattern, parsed.data.caseSensitive ? 'g' : 'gi');
        
        const fileMatches: Array<{
          line: number;
          content: string;
          context: string[];
        }> = [];

        for (let i = 0; i < lines.length && fileMatches.length < maxMatchesPerFile; i++) {
          const line = lines[i];
          if (regex.test(line)) {
            // Get surrounding context lines
            const contextStart = Math.max(0, i - contextLines);
            const contextEnd = Math.min(lines.length, i + contextLines + 1);
            const context = lines.slice(contextStart, contextEnd);

            fileMatches.push({
              line: i + 1,
              content: line.trim(),
              context: context.map(l => l.trim())
            });
          }
        }

        if (fileMatches.length > 0) {
          results.push({
            file: relativePath,
            matches: fileMatches
          });
        }
      }

      // Format results as structured text
      const formattedResults = results.map(result => {
        const fileHeader = `File: ${result.file}`;
        const matches = result.matches.map(match => {
          return `  Line ${match.line}:\n    ${match.context.join('\n    ')}`;
        }).join('\n\n');
        return `${fileHeader}\n${matches}`;
      }).join('\n\n---\n\n');

      return {
        content: [{
          type: "text",
          text: formattedResults
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
      let query = parsed.data.query;
      
      // Handle tag queries by converting them to proper Dataview syntax
      if (query.includes('#')) {
        // Convert #tag format to proper WHERE clause
        const tags = query.match(/#[\w-]+/g)?.map(tag => tag.substring(1));
        if (tags && tags.length > 0) {
          const tagConditions = tags.map(tag => `contains(tags, "${tag}")`).join(' or ');
          query = `FROM "" WHERE ${tagConditions}`;
        }
      }

      // Parse the modified query into components
      const queryParams = parseDataviewQuery(query);
      
      // Execute the query with parsed parameters
      const results = await executeQuery(this.vaultRoot, {
        ...queryParams,
        format: "list"
      });

      return {
        content: [{
          type: "text",
          text: results
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
