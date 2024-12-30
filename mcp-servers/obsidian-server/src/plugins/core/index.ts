import { z } from "zod";
import { MCPPlugin, ToolDefinition } from "../../core/interfaces.js";
import { ServerConfig } from "../../core/interfaces.js";
import { validatePath, normalizeNotePath, readNote } from "../../utils.js";
import { ReadNotesArgsSchema, QueryNotesArgsSchema } from "./schemas.js";
import { getMarkdownFiles, parseDataviewQuery, executeQuery } from "./query-engine.js";
import { TagManager } from "./tag-manager.js";
import { TagHandlers } from "./tag-handlers.js";
import fs from "fs/promises";
import path from "path";

/**
 * Core plugin providing essential Obsidian note operations
 */
export default class CorePlugin implements MCPPlugin {
  name = "core";
  version = "1.0.0";
  description = "Core Obsidian functionality for note operations";

  private config: ServerConfig;
  private tagManager: TagManager;
  private tagHandlers: TagHandlers;

  private toolHelpPlugin?: any;

  constructor(config: ServerConfig) {
    this.config = config;
    this.tagManager = new TagManager();
    this.tagHandlers = new TagHandlers(this.tagManager);
  }

  registerToolHelp(toolHelpPlugin: any) {
    this.toolHelpPlugin = toolHelpPlugin;
    
    // Register help for core tools
    this.toolHelpPlugin.registerPluginHelp(this, {
      "create_note": {
        summary: "Create a new note in the vault",
        description: "Creates a new markdown note with optional frontmatter metadata and content. The note will be created in the specified folder with the given title.",
        examples: [
          'Create a simple note: { "folder": "misc", "title": "My Note", "content": "# My Note\\n\\nSome content here" }',
          'Create note with metadata: { "folder": "projects", "title": "Project X", "content": "# Project X\\n\\nProject details...", "metadata": { "type": "project", "status": "active", "tags": ["work", "planning"] } }',
          'Create dated note: { "folder": "journal", "title": "Daily Log", "content": "Today\'s notes...", "useDate": true }'
        ],
        sections: [
          {
            title: "Arguments",
            content: [
              "folder: (required) The folder path where the note should be created",
              "title: (required) The title of the note",
              "content: (required) The main content of the note", 
              "metadata: (optional) An object containing frontmatter metadata fields",
              "useDate: (optional) Whether to prefix the filename with today's date (YYYY-MM-DD-)"
            ].join("\n")
          },
          {
            title: "Returns",
            content: "A success message with the created note's path"
          },
          {
            title: "Notes",
            content: [
              "- The note title will be converted to a filename by:",
              "  - Converting to lowercase",
              "  - Replacing spaces with hyphens", 
              "  - Adding .md extension",
              "- If useDate is true, the filename will be prefixed with YYYY-MM-DD-",
              "- The folder will be created if it doesn't exist",
              "- Any provided metadata will be added as YAML frontmatter"
            ].join("\n")
          }
        ]
      }
    });
  }

  async onLoad(): Promise<void> {
    console.error('Core plugin loaded');
    await this.tagManager.initialize(this.config.vaultDirectories[0]);
  }

