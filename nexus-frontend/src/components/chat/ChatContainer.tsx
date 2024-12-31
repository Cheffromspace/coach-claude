import React from 'react';

interface IChatContainerProps {
  children?: React.ReactNode;
}

const ChatContainer: React.FC<IChatContainerProps> = ({ children }) => {
  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
      {children}
    </div>
  );
};

export default ChatContainer;
