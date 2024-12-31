import { useCallback } from 'react';
import { useMCP } from '../context/MCPProvider';
import { ConnectionStatus } from '../types';

interface UseMCPConnectionResult {
  status: ConnectionStatus;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
}

export function useMCPConnection(): UseMCPConnectionResult {
  const { status, connect, disconnect } = useMCP();

  const handleConnect = useCallback(async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Connection error:', error);
    }
  }, [connect]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }, [disconnect]);

  return {
    status,
    connect: handleConnect,
    disconnect: handleDisconnect,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    hasError: status === 'error',
  };
}
