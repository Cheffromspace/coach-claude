import { useEffect, useCallback, useRef } from 'react';
import { useMCP } from '../context/MCPProvider';

type WebSocketEventHandler = (event: any) => void;

interface UseMCPWebSocketResult {
  onToolExecution: (handler: WebSocketEventHandler) => () => void;
}

export function useMCPWebSocket(): UseMCPWebSocketResult {
  const { status } = useMCP();
  const handlersRef = useRef<Map<string, Set<WebSocketEventHandler>>>(
    new Map([['tool_execution', new Set()]])
  );

  const onToolExecution = useCallback((handler: WebSocketEventHandler) => {
    const handlers = handlersRef.current.get('tool_execution')!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }, []);

  useEffect(() => {
    // Clean up handlers when connection status changes
    return () => {
      handlersRef.current.forEach(handlers => handlers.clear());
    };
  }, [status]);

  return {
    onToolExecution,
  };
}

// Helper hook for handling specific tool execution events
export function useToolExecutionEvent(
  toolName: string,
  handler: (result: any) => void
) {
  const { onToolExecution } = useMCPWebSocket();

  useEffect(() => {
    return onToolExecution(event => {
      if (event.tool === toolName) {
        handler(event.result);
      }
    });
  }, [toolName, handler, onToolExecution]);
}
