#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { FileManager } from './utils/file.js';
import { ContentValidator } from './utils/validation.js';

class ScratchPadServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'scratch-pad-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'update_scratch_pad',
          description: 'Update the scratch pad content',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'New content to set',
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'get_scratch_pad',
          description: 'Get the current scratch pad content',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'update_scratch_pad': {
            const { content } = request.params.arguments as { content: string };
            
            // Validate content
            ContentValidator.validate(content);
            
            // Update content
            await FileManager.updateContent(content);
            
            return {
              content: [
                {
                  type: 'text',
                  text: 'Successfully updated scratch pad content',
                },
              ],
            };
          }

          case 'get_scratch_pad': {
            const content = await FileManager.readContent();
            
            return {
              content: [
                {
                  type: 'text',
                  text: content,
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: unknown) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'scratch_pad://content',
          name: 'Scratch Pad Content',
          description: 'Current content of the scratch pad',
          mimeType: 'text/plain',
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        if (request.params.uri !== 'scratch_pad://content') {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid resource URI: ${request.params.uri}`
          );
        }

        const content = await FileManager.readContent();

        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: 'text/plain',
              text: content,
            },
          ],
        };
      } catch (error: unknown) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Resource read failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async run() {
    try {
      // Initialize file system
      await FileManager.initialize();

      // Connect server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error('Scratch Pad MCP server running on stdio');
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start server
const server = new ScratchPadServer();
server.run().catch(console.error);
