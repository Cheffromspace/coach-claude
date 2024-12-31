import { useState, useCallback } from 'react';
import { MCPError } from '../types';

interface UseMCPErrorResult {
  error: MCPError | null;
  setError: (error: MCPError | null) => void;
  clearError: () => void;
  handleError: (error: unknown) => void;
  isError: boolean;
}

export function useMCPError(): UseMCPErrorResult {
  const [error, setError] = useState<MCPError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof MCPError) {
      setError(error);
    } else if (error instanceof Error) {
      setError(new MCPError(error.message, 'UNKNOWN_ERROR', { originalError: error }));
    } else {
      setError(new MCPError('An unknown error occurred', 'UNKNOWN_ERROR', { error }));
    }
  }, []);

  return {
    error,
    setError,
    clearError,
    handleError,
    isError: error !== null,
  };
}

// Helper hook for handling specific error codes
export function useMCPErrorHandler(
  errorCode: string,
  handler: (error: MCPError) => void
) {
  const { error } = useMCPError();

  if (error && error.code === errorCode) {
    handler(error);
  }
}

// Helper hook for retrying operations after errors
export function useErrorRetry(
  operation: () => Promise<void>,
  options = { maxAttempts: 3, delay: 1000 }
) {
  const [attempts, setAttempts] = useState(0);
  const { handleError } = useMCPError();

  const retry = useCallback(async () => {
    try {
      await operation();
      setAttempts(0); // Reset on success
    } catch (error) {
      if (attempts < options.maxAttempts) {
        setTimeout(() => {
          setAttempts(prev => prev + 1);
          retry();
        }, options.delay);
      } else {
        handleError(error);
      }
    }
  }, [operation, attempts, options.maxAttempts, options.delay, handleError]);

  return {
    retry,
    attempts,
    hasMoreAttempts: attempts < options.maxAttempts,
  };
}
