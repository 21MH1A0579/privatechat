import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Message } from '../types/Message';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onSeenOnceViewed: (messageId: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isOwn, 
  onSeenOnceViewed 
}) => {
  const [seenOnceRevealed, setSeenOnceRevealed] = useState(false);

  const handleRevealSeenOnce = () => {
    if (message.seenOnce && !isOwn && !seenOnceRevealed) {
      setSeenOnceRevealed(true);
      // Delay the removal to allow user to see the message
      setTimeout(() => {
        onSeenOnceViewed(message.id);
      }, 3000); // Show for 3 seconds
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderSeenOnceContent = () => {
    if (isOwn) {
      // Sender can always see their own seen-once messages
      return renderMessageContent();
    }

    if (!seenOnceRevealed) {
      return (
        <div 
          className="flex items-center space-x-2 cursor-pointer"
          onClick={handleRevealSeenOnce}
        >
          <EyeOff className="w-4 h-4" />
          <span className="text-sm">Tap to view once</span>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {renderMessageContent()}
        <div className="text-xs opacity-75 flex items-center">
          <Eye className="w-3 h-3 mr-1" />
          Disappearing in 3s...
        </div>
      </div>
    );
  };

  const renderMessageContent = () => {
    if (message.type === 'image') {
      return (
        <img
          src={message.content}
          alt="Shared image"
          className="max-w-xs rounded-lg"
          loading="lazy"
        />
      );
    }

    return (
      <p className="whitespace-pre-wrap break-words">
        {message.content}
      </p>
    );
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end space-x-2`}>
      {/* Avatar for other person's messages (left side) */}
      {!isOwn && (
        <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {message.senderKey.charAt(0)}
        </div>
      )}
      
      {/* Message bubble */}
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-last' : ''}`}>
        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-blue-600 text-white'
              : message.seenOnce
              ? 'bg-purple-100 text-purple-900 border-2 border-purple-300'
              : 'bg-gray-100 text-gray-900'
          } ${message.seenOnce ? 'relative' : ''}`}
        >
          {message.seenOnce && (
            <div className="absolute -top-1 -right-1">
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
            </div>
          )}
          
          {message.seenOnce ? renderSeenOnceContent() : renderMessageContent()}
        </div>
        
        <div className={`text-xs text-gray-500 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
          <span>{formatTime(message.timestamp)}</span>
          {message.seen && isOwn && (
            <span className="ml-2 text-blue-500">✓✓</span>
          )}
          {message.seenOnce && (
            <span className="ml-2">👁️</span>
          )}
        </div>
      </div>
      
      {/* Avatar for own messages (right side) */}
      {isOwn && (
        <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {message.senderKey.charAt(0)}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;