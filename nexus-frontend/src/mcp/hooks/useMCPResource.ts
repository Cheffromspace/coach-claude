import { useState, useCallback } from 'react';
import { useMCP } from '../context/MCPProvider';
import { Resource, ResourceContent, ResourceTemplate } from '../types';

interface UseMCPResourceResult {
  loading: boolean;
  error: Error | null;
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
  getResourceContent: (uri: string) => Promise<ResourceContent>;
}

export function useMCPResource(): UseMCPResourceResult {
  const { resources, resourceTemplates, getResource } = useMCP();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getResourceContent = useCallback(
    async (uri: string) => {
      setLoading(true);
      setError(null);

      try {
        const content = await getResource(uri);
        return content;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch resource');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [getResource]
  );

  return {
    loading,
    error,
    resources,
    resourceTemplates,
    getResourceContent,
  };
}
