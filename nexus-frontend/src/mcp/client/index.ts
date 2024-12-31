import { 
  Tool, 
  ToolExecutionRequest, 
  ToolExecutionResponse, 
  MCPError,
  Resource,
  ResourceTemplate,
  ResourceContent,
  QueryRequest,
  QueryResponse
} from '../types';

class MCPClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (message: any) => void> = new Map();

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.baseUrl.replace('http', 'ws') + '/ws');

        this.ws.onopen = () => {
          resolve();
        };

        this.ws.onclose = () => {
          this.ws = null;
        };

        this.ws.onerror = (error) => {
          reject(new MCPError('WebSocket connection error', 'CONNECTION_ERROR', { error }));
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
          }
        };
      } catch (error) {
        reject(new MCPError('Failed to create WebSocket connection', 'CONNECTION_ERROR', { error }));
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleWebSocketMessage(message: any) {
    if (message.type === 'tool_execution') {
      const handler = this.messageHandlers.get('tool_execution');
      if (handler) {
        handler(message);
      }
    }
  }

  onToolExecution(handler: (message: any) => void) {
    this.messageHandlers.set('tool_execution', handler);
    return () => {
      this.messageHandlers.delete('tool_execution');
    };
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new MCPError(
        error.detail || 'API request failed',
        'API_ERROR',
        { status: response.status, endpoint }
      );
    }

    return response.json();
  }

  async getServers(): Promise<string[]> {
    const response = await this.fetchApi('/api/servers');
    return response.servers;
  }

  async getResources(): Promise<Resource[]> {
    const response = await this.fetchApi('/api/resources');
    return response.resources;
  }

  async getResourceTemplates(): Promise<ResourceTemplate[]> {
    const response = await this.fetchApi('/api/resource-templates');
    return response.templates;
  }

  async getResourceContent(uri: string): Promise<ResourceContent> {
    const encodedUri = encodeURIComponent(uri);
    const response = await this.fetchApi(`/api/resources/${encodedUri}`);
    return response;
  }

  async getTools(): Promise<Tool[]> {
    const response = await this.fetchApi('/api/tools');
    return response.tools;
  }

  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    const response = await this.fetchApi(`/api/tools/${request.name}/execute`, {
      method: 'POST',
      body: JSON.stringify(request.arguments),
    });
    return response;
  }

  async processQuery(request: QueryRequest): Promise<QueryResponse> {
    const response = await this.fetchApi('/api/query', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response;
  }
}

export const createMCPClient = (baseUrl?: string) => new MCPClient(baseUrl);
