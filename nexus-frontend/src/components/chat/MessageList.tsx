'use client';

import React, { useEffect, useRef } from 'react';
import { IMessageListProps } from '../../types/chat';
import { ResourcePreview } from './ResourcePreview';

const MessageList: React.FC<IMessageListProps> = ({ messages, onMessageAction }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getMessageClasses = (sender: 'user' | 'system') => {
    const baseClasses = "max-w-[80%] rounded-lg p-4 mb-4";
    return sender === 'user'
      ? `${baseClasses} bg-blue-500 text-white self-end`
      : `${baseClasses} bg-gray-100 dark:bg-gray-700 dark:text-white self-start`;
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-col space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={getMessageClasses(message.sender)}
          >
            <div className="flex flex-col">
              {message.type === 'code' && (
                <div className="bg-gray-800 rounded p-2 font-mono text-sm text-white overflow-x-auto">
                  <pre>
                    <code>{message.content}</code>
                  </pre>
                </div>
              )}
              {message.type === 'text' && (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              )}
              {message.type === 'error' && (
                <p className="text-red-500 dark:text-red-400">{message.content}</p>
              )}
              {(message.type === 'tool-use' || message.type === 'tool-result') && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                  {message.metadata?.toolName && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Tool: {message.metadata.toolName}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              )}
              {message.type === 'resource' && message.metadata?.resourceUri && (
                <div>
                  {message.metadata.resourceType && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Resource Type: {message.metadata.resourceType}
                    </div>
                  )}
                  <ResourcePreview uri={message.metadata.resourceUri} />
                </div>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;
