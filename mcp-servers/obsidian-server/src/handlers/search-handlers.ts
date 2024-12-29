import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { ToolResponse } from "../types.js";
import { getMarkdownFiles } from "../query-engine.js";
import { parseDataviewQuery, executeQuery } from "../query-engine.js";
import { validatePath, normalizeNotePath, readNote } from "../utils.js";
import { ReadNotesArgsSchema, QueryNotesArgsSchema } from "../schemas.js";

export class SearchHandlers {
  constructor(private vaultRoot: string) {}

  async readNotes(args: unknown): Promise<ToolResponse> {
    const parsed = ReadNotesArgsSchema.safeParse(args);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(err => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for read_notes:\n${errors}\n\nUse get_help tool with tool_name="read_notes" for detailed usage guide.`);
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
      const errors = parsed.error.errors.map(err => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for search_notes:\n${errors}\n\nUse get_help tool with tool_name="search_notes" for detailed usage guide.`);
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
      const errors = parsed.error.errors.map(err => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for query_notes:\n${errors}\n\nUse get_help tool with tool_name="query_notes" for detailed usage guide.`);
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
    const parsed = z.object({}).safeParse(args);
    
    if (!parsed.success) {
      const errors = parsed.error.errors.map(err => {
        return `- ${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      throw new Error(`Invalid arguments for discover_vault:\n${errors}\n\nUse get_help tool with tool_name="discover_vault" for detailed usage guide.\n\nExample usage:\n{\n  // No parameters required\n}`);
    }

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
}