  async onUnload(): Promise<void> {
    console.error('Core plugin unloaded');
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "read_notes",
        description: "Read content from specified notes",
        inputSchema: ReadNotesArgsSchema
      },
      {
        name: "search_notes",
        description: "Search for content in notes using regex patterns",
        inputSchema: z.object({
          pattern: z.string(),
          caseSensitive: z.boolean().optional(),
          maxMatchesPerFile: z.number().optional(),
          contextLines: z.number().optional(),
          filePattern: z.string().optional()
        })
      },
      {
        name: "query_notes",
        description: "Query notes using Dataview-style syntax",
        inputSchema: QueryNotesArgsSchema
      },
      {
        name: "discover_vault",
        description: "Discover vault structure and metadata fields",
        inputSchema: z.object({})
      },
      {
        name: "create_note",
        description: "Create a new note in the vault",
        inputSchema: z.object({
          folder: z.string(),
          title: z.string(),
          content: z.string(),
          metadata: z.record(z.unknown()).optional(),
          useDate: z.boolean().optional()
        })
      },
      {
        name: "update_note",
        description: "Update an existing note",
        inputSchema: z.object({
          path: z.string(),
          content: z.string().optional(),
          metadata: z.record(z.unknown()).optional()
        })
      },
      {
        name: "delete_note",
        description: "Delete a note",
        inputSchema: z.object({
          path: z.string()
        })
      },
      {
        name: "get_note",
        description: "Get note content",
        inputSchema: z.object({
          path: z.string()
        })
      },
      {
        name: "list_notes",
        description: "List notes in a folder",
        inputSchema: z.object({
          folder: z.string(),
          recursive: z.boolean().optional()
        })
      },
      {
        name: "set_tag_relationship",
        description: "Set a relationship between two tags",
        inputSchema: z.object({
          tag: z.string(),
          relatedTag: z.string(),
          type: z.enum(['similar', 'opposite', 'broader', 'narrower', 'custom']),
          strength: z.number().min(1).max(5).optional(),
          notes: z.string().optional()
        })
      },
      {
        name: "set_tag_hierarchy",
        description: "Set parent-child relationships for a tag",
        inputSchema: z.object({
          tag: z.string(),
          parent: z.string().optional(),
          children: z.array(z.string()).optional()
        })
      },
      {
        name: "get_tag_stats",
        description: "Get statistics about tag usage",
        inputSchema: z.object({})
      }
    ];
  }

  async handleToolCall(toolName: string, args: unknown): Promise<any> {
    const vaultRoot = this.config.vaultDirectories[0]; // Use first vault for now

    switch (toolName) {
      case "read_notes": {
        const parsed = ReadNotesArgsSchema.safeParse(args);
        if (!parsed.success) {
          const errors = parsed.error.errors.map(err => {
            return `- ${err.path.join('.')}: ${err.message}`;
          }).join('\n');
          throw new Error(`Invalid arguments for read_notes:\n${errors}`);
        }

        try {
          const contents = await Promise.all(
            parsed.data.paths.map(async (notePath) => {
              const normalizedPath = normalizeNotePath(notePath);
              const fullPath = path.join(vaultRoot, normalizedPath);
              const validPath = await validatePath(fullPath, [vaultRoot]);
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

      case "search_notes": {
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
          throw new Error(`Invalid arguments for search_notes:\n${errors}`);
        }

        try {
          const maxMatchesPerFile = parsed.data.maxMatchesPerFile || 3;
          const contextLines = parsed.data.contextLines || 2;
          const fileRegex = parsed.data.filePattern ? new RegExp(parsed.data.filePattern) : null;
          
          const files = await getMarkdownFiles(vaultRoot, vaultRoot);
          const results: Array<{
            file: string;
            matches: Array<{
              line: number;
              content: string;
              context: string[];
            }>;
          }> = [];

          for (const file of files) {
            const relativePath = path.relative(vaultRoot, file);
            
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

      case "query_notes": {
        const parsed = QueryNotesArgsSchema.safeParse(args);
        if (!parsed.success) {
          const errors = parsed.error.errors.map(err => {
            return `- ${err.path.join('.')}: ${err.message}`;
          }).join('\n');
          throw new Error(`Invalid arguments for query_notes:\n${errors}`);
        }

        try {
          let query = parsed.data.query;
          
          if (query.includes('#')) {
            const tags = query.match(/#[\w-]+/g)?.map(tag => tag.substring(1));
            if (tags && tags.length > 0) {
              const tagConditions = tags.map(tag => `contains(tags, "${tag}")`).join(' or ');
              query = `FROM "" WHERE ${tagConditions}`;
            }
          }

          const queryParams = parseDataviewQuery(query);
          const results = await executeQuery(vaultRoot, {
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

      case "discover_vault": {
        try {
          const files = await getMarkdownFiles(vaultRoot, vaultRoot);
          const structure: Record<string, Set<string>> = {};

          for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            const relativePath = path.relative(vaultRoot, file);
            const folder = path.dirname(relativePath);

            if (!structure[folder]) {
              structure[folder] = new Set();
            }

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

      case "create_note": {
        const { folder, title, content, metadata, useDate } = await z.object({
          folder: z.string(),
          title: z.string(),
          content: z.string(),
          metadata: z.record(z.unknown()).optional(),
          useDate: z.boolean().optional()
        }).parseAsync(args);

        const date = useDate ? new Date().toISOString().split('T')[0] + '-' : '';
        const fileName = `${date}${title.toLowerCase().replace(/\s+/g, '-')}.md`;
        const notePath = path.join(folder, fileName);
        const fullPath = path.join(vaultRoot, notePath);
        
        // Ensure folder exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        // Create note content with frontmatter
        const frontmatter = metadata ? `---\n${Object.entries(metadata)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join('\n')}\n---\n\n` : '';

        await fs.writeFile(fullPath, `${frontmatter}${content}`);

        return {
          content: [{
            type: "text",
            text: `Successfully created note: ${notePath}`
          }]
        };
      }

      case "update_note": {
        const { path: notePath, content, metadata } = await z.object({
          path: z.string(),
          content: z.string().optional(),
          metadata: z.record(z.unknown()).optional()
        }).parseAsync(args);

        const normalizedPath = normalizeNotePath(notePath);
        const fullPath = path.join(vaultRoot, normalizedPath);
        const validPath = await validatePath(fullPath, [vaultRoot]);

        // Read existing note
        const existingContent = await fs.readFile(validPath, 'utf-8');
        const [existingFrontmatter, ...bodyParts] = existingContent.split('---\n').filter(Boolean);
        const existingBody = bodyParts.join('---\n');

        // Update frontmatter if provided
        let newFrontmatter = existingFrontmatter;
        if (metadata) {
          const existingMetadata = existingFrontmatter ? 
            Object.fromEntries(existingFrontmatter.split('\n')
              .filter(line => line.includes(':'))
              .map(line => {
                const [key, ...valueParts] = line.split(':');
                return [key.trim(), valueParts.join(':').trim()];
              })) : {};

          newFrontmatter = Object.entries({ ...existingMetadata, ...metadata })
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n');
        }

        // Write updated content
        const newContent = `---\n${newFrontmatter}\n---\n\n${content || existingBody}`;
        await fs.writeFile(validPath, newContent);

        return {
          content: [{
            type: "text",
            text: `Successfully updated note: ${notePath}`
          }]
        };
      }

      case "delete_note": {
        const { path: notePath } = await z.object({
          path: z.string()
        }).parseAsync(args);

        const normalizedPath = normalizeNotePath(notePath);
        const fullPath = path.join(vaultRoot, normalizedPath);
        const validPath = await validatePath(fullPath, [vaultRoot]);

        await fs.unlink(validPath);

        return {
          content: [{
            type: "text",
            text: `Successfully deleted note: ${notePath}`
          }]
        };
      }

      case "get_note": {
        const { path: notePath } = await z.object({
          path: z.string()
        }).parseAsync(args);

        const normalizedPath = normalizeNotePath(notePath);
        const fullPath = path.join(vaultRoot, normalizedPath);
        const validPath = await validatePath(fullPath, [vaultRoot]);

        const content = await fs.readFile(validPath, 'utf-8');

        return {
          content: [{
            type: "text",
            text: content
          }]
        };
      }

      case "list_notes": {
        const { folder, recursive } = await z.object({
          folder: z.string(),
          recursive: z.boolean().optional()
        }).parseAsync(args);

        const folderPath = path.join(vaultRoot, folder);
        const validPath = await validatePath(folderPath, [vaultRoot]);

        const getFiles = async (dir: string): Promise<string[]> => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const files = await Promise.all(entries.map(async (entry) => {
            const res = path.resolve(dir, entry.name);
            if (entry.isDirectory() && recursive) {
              return getFiles(res);
            }
            return entry.isFile() && entry.name.endsWith('.md') ? [res] : [];
          }));
          return files.flat();
        };

        const files = await getFiles(validPath);
        const relativePaths = files.map(file => path.relative(vaultRoot, file));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(relativePaths, null, 2)
          }]
        };
      }

      case "set_tag_relationship":
        return this.tagHandlers.setTagRelationship(args);

      case "set_tag_hierarchy":
        return this.tagHandlers.setTagHierarchy(args);

      case "get_tag_stats":
        return this.tagHandlers.getTagStats(args);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
