import { promises as fs } from 'fs';
import path from 'path';
import {
  MCPPlugin,
  PluginManager,
  PluginState,
  PluginEvent,
  PluginEventType,
  PluginEventHandler,
  PluginEventEmitter,
  ServerConfig
} from './interfaces.js';

/**
 * Implementation of the plugin event emitter
 */
class PluginEventEmitterImpl implements PluginEventEmitter {
  private handlers: Map<PluginEventType, Set<PluginEventHandler>>;

  constructor() {
    this.handlers = new Map();
    // Initialize handler sets for each event type
    Object.values(PluginEventType).forEach(type => {
      this.handlers.set(type, new Set());
    });
  }

  on(event: PluginEventType, handler: PluginEventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.add(handler);
    }
  }

  off(event: PluginEventType, handler: PluginEventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  async emit(event: PluginEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      const promises = Array.from(handlers).map(handler => handler(event));
      await Promise.all(promises);
    }
  }
}

/**
 * Implementation of the plugin manager
 */
export class PluginManagerImpl implements PluginManager {
  private plugins: Map<string, MCPPlugin>;
  private pluginStates: Map<string, PluginState>;
  private eventEmitter: PluginEventEmitter;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.plugins = new Map();
    this.pluginStates = new Map();
    this.eventEmitter = new PluginEventEmitterImpl();
    this.config = config;
  }

  /**
   * Load a plugin with the given name
   */
  async loadPlugin(pluginName: string, plugin: MCPPlugin): Promise<void> {
    try {
      // Validate plugin interface
      this.validatePlugin(plugin);
      
      // Check if plugin is already loaded
      if (this.plugins.has(pluginName)) {
        throw new Error(`Plugin ${pluginName} is already loaded`);
      }

      // Initialize plugin state
      this.pluginStates.set(pluginName, {
        isLoaded: false,
        isEnabled: false
      });

      // Update plugin state
      this.plugins.set(pluginName, plugin);
      this.pluginStates.set(pluginName, {
        isLoaded: true,
        isEnabled: true
      });

      // Emit loaded event
      await this.eventEmitter.emit({
        type: PluginEventType.LOADED,
        pluginName,
        timestamp: Date.now()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load plugin ${pluginName}: ${errorMessage}`);
    }
  }

  /**
   * Unload a plugin by name
   */
  async unloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not loaded`);
    }

    try {
      // Call plugin's onUnload hook
      await plugin.onUnload();

      // Remove plugin
      this.plugins.delete(pluginName);
      this.pluginStates.delete(pluginName);

      // Emit unloaded event
      await this.eventEmitter.emit({
        type: PluginEventType.UNLOADED,
        pluginName: plugin.name,
        timestamp: Date.now()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to unload plugin ${pluginName}: ${errorMessage}`);
    }
  }

  /**
   * Get a plugin by name
   */
  getPlugin(pluginName: string): MCPPlugin | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): MCPPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Handle plugin errors
   */
  async onPluginError(plugin: MCPPlugin, error: Error): Promise<void> {
    // Update plugin state
    this.pluginStates.set(plugin.name, {
      ...this.pluginStates.get(plugin.name)!,
      error
    });

    // Call plugin's error handler if it exists
    if (plugin.onError) {
      plugin.onError(error);
    }

    // Emit error event
    await this.eventEmitter.emit({
      type: PluginEventType.ERROR,
      pluginName: plugin.name,
      timestamp: Date.now(),
      data: error
    });
  }

  /**
   * Subscribe to plugin events
   */
  on(event: PluginEventType, handler: PluginEventHandler): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Unsubscribe from plugin events
   */
  off(event: PluginEventType, handler: PluginEventHandler): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Get plugin state
   */
  getPluginState(pluginName: string): PluginState | undefined {
    return this.pluginStates.get(pluginName);
  }

  /**
   * Validate that a plugin implements the required interface
   */
  private validatePlugin(plugin: MCPPlugin): void {
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('Plugin must have a name');
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new Error('Plugin must have a version');
    }

    if (typeof plugin.onLoad !== 'function') {
      throw new Error('Plugin must implement onLoad method');
    }

    if (typeof plugin.onUnload !== 'function') {
      throw new Error('Plugin must implement onUnload method');
    }

    if (typeof plugin.getTools !== 'function') {
      throw new Error('Plugin must implement getTools method');
    }

    if (typeof plugin.handleToolCall !== 'function') {
      throw new Error('Plugin must implement handleToolCall method');
    }
  }
}
