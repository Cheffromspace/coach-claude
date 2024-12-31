export interface IMessage {
  id: string;
  content: string;
  sender: 'user' | 'system';
  timestamp: Date;
  type: 'text' | 'code' | 'error' | 'tool-use' | 'tool-result' | 'resource';
  metadata?: {
    language?: string;  // For code blocks
    toolName?: string;  // For tool usage
    status?: 'pending' | 'success' | 'error';  // For tool results
    resourceUri?: string;  // For resource messages
    resourceType?: string;  // For resource messages (e.g., 'note', 'goal', 'habit')
  };
}

export interface IMessageListProps {
  messages: IMessage[];
  onMessageAction?: (messageId: string, action: string) => void;
}
