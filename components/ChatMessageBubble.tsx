import React from 'react';
import { ChatMessage, MessageRole } from '../types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-md ${
          isUser 
            ? 'bg-blue-600 text-white rounded-br-none' 
            : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
        }`}
      >
        <div className="text-xs opacity-70 mb-1 font-medium tracking-wide">
          {isUser ? 'YOU' : 'GEMINI TRANSLATOR'}
        </div>
        <p className="text-base leading-relaxed whitespace-pre-wrap">
          {message.text}
          {!message.isFinal && (
            <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-current animate-pulse"/>
          )}
        </p>
      </div>
    </div>
  );
};

export default ChatMessageBubble;
