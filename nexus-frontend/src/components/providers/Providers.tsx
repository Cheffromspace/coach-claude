'use client';

import { MCPProvider } from "../../mcp/context/MCPProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MCPProvider>
      {children}
    </MCPProvider>
  );
}
