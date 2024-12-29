import { TagManager } from "../tag-manager.js";
import { z } from "zod";
import { ToolResponse } from "../types.js";

export class TagHandlers {
  constructor(private tagManager: TagManager) {}

  async setTagRelationship(args: unknown): Promise<ToolResponse> {
    const parsed = z.object({
      tag: z.string(),
      relatedTag: z.string(),
      type: z.enum(['similar', 'opposite', 'broader', 'narrower', 'custom']),
      strength: z.number().min(1).max(5).optional(),
      notes: z.string().optional()
    }).safeParse(args);

    if (!parsed.success) {
      const errors = parsed.error.errors.map(err => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for set_tag_relationship:\n${errors}\n\nUse get_help tool with tool_name="set_tag_relationship" for detailed usage guide.`);
    }

    try {
      // Add bidirectional relationship
      this.tagManager.addTagRelationship(parsed.data.tag, parsed.data.relatedTag, parsed.data.type);
      
      // Add inverse relationship
      const inverseType = this.getInverseRelationType(parsed.data.type);
      this.tagManager.addTagRelationship(parsed.data.relatedTag, parsed.data.tag, inverseType);

      const relationships = this.tagManager.getTagRelationships(parsed.data.tag);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            tag: parsed.data.tag,
            relationships: relationships
          }, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to set tag relationship: ${errorMessage}`);
    }
  }

  private getInverseRelationType(type: 'similar' | 'opposite' | 'broader' | 'narrower' | 'custom'): 'similar' | 'opposite' | 'broader' | 'narrower' | 'custom' {
    const inverseMap = {
      'broader': 'narrower',
      'narrower': 'broader',
      'similar': 'similar',
      'opposite': 'opposite',
      'custom': 'custom'
    } as const;
    return inverseMap[type];
  }

  async setTagHierarchy(args: unknown): Promise<ToolResponse> {
    const parsed = z.object({
      tag: z.string(),
      parent: z.string().optional(),
      children: z.array(z.string()).optional()
    }).safeParse(args);

    if (!parsed.success) {
      const errors = parsed.error.errors.map(err => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for set_tag_hierarchy:\n${errors}\n\nUse get_help tool with tool_name="set_tag_hierarchy" for detailed usage guide.`);
    }

    try {
      this.tagManager.setTagHierarchy(
        parsed.data.tag,
        parsed.data.parent,
        parsed.data.children || []
      );

      const hierarchy = this.tagManager.getTagHierarchy(parsed.data.tag);
      const relationships = this.tagManager.getTagRelationships(parsed.data.tag);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            tag: parsed.data.tag,
            hierarchy: hierarchy,
            relationships: relationships
          }, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to set tag hierarchy: ${errorMessage}`);
    }
  }

  async getTagStats(args: unknown): Promise<ToolResponse> {
    const parsed = z.object({}).safeParse(args);
    
    if (!parsed.success) {
      const errors = parsed.error.errors.map(err => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for get_tag_stats:\n${errors}\n\nUse get_help tool with tool_name="get_tag_stats" for detailed usage guide.\n\nExample usage:\n{\n  // No parameters required\n}`);
    }

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
}
