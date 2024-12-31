import { ReactNode } from 'react';

// MCP Connection States
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// MCP Tool Types
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface ToolExecutionRequest {
  name: string;
  arguments: Record<string, any>;
}

export interface ToolExecutionResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

// MCP Resource Types
export interface Resource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

// MCP Context Types
export interface MCPContextValue {
  status: ConnectionStatus;
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
  executeTool: (request: ToolExecutionRequest) => Promise<ToolExecutionResponse>;
  getResource: (uri: string) => Promise<ResourceContent>;
  processQuery: (request: QueryRequest) => Promise<QueryResponse>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export interface MCPProviderProps {
  children: ReactNode;
  config?: {
    autoConnect?: boolean;
    retryAttempts?: number;
    retryDelay?: number;
  };
}

// Plugin Types
export interface Plugin {
  id: string;
  name: string;
  description: string;
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
}

// Query Types
export interface QueryRequest {
  content: string;
  context?: Array<{
    role: string;
    content: string;
  }>;
}

export interface QueryResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

// Error Types
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'MCPError';
  }
}
