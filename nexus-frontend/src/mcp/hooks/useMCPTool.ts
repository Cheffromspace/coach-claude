import { useState, useCallback } from 'react';
import { useMCP } from '../context/MCPProvider';
import { Tool, ToolExecutionRequest, ToolExecutionResponse } from '../types';

interface UseMCPToolResult {
  loading: boolean;
  error: Error | null;
  execute: (name: string, args: Record<string, any>) => Promise<ToolExecutionResponse>;
  tools: Tool[];
}

export function useMCPTool(): UseMCPToolResult {
  const { tools, executeTool } = useMCP();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (name: string, args: Record<string, any>) => {
      setLoading(true);
      setError(null);

      try {
        const request: ToolExecutionRequest = {
          name,
          arguments: args,
        };
        const response = await executeTool(request);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Tool execution failed');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [executeTool]
  );

  return {
    loading,
    error,
    execute,
    tools,
  };
}
