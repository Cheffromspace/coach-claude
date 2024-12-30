import { z } from "zod"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"

export interface ResourceDefinition {
  uri: string
  name: string
  mimeType?: string
  description?: string
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: z.ZodSchema
}

/**
 * Interface for MCP plugins
 */
export interface MCPPlugin {
  // Metadata
  name: string
  version: string
  description?: string
  
  // Lifecycle hooks
  onLoad(): Promise<void>
  onUnload(): Promise<void>
  
  // Tool/Resource Registration
  getTools(): ToolDefinition[]
  getResources?(): ResourceDefinition[]
  handleToolCall(toolName: string, args: unknown): Promise<any>
  
  // Optional hooks
  onServerStart?(): Promise<void>
  onServerStop?(): Promise<void>
  onError?(error: Error): void
}

/**
 * Plugin configuration options
 */
export interface PluginConfig {
  enabled: boolean
  settings?: Record<string, unknown>
}

/**
 * Plugin manager interface
 */
export interface PluginManager {
  loadPlugin(pluginName: string, plugin: MCPPlugin): Promise<void>
  unloadPlugin(pluginName: string): Promise<void>
  getPlugin(pluginName: string): MCPPlugin | undefined
  getAllPlugins(): MCPPlugin[]
  onPluginError(plugin: MCPPlugin, error: Error): void
}

/**
 * Plugin state management
 */
export interface PluginState {
  isLoaded: boolean
  isEnabled: boolean
  error?: Error
}

/**
 * Base server configuration
 */
export interface ServerConfig {
  vaultDirectories: string[]
  pluginDirectory: string
  pluginConfigs: Record<string, PluginConfig>
}

/**
 * Plugin event types
 */
export enum PluginEventType {
  LOADED = 'loaded',
  UNLOADED = 'unloaded',
  ERROR = 'error',
  STATE_CHANGED = 'state_changed'
}

/**
 * Plugin event interface
 */
export interface PluginEvent {
  type: PluginEventType
  pluginName: string
  timestamp: number
  data?: unknown
}

/**
 * Plugin event handler type
 */
export type PluginEventHandler = (event: PluginEvent) => void | Promise<void>

/**
 * Plugin event emitter interface
 */
export interface PluginEventEmitter {
  on(event: PluginEventType, handler: PluginEventHandler): void
  off(event: PluginEventType, handler: PluginEventHandler): void
  emit(event: PluginEvent): void | Promise<void>
}
