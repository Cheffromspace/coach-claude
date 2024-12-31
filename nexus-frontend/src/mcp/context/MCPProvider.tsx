import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createMCPClient } from '../client';
import {
  ConnectionStatus,
  MCPContextValue,
  MCPProviderProps,
  Tool,
  Resource,
  ResourceTemplate,
  ToolExecutionRequest,
  ResourceContent,
  MCPError,
  QueryRequest,
  QueryResponse,
} from '../types';

const MCPContext = createContext<MCPContextValue | null>(null);

export function MCPProvider({
  children,
  config = {
    autoConnect: true,
    retryAttempts: 3,
    retryDelay: 1000,
  },
}: MCPProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [tools, setTools] = useState<Tool[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceTemplates, setResourceTemplates] = useState<ResourceTemplate[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  const client = useMemo(() => createMCPClient(), []);

  const loadServerData = async () => {
    try {
      // Load tools first as they are required
      const toolsData = await client.getTools();
      setTools(toolsData);
      setStatus('connected');

      // Load optional resources and templates
      try {
        const resourcesData = await client.getResources();
        setResources(resourcesData);
      } catch (error) {
        console.warn('Failed to load resources:', error);
        setResources([]);
      }

      try {
        const templatesData = await client.getResourceTemplates();
        setResourceTemplates(templatesData);
      } catch (error) {
        console.warn('Failed to load resource templates:', error);
        setResourceTemplates([]);
      }
    } catch (error) {
      console.error('Failed to load tools:', error);
      setStatus('error');
    }
  };

  const connect = async () => {
    try {
      setStatus('connecting');
      await client.connect();
      await loadServerData();
    } catch (error) {
      console.error('Connection failed:', error);
      setStatus('error');

      if (retryCount < (config.retryAttempts || 3)) {
        setTimeout(() => {
          setRetryCount(count => count + 1);
          connect();
        }, config.retryDelay || 1000);
      }
    }
  };

  const disconnect = async () => {
    try {
      await client.disconnect();
      setStatus('disconnected');
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const executeTool = async (request: ToolExecutionRequest) => {
    if (status !== 'connected') {
      throw new MCPError('Not connected to MCP server', 'NOT_CONNECTED');
    }
    return client.executeTool(request);
  };

  const getResource = async (uri: string): Promise<ResourceContent> => {
    if (status !== 'connected') {
      throw new MCPError('Not connected to MCP server', 'NOT_CONNECTED');
    }
    return client.getResourceContent(uri);
  };

  useEffect(() => {
    if (config.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [config.autoConnect]);

  const processQuery = async (request: QueryRequest): Promise<QueryResponse> => {
    if (status !== 'connected') {
      throw new MCPError('Not connected to MCP server', 'NOT_CONNECTED');
    }
    return client.processQuery(request);
  };

  const value: MCPContextValue = {
    status,
    tools,
    resources,
    resourceTemplates,
    executeTool,
    getResource,
    processQuery,
    connect,
    disconnect,
  };

  return <MCPContext.Provider value={value}>{children}</MCPContext.Provider>;
}

export function useMCP() {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within an MCPProvider');
  }
  return context;
}
