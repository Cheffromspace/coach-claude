import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { validatePath, normalizeNotePath } from "../../utils.js";
import { createNote, addMetadata } from "../../utils/note-utils.js";
import { getMarkdownFiles } from "../core/query-engine.js";
import {
  CreateJournalSchema,
  CreateGoalSchema,
  CreateHabitSchema,
  CreateHealthMetricSchema
} from "./schemas.js";

export class NoteHandlers {
  constructor(private vaultRoot: string) {}

  async createJournal(args: unknown): Promise<any> {
    const parsed = CreateJournalSchema.safeParse(args);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((err) => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for create_journal:\n${errors}\n\nUse get_help tool with tool_name="create_journal" for detailed usage guide.`);
    }

    try {
      // Add timestamps using utility function
      const journalData = addMetadata(parsed.data);
      
      const content = `---
title: ${journalData.title}
date: ${journalData.date}
type: ${journalData.type || 'misc'}
mood: ${journalData.mood || 'N/A'}
energy: ${journalData.energy || 'N/A'}
metrics: ${JSON.stringify(journalData.metrics || [])}
links: ${JSON.stringify(journalData.links || [])}
metadata:
  created: ${journalData.metadata.created}
  modified: ${journalData.metadata.modified}
  version: ${journalData.metadata.version}
  privacyLevel: ${parsed.data.metadata.privacyLevel}
  tags: ${JSON.stringify(parsed.data.metadata.tags || [])}
versions: ${JSON.stringify(journalData.versions || [], null, 2)}
---

# ${parsed.data.title}

## Content
${parsed.data.content}

${parsed.data.metrics?.length ? `## Metrics
${parsed.data.metrics.map((m: { name: string; value: string | number; unit?: string }) => 
  `- ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`
).join('\n')}` : ''}

${parsed.data.links?.length ? `## Links
${parsed.data.links.map(link => `- [${link.type}] ${link.target} (${link.label || 'No label'})`).join('\n')}` : ''}
`;

      const notePath = await createNote(this.vaultRoot, 'journal', parsed.data.title, content, { useDate: true });

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

  async createGoal(args: unknown): Promise<any> {
    const parsed = CreateGoalSchema.safeParse(args);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((err) => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for create_goal:\n${errors}\n\nUse get_help tool with tool_name="create_goal" for detailed usage guide.`);
    }

