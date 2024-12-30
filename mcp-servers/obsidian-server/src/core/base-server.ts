import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { promises as fs } from 'fs';
import path from 'path';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { PluginManagerImpl } from './plugin-manager.js';
import { ServerConfig, MCPPlugin, PluginEventType } from './interfaces.js';
import CorePlugin from '../plugins/core/index.js';

/**
 * Base MCP server implementation that provides core functionality and plugin support
 */
export class BaseServer {
  private server: Server;
  private pluginManager: PluginManagerImpl;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.pluginManager = new PluginManagerImpl(config);

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'obsidian-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Set up request handlers
    this.setupRequestHandlers();
    
    // Set up error handling
    this.setupErrorHandling();
    
    // Set up plugin event handling
    this.setupPluginEventHandlers();
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Load plugins from configured directory
      await this.loadPlugins();

      // Set up transport
      const transport = new StdioServerTransport();
      
      // Connect server
      await this.server.connect(transport);

      // Notify plugins of server start
      const plugins = this.pluginManager.getAllPlugins();
      await Promise.all(
        plugins.map(async (plugin) => {
          if (plugin.onServerStart) {
            await plugin.onServerStart();
          }
        })
      );

      console.error('Obsidian MCP server started');
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    try {
      // Notify plugins of server stop
      const plugins = this.pluginManager.getAllPlugins();
      await Promise.all(
        plugins.map(async (plugin) => {
          if (plugin.onServerStop) {
            await plugin.onServerStop();
          }
        })
      );

      // Unload all plugins
      for (const plugin of plugins) {
        await this.pluginManager.unloadPlugin(plugin.name);
      }

      // Close server connection
      await this.server.close();

      console.error('Obsidian MCP server stopped');
    } catch (error) {
      console.error('Error stopping server:', error);
      throw error;
    }
  }

  /**
   * Set up MCP request handlers
   */
  private setupRequestHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.pluginManager
        .getAllPlugins()
        .flatMap(plugin => plugin.getTools());
      
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      // Find plugin with matching tool
      const plugin = this.findPluginForTool(request.params.name);
      if (!plugin) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool '${request.params.name}' not found`
        );
      }

      try {
        // Get tool definition
        const toolDef = plugin.getTools().find(t => t.name === request.params.name);
        if (!toolDef) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool definition for '${request.params.name}' not found`
          );
        }

        // Validate input against schema
        const validatedInput = await toolDef.inputSchema.parseAsync(
          request.params.arguments
        );

        // Execute tool through plugin's handleToolCall method
        return await plugin.handleToolCall(request.params.name, validatedInput);
      } catch (error) {
        // Get tool help plugin if available
        const toolHelpPlugin = this.pluginManager.getPlugin('tool-help');
        let errorMessage = error instanceof Error ? error.message : String(error);

        // Add help information if tool-help plugin is available
        if (toolHelpPlugin && 'formatErrorHelp' in toolHelpPlugin) {
          errorMessage = (toolHelpPlugin as any).formatErrorHelp(
            request.params.name,
            plugin.name,
            error instanceof Error ? error : new Error(errorMessage)
          );
        }

        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          errorMessage
        );
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = this.pluginManager
        .getAllPlugins()
        .flatMap(plugin => plugin.getResources?.() ?? []);
      
      return { resources };
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      // Find plugin with matching resource
      const plugin = this.findPluginForResource(request.params.uri);
      if (!plugin) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Resource '${request.params.uri}' not found`
        );
      }

      try {
        // Get resource definition
        const resourceDef = plugin.getResources?.()?.find(r => r.uri === request.params.uri);
        if (!resourceDef) {
          throw new McpError(
          ErrorCode.InvalidRequest,
            `Resource definition for '${request.params.uri}' not found`
          );
        }

        // Return resource content
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: resourceDef.mimeType,
              text: JSON.stringify({ message: 'Resource content placeholder' })
            }
          ]
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error reading resource: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
    this.server.onerror = async (error: Error) => {
      console.error('[Server Error]', error);
      
      // Notify plugins of error
      const plugins = this.pluginManager.getAllPlugins();
      for (const plugin of plugins) {
        if (plugin.onError) {
          try {
            await this.pluginManager.onPluginError(plugin, error);
          } catch (e) {
            console.error(`Error in plugin ${plugin.name} error handler:`, e);
          }
        }
      }
    };
  }

  /**
   * Set up plugin event handlers
   */
  private setupPluginEventHandlers(): void {
    // Handle plugin load events
    this.pluginManager.on(PluginEventType.LOADED, async (event) => {
      console.error(`Plugin ${event.pluginName} loaded`);
    });

    // Handle plugin unload events
    this.pluginManager.on(PluginEventType.UNLOADED, async (event) => {
      console.error(`Plugin ${event.pluginName} unloaded`);
    });

    // Handle plugin errors
    this.pluginManager.on(PluginEventType.ERROR, async (event) => {
      console.error(`Error in plugin ${event.pluginName}:`, event.data);
    });
  }

  /**
   * Load plugins from the configured plugin directory
   */
  private async loadPlugins(): Promise<void> {
    try {
      const enabledPlugins = process.env.ENABLED_PLUGINS?.split(',') || ['core', 'tool-help'];
      
      // Always load tool-help plugin first
      const ToolHelpPlugin = (await import('../plugins/tool-help/index.js')).default;
      const toolHelpPlugin = new ToolHelpPlugin();
      await toolHelpPlugin.onLoad();
      await this.pluginManager.loadPlugin('tool-help', toolHelpPlugin);

      // Then load core plugin if enabled
      if (enabledPlugins.includes('core')) {
        const CorePlugin = (await import('../plugins/core/index.js')).default;
        const corePlugin = new CorePlugin(this.config);
        if ('registerToolHelp' in corePlugin) {
          (corePlugin as any).registerToolHelp(toolHelpPlugin);
        }
        await corePlugin.onLoad();
        await this.pluginManager.loadPlugin('core', corePlugin);
      }

      // Load additional plugins if enabled
      for (const pluginName of enabledPlugins) {
        if (pluginName === 'core' || pluginName === 'tool-help') continue;

        try {
          const Plugin = (await import(`../plugins/${pluginName}/index.js`)).default;
          const corePlugin = this.pluginManager.getPlugin('core') as CorePlugin;
          if (!corePlugin) {
            throw new Error('Core plugin must be loaded before loading other plugins');
          }
          const plugin = new Plugin(this.config, corePlugin);
          if ('registerToolHelp' in plugin) {
            (plugin as any).registerToolHelp(toolHelpPlugin);
          }
          await plugin.onLoad();
          await this.pluginManager.loadPlugin(pluginName, plugin);
        } catch (error) {
          console.error(`Failed to load plugin ${pluginName}:`, error);
          throw error;
        }
      }

      console.error(`Plugins loaded successfully: ${enabledPlugins.join(', ')}`);
    } catch (error) {
      console.error('Failed to load plugins:', error);
      throw error;
    }
  }

  /**
   * Find plugin that provides a specific tool
   */
  private findPluginForTool(toolName: string): MCPPlugin | undefined {
    return this.pluginManager
      .getAllPlugins()
      .find(plugin => plugin.getTools().some(tool => tool.name === toolName));
  }

  /**
   * Find plugin that provides a specific resource
   */
  private findPluginForResource(uri: string): MCPPlugin | undefined {
    return this.pluginManager
      .getAllPlugins()
      .find(plugin => plugin.getResources?.()?.some(resource => resource.uri === uri));
  }
}
