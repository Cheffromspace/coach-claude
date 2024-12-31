'use client';

import React, { useState, useCallback } from 'react';
import { IMessage } from '../../types/chat';
import { useMCP } from '../../mcp/context/MCPProvider';
import ChatContainer from './ChatContainer';
import MessageList from './MessageList';
import InputArea from './InputArea';

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const { processQuery, status } = useMCP();
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = useCallback(async (content: string) => {
    // Create a new message object
    const userMessage: IMessage = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      type: 'text'
    };

    // Add user message to the list
    setMessages(prev => [...prev, userMessage]);

    try {
      setIsLoading(true);

      // Process query
      const response = await processQuery({
        content,
        context: messages.map(msg => ({
          role: msg.sender,
          content: msg.content
        }))
      });

      // Add response message
      const responseMessage: IMessage = {
        id: (Date.now() + 1).toString(),
        content: response.content.map(c => c.text).join('\n'),
        sender: 'system',
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, responseMessage]);
    } catch (error) {
      // Add error message
      const errorMessage: IMessage = {
        id: (Date.now() + 1).toString(),
        content: error instanceof Error ? error.message : 'An error occurred while processing your message.',
        sender: 'system',
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [processQuery, messages, setMessages]);

  return (
    <ChatContainer>
      <MessageList messages={messages} />
      <InputArea
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        placeholder="Type your message here..."
      />
    </ChatContainer>
  );
};

export default Chat;
