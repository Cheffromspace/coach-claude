#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

class TestServer {
  constructor() {
    this.server = new Server(
      {
        name: 'test-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler('list_tools', async () => ({
      tools: [
        {
          name: 'echo',
          description: 'Echo back the input',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Message to echo'
              }
            },
            required: ['message']
          }
        }
      ]
    }));

    this.server.setRequestHandler('call_tool', async (request) => {
      if (request.params.name === 'echo') {
        return {
          content: [
            {
              type: 'text',
              text: `Echo: ${request.params.arguments.message}`
            }
          ]
        };
      }
      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Test MCP server running on stdio');
  }
}

const server = new TestServer();
server.run().catch(console.error);