    try {
      // Add timestamps using utility function
      const goalData = addMetadata(parsed.data);
      
      const content = `---
title: ${goalData.title}
created: ${goalData.metadata.created}
modified: ${goalData.metadata.modified}
type: ${goalData.type}
status: active
targetDate: ${parsed.data.targetDate || 'TBD'}
priority: ${parsed.data.metadata.priority}
tags: ${JSON.stringify(parsed.data.metadata.tags)}
privacyLevel: ${parsed.data.metadata.privacyLevel}
versions: ${JSON.stringify(goalData.versions || [], null, 2)}
---

# ${parsed.data.title}

## Description
${parsed.data.description}

## Metrics
${parsed.data.metrics.map((metric: { name: string; target: string | number; unit?: string; current?: string | number }) => 
  `- ${metric.name}: ${metric.target}${metric.unit ? ` ${metric.unit}` : ''}${metric.current ? ` (Current: ${metric.current})` : ''}`
).join('\n')}

## Progress
${(parsed.data.progress || []).map(p => `### ${p.date}\n- Value: ${p.value}\n${p.notes ? `- Notes: ${p.notes}` : ''}`).join('\n\n')}

## Progress Tracking
<!-- Record specific progress updates -->
${parsed.data.metrics.map((metric: { name: string; target: string | number; unit?: string; current?: string | number }) => 
  `### ${metric.name}\n- Target: ${metric.target}${metric.unit ? ` ${metric.unit}` : ''}${metric.current ? `\n- Current: ${metric.current}` : ''}`
).join('\n\n')}

## Reflections
<!-- Regular reflections on progress and learning -->

## Links
${(parsed.data.links || []).map(link => 
  `- [${link.type}] ${link.target}${link.label ? ` (${link.label})` : ''}`
).join('\n')}

## Version History
${goalData.versions?.map(v => 
  `### Version ${v.version} - ${v.timestamp}\n**Author:** ${v.author}\n**Changes:**\n${v.changes.map(c => 
    `- ${c.field}: ${c.previous} → ${c.current}`
  ).join('\n')}${v.message ? `\n**Message:** ${v.message}` : ''}`
).join('\n\n') || '<!-- No version history yet -->'}
`;

      const notePath = await createNote(this.vaultRoot, 'goals', parsed.data.title, content);

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

  async createHabit(args: unknown): Promise<any> {
    const parsed = CreateHabitSchema.safeParse(args);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((err) => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for create_habit:\n${errors}\n\nUse get_help tool with tool_name="create_habit" for detailed usage guide.`);
    }

    try {
      // Add timestamps using utility function
      const habitData = addMetadata(parsed.data);
      
      const content = `---
title: ${habitData.title}
created: ${habitData.metadata.created}
modified: ${habitData.metadata.modified}
type: ${habitData.type}
frequency: ${parsed.data.implementation.frequency}
timeOfDay: ${parsed.data.implementation.timeOfDay || 'flexible'}
duration: ${parsed.data.implementation.duration || 'N/A'}
difficulty: ${parsed.data.metadata?.difficulty || 3}
tags: ${JSON.stringify(parsed.data.metadata?.tags || [])}
versions: ${JSON.stringify(habitData.versions || [], null, 2)}
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

      const notePath = await createNote(this.vaultRoot, 'habits', parsed.data.title, content, { useDate: false });

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

  async createHealthMetric(args: unknown): Promise<any> {
    const parsed = CreateHealthMetricSchema.safeParse(args);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((err) => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for create_health_metric:\n${errors}\n\nUse get_help tool with tool_name="create_health_metric" for detailed usage guide.`);
    }

    try {
      // Add timestamps using utility function
      const metricData = addMetadata(parsed.data);
      const today = new Date().toISOString().split('T')[0];
      
      const content = `---
title: ${metricData.title}
date: ${metricData.date}
type: ${metricData.type}
values: ${JSON.stringify(metricData.values)}
note: ${metricData.note || ''}
links: ${JSON.stringify(metricData.links || [])}
metadata:
  created: ${metricData.metadata.created}
  modified: ${metricData.metadata.modified}
  version: ${metricData.metadata.version}
  privacyLevel: ${parsed.data.metadata.privacyLevel}
  tags: ${JSON.stringify(parsed.data.metadata.tags || [])}
versions: ${JSON.stringify(metricData.versions || [], null, 2)}
---

# ${parsed.data.title}

## Values
${parsed.data.values.map((v: { name: string; value: string | number; unit?: string }) => 
  `- ${v.name}: ${v.value}${v.unit ? ` ${v.unit}` : ''}`
).join('\n')}

## Note
${parsed.data.note || 'No additional notes.'}

## Links
${(parsed.data.links || []).map(link => `- [${link.type}] ${link.target} (${link.label || 'No label'})`).join('\n')}

## History
<!-- Track value changes over time -->
### ${today}
${parsed.data.values.map((v: { name: string; value: string | number; unit?: string }) => 
  `- Initial ${v.name}: ${v.value}${v.unit ? ` ${v.unit}` : ''}`
).join('\n')}
`;

      const notePath = await createNote(this.vaultRoot, 'metrics', parsed.data.title, content);

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

  async updateGoalStatus(args: unknown): Promise<any> {
    const parsed = z.object({
      title: z.string(),
      update_type: z.enum(['progress', 'reflection', 'status']),
      value: z.number().optional(),
      notes: z.string().optional(),
      content: z.string().optional(),
      insights: z.array(z.string()).optional(),
      new_status: z.enum(['active', 'completed', 'abandoned']).optional()
    }).safeParse(args);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((err) => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for update_goal_status:\n${errors}\n\nUse get_help tool with tool_name="update_goal_status" for detailed usage guide.`);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      // Find the goal file by searching for files that end with the title
      const files = await getMarkdownFiles(path.join(this.vaultRoot, 'goals'), this.vaultRoot);
      const goalFile = files.find((file: string) => {
        const filename = path.basename(file);
        return filename.endsWith(`-${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`);
      });
      
      if (!goalFile) {
        throw new Error(`Goal not found: ${parsed.data.title}`);
      }
      
      const notePath = path.relative(this.vaultRoot, goalFile);
      const normalizedPath = normalizeNotePath(notePath);
      const fullPath = path.join(this.vaultRoot, normalizedPath);
      const validPath = await validatePath(fullPath, [this.vaultRoot]);

      // Read existing note
      const content = await fs.readFile(validPath, 'utf-8');
      const [frontmatter, ...bodyParts] = content.split('---\n').filter(Boolean);
      const body = bodyParts.join('---\n');

      // Update frontmatter based on update type
      let updatedFrontmatter = frontmatter;
      if (parsed.data.update_type === 'status' && parsed.data.new_status) {
        updatedFrontmatter = frontmatter.replace(
          /status: .*$/m,
          `status: ${parsed.data.new_status}`
        );
      }

      // Update appropriate section based on update type
      let updatedBody = body;
      const data = parsed.data;
      
      if (data.update_type === 'progress' && data.value !== undefined) {
        const progressEntry = `### ${today}\n- Progress: ${data.value}${data.notes ? `\n- Notes: ${data.notes}` : ''}\n\n`;
        const progressSection = '## Progress Tracking';
        updatedBody = body.replace(
          new RegExp(`${progressSection}.*?(?=##|$)`, 's'),
          `${progressSection}\n<!-- Record specific progress updates -->\n${progressEntry}`
        );
      } else if (data.update_type === 'reflection' && data.content) {
        const reflectionEntry = `### ${today}\n${data.content}\n\n**Insights:**\n${data.insights?.map(i => `- ${i}`).join('\n') || ''}\n\n`;
        const reflectionSection = '## Reflections';
        updatedBody = body.replace(
          new RegExp(`${reflectionSection}.*?(?=##|$)`, 's'),
          `${reflectionSection}\n<!-- Regular reflections on progress and learning -->\n${reflectionEntry}`
        );
      }

      // Write updated content
      await fs.writeFile(validPath, `---\n${updatedFrontmatter}---\n${updatedBody}`);

      return {
        content: [{
          type: "text",
          text: `Successfully updated goal status for ${parsed.data.title}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update goal status: ${errorMessage}`);
    }
  }

  async updateHabitTracking(args: unknown): Promise<any> {
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
    }).safeParse(args);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((err) => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for update_habit_tracking:\n${errors}\n\nUse get_help tool with tool_name="update_habit_tracking" for detailed usage guide.`);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const notePath = `habits/${parsed.data.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      const normalizedPath = normalizeNotePath(notePath);
      const fullPath = path.join(this.vaultRoot, normalizedPath);
      const validPath = await validatePath(fullPath, [this.vaultRoot]);

      // Read existing note
      const content = await fs.readFile(validPath, 'utf-8');
      const [frontmatter, ...bodyParts] = content.split('---\n').filter(Boolean);
      const body = bodyParts.join('---\n');

      // Update appropriate section based on update type
      let updatedBody = body;
      const data = parsed.data;

      if (data.update_type === 'completion' && data.completed !== undefined) {
        const completionEntry = `- [${data.completed ? 'x' : ' '}] ${today}${data.notes ? ` - ${data.notes}` : ''}\n`;
        const completionSection = '### Completion History';
        updatedBody = body.replace(
          new RegExp(`${completionSection}.*?(?=###|$)`, 's'),
          `${completionSection}\n${completionEntry}`
        );
      } else if (data.update_type === 'obstacle' && data.description) {
        const obstacleEntry = `#### ${today}\n**Challenge:** ${data.description}\n**Solution:** ${data.solution || 'Not yet resolved'}\n\n`;
        const obstacleSection = '### Obstacles Encountered';
        updatedBody = body.replace(
          new RegExp(`${obstacleSection}.*?(?=###|$)`, 's'),
          `${obstacleSection}\n${obstacleEntry}`
        );
      } else if (data.update_type === 'adaptation' && data.change && data.reason) {
        const adaptationEntry = `#### ${today}\n**Change:** ${data.change}\n**Reason:** ${data.reason}\n**Outcome:** ${data.outcome || 'Pending'}\n\n`;
        const adaptationSection = '### Adaptations Made';
        updatedBody = body.replace(
          new RegExp(`${adaptationSection}.*?(?=###|$)`, 's'),
          `${adaptationSection}\n${adaptationEntry}`
        );
      }

      // Write updated content
      await fs.writeFile(validPath, `---\n${frontmatter}---\n${updatedBody}`);

      return {
        content: [{
          type: "text",
          text: `Successfully updated habit tracking for ${parsed.data.title}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update habit tracking: ${errorMessage}`);
    }
  }
}
