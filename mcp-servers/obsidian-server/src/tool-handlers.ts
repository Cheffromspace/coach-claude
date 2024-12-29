import { z } from "zod"
import fs from "fs/promises"
import path from "path"
import { TagManager } from "./tag-manager.js"
import {
  validatePath,
  normalizeNotePath,
  readNote
} from "./utils.js"
import {
  CreateJournalSchema,
  ReadNotesArgsSchema,
  QueryNotesArgsSchema,
  CreateGoalSchema,
  CreateHabitSchema,
  CreateHealthMetricSchema,
  BaseMetadataSchema,
  LinkSchema,
  VersionSchema,
  TagQuerySchema,
  TagHierarchySchema
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
  private tagManager: TagManager;

  constructor(private vaultRoot: string) {
    this.tagManager = new TagManager();
    // Initialize tag manager
    this.tagManager.initialize(vaultRoot).catch(error => {
      console.error("Failed to initialize tag manager:", error);
    });
  }

  getToolDefinitions() {
    return {
      search_by_tags: {
        name: "search_by_tags",
        description: "Search notes by tags with advanced options. Required: tags[]:str[]\nOptional: operator:('AND'|'OR')='AND', includeChildren:bool=false, caseSensitive:bool=false",
        inputSchema: z.object({
          tags: z.array(z.string()),
          operator: z.enum(['AND', 'OR']).default('AND'),
          includeChildren: z.boolean().default(false),
          caseSensitive: z.boolean().default(false)
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
        description: "Creates health metric entry. Required: title:str, date:str, type:('weight'|'blood_pressure'|'sleep'|'pain'|'medication'|'custom'), values:[{name:str, value:num|str, unit?:str}]\nOptional: note:str, links:[{source:str, target:str, type:str}], metadata:{...}, versions:[{...}]",
        inputSchema: CreateHealthMetricSchema
      }
    }
  }

  async createHealthMetric(args: unknown): Promise<ToolResponse> {
    const parsed = CreateHealthMetricSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_health_metric: ${parsed.error}`);
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
date: ${parsed.data.date}
type: ${parsed.data.type}
values: ${JSON.stringify(parsed.data.values)}
note: ${parsed.data.note || ''}
links: ${JSON.stringify(parsed.data.links || [])}
metadata:
  created: ${today}
  modified: ${today}
  version: 1
  privacyLevel: ${parsed.data.metadata?.privacyLevel || 'private'}
  tags: ${JSON.stringify(parsed.data.metadata?.tags || [])}
versions: []
---

# ${parsed.data.title}

## Values
${parsed.data.values.map(v => `- ${v.name}: ${v.value}${v.unit ? ` ${v.unit}` : ''}`).join('\n')}

## Note
${parsed.data.note || 'No additional notes.'}

## Links
${(parsed.data.links || []).map(link => `- [${link.type}] ${link.target} (${link.label || 'No label'})`).join('\n')}

## History
<!-- Track value changes over time -->
### ${today}
${parsed.data.values.map(v => `- Initial ${v.name}: ${v.value}${v.unit ? ` ${v.unit}` : ''}`).join('\n')}
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

  async searchByTags(args: unknown): Promise<ToolResponse> {
    const parsed = z.object({
      tags: z.array(z.string()),
      operator: z.enum(['AND', 'OR']).default('AND'),
      includeChildren: z.boolean().default(false),
      caseSensitive: z.boolean().default(false)
    }).safeParse(args);

    if (!parsed.success) {
      throw new Error(`Invalid arguments for search_by_tags: ${parsed.error}`);
    }

    try {
      const results = this.tagManager.searchByTags(
        parsed.data.tags,
        parsed.data.operator,
        parsed.data.includeChildren,
        parsed.data.caseSensitive
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            matchingFiles: results,
            count: results.length,
            searchCriteria: {
              tags: parsed.data.tags,
              operator: parsed.data.operator,
              includeChildren: parsed.data.includeChildren,
              caseSensitive: parsed.data.caseSensitive
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to search by tags: ${errorMessage}`);
    }
  }

  async setTagHierarchy(args: unknown): Promise<ToolResponse> {
    const parsed = z.object({
      tag: z.string(),
      parent: z.string().optional(),
      children: z.array(z.string()).optional()
    }).safeParse(args);

    if (!parsed.success) {
      throw new Error(`Invalid arguments for set_tag_hierarchy: ${parsed.error}`);
    }

    try {
      this.tagManager.setTagHierarchy(
        parsed.data.tag,
        parsed.data.parent,
        parsed.data.children || []
      );

      const hierarchy = this.tagManager.getTagHierarchy(parsed.data.tag);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            tag: parsed.data.tag,
            hierarchy: hierarchy
          }, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to set tag hierarchy: ${errorMessage}`);
    }
  }

  async getTagStats(args: unknown): Promise<ToolResponse> {
    try {
      const allTags = this.tagManager.getAllTags();
      
      // Group tags by usage count
      const usageGroups = allTags.reduce((acc, {name, count}) => {
        const group = count === 1 ? 'single' :
                     count <= 5 ? 'low' :
                     count <= 20 ? 'medium' : 'high';
        if (!acc[group]) acc[group] = [];
        acc[group].push({name, count});
        return acc;
      }, {} as Record<string, typeof allTags>);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            totalTags: allTags.length,
            usageStatistics: {
              highUsage: usageGroups.high || [],    // > 20 uses
              mediumUsage: usageGroups.medium || [], // 6-20 uses
              lowUsage: usageGroups.low || [],      // 2-5 uses
              singleUse: usageGroups.single || []   // 1 use
            },
            allTags: allTags
          }, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get tag statistics: ${errorMessage}`);
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


  async createJournal(args: unknown): Promise<ToolResponse> {
    const parsed = CreateJournalSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for create_journal: ${parsed.error}`);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const notePath = `journal/${parsed.data.date}-${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      const normalizedPath = normalizeNotePath(notePath);
      const fullPath = path.join(this.vaultRoot, normalizedPath);
      const validPath = await validatePath(fullPath, [this.vaultRoot]);

      const content = `---
title: ${parsed.data.title}
date: ${parsed.data.date}
type: ${parsed.data.type || 'misc'}
mood: ${parsed.data.mood || 'N/A'}
energy: ${parsed.data.energy || 'N/A'}
metrics: ${JSON.stringify(parsed.data.metrics || [])}
links: ${JSON.stringify(parsed.data.links || [])}
metadata:
  created: ${today}
  modified: ${today}
  version: 1
  privacyLevel: ${parsed.data.metadata.privacyLevel}
  tags: ${JSON.stringify(parsed.data.metadata.tags || [])}
versions: []
---

# ${parsed.data.title}

## Content
${parsed.data.content}

${parsed.data.metrics?.length ? `## Metrics
${parsed.data.metrics.map(m => `- ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`).join('\n')}` : ''}

${parsed.data.links?.length ? `## Links
${parsed.data.links.map(link => `- [${link.type}] ${link.target} (${link.label || 'No label'})`).join('\n')}` : ''}
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

## Metrics
${parsed.data.metrics.map(metric => `- ${metric.name}: ${metric.target}${metric.unit ? ` ${metric.unit}` : ''}${metric.current ? ` (Current: ${metric.current})` : ''}`).join('\n')}

## Progress
${(parsed.data.progress || []).map(p => `### ${p.date}\n- Value: ${p.value}\n${p.notes ? `- Notes: ${p.notes}` : ''}`).join('\n\n')}

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

## Implementation Details
### Time of Day: ${parsed.data.implementation.timeOfDay || 'Flexible'}
### Duration: ${parsed.data.implementation.duration || 'N/A'}
### Location: ${parsed.data.implementation.location || 'Flexible'}

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
