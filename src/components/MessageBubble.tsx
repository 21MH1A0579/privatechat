import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Reply, MoreHorizontal, Heart, Play, Pause } from 'lucide-react';
import { Message } from '../types/Message';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onSeenOnceViewed: (messageId: string) => void;
  onPhotoViewed?: (messageId: string) => void;
  onReply?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
  repliedMessage?: Message; // The message being replied to
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isOwn, 
  onSeenOnceViewed,
  onPhotoViewed,
  onReply,
  onReact,
  repliedMessage
}) => {
  const [seenOnceRevealed, setSeenOnceRevealed] = useState(false);
  const [photoRevealed, setPhotoRevealed] = useState(false);
  const [photoCountdown, setPhotoCountdown] = useState(30);
  const [isDisappearing, setIsDisappearing] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [lastTap, setLastTap] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Effect to make seen-once messages disappear for sender too
  useEffect(() => {
    if (message.seenOnce && isOwn) {
      const timer = setTimeout(() => {
        setIsDisappearing(true);
        // Remove message after animation
        setTimeout(() => {
          onSeenOnceViewed(message.id);
        }, 500);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [message.seenOnce, isOwn, message.id, onSeenOnceViewed]);

  const handleRevealSeenOnce = () => {
    if (message.seenOnce && !isOwn && !seenOnceRevealed) {
      setSeenOnceRevealed(true);
      // Start disappearing animation after 2.5 seconds
      setTimeout(() => {
        setIsDisappearing(true);
      }, 2500);
      // Remove message after animation completes
      setTimeout(() => {
        onSeenOnceViewed(message.id);
      }, 3000);
    }
  };

  const handleRevealPhoto = () => {
    if (message.disappearingPhoto && !isOwn && !photoRevealed) {
      setPhotoRevealed(true);
      onPhotoViewed?.(message.id);
      
      // Add event listener to detect when user navigates away or goes back
      const handleVisibilityChange = () => {
        if (document.hidden) {
          // User switched tabs or minimized - remove the photo
          setTimeout(() => {
            onPhotoViewed?.(message.id);
          }, 100);
        }
      };

      const handleBeforeUnload = () => {
        // User is leaving the page - remove the photo
        onPhotoViewed?.(message.id);
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // Also remove photo if user clicks anywhere else after viewing
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.disappearing-photo-container')) {
          setIsDisappearing(true);
          setTimeout(() => {
            onPhotoViewed?.(message.id);
          }, 500);
        }
      };

      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);

      // Cleanup function
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };

  const handleReact = (emoji: string) => {
    if (onReact) {
      onReact(message.id, emoji);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // 300ms for double tap
    
    if (lastTap && (now - lastTap) < DOUBLE_TAP_DELAY) {
      // Double tap detected - send heart reaction
      handleReact('❤️');
      setLastTap(0); // Reset to prevent triple tap
    } else {
      // Single tap - just set the time
      setLastTap(now);
    }
  };

  const toggleAudioPlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartX(e.touches[0].clientX);
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartX) {
      const currentX = e.touches[0].clientX;
      const offset = currentX - dragStartX;
      
      // Only allow dragging to the right for left messages, left for right messages
      const allowedOffset = isOwn ? Math.min(0, offset) : Math.max(0, offset);
      
      if (Math.abs(allowedOffset) > 20) {
        setIsDragging(true);
        setDragOffset(allowedOffset);
      }
    }
  };

  const handleTouchEnd = () => {
    if (isDragging && Math.abs(dragOffset) > 50) {
      // Trigger reply if dragged enough
      handleReply();
    }
    
    // Reset drag state
    setDragStartX(0);
    setIsDragging(false);
    setDragOffset(0);
  };

  const renderSeenOnceContent = () => {
    if (isOwn) {
      // Sender sees their own message initially, but it will disappear after 3 seconds for them too
      return (
        <div className={`space-y-2 ${isDisappearing ? 'disappear-animation' : ''}`}>
          {renderMessageContent()}
          <div className="text-xs opacity-75 flex items-center">
            <Eye className="w-3 h-3 mr-1" />
            View once
          </div>
        </div>
      );
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
      <div className={`space-y-2 ${isDisappearing ? 'disappear-animation' : ''}`}>
        {renderMessageContent()}
        <div className="text-xs opacity-75 flex items-center">
          <Eye className="w-3 h-3 mr-1" />
          {isDisappearing ? 'Disappearing...' : 'Disappearing in 3s...'}
        </div>
      </div>
    );
  };

  const renderMessageContent = () => {
    if (message.type === 'image') {
      // Handle disappearing photos (WhatsApp view-once style)
      if (message.disappearingPhoto) {
        if (isOwn) {
          // Sender sees "View once" indicator but cannot see the actual photo
          return (
            <div className="relative max-w-xs">
              <div className="bg-gray-200 rounded-lg p-8 flex flex-col items-center justify-center min-h-[120px]">
                <Eye className="w-8 h-8 text-gray-500 mb-2" />
                <p className="text-sm text-gray-600 text-center">Photo</p>
                <p className="text-xs text-gray-500 text-center mt-1">View once</p>
              </div>
              <div className="absolute top-2 right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                👁️
              </div>
            </div>
          );
        } else {
          // Recipient sees blurred photo until clicked
          if (!photoRevealed) {
            return (
              <div 
                className="relative cursor-pointer max-w-xs disappearing-photo-container"
                onClick={handleRevealPhoto}
              >
                <img
                  src={message.content}
                  alt="Disappearing photo"
                  className="max-w-xs rounded-lg filter blur-lg"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                  <div className="text-white text-center">
                    <Eye className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-sm">View once</p>
                    <p className="text-xs opacity-75">Tap to open</p>
                  </div>
                </div>
              </div>
            );
          } else {
            // Photo is revealed - will disappear when user navigates away
            return (
              <div className={`relative disappearing-photo-container ${isDisappearing ? 'disappear-animation' : ''}`}>
                <img
                  src={message.content}
                  alt="Disappearing photo"
                  className="max-w-xs rounded-lg"
                  loading="lazy"
                />
                <div className="absolute top-2 right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                  Opened
                </div>
              </div>
            );
          }
        }
      }
      
      // Regular image
      return (
        <img
          src={message.content}
          alt="Shared image"
          className="max-w-xs rounded-lg"
          loading="lazy"
        />
      );
    }

    // Voice message
    if (message.type === 'voice') {
      return (
        <div className="flex items-center space-x-3 min-w-48">
          <audio
            ref={audioRef}
            src={message.content}
            onTimeUpdate={handleAudioTimeUpdate}
            onEnded={handleAudioEnded}
            className="hidden"
          />
          
          <button
            onClick={toggleAudioPlayback}
            className={`p-2 rounded-full transition-colors ${
              isOwn 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>
          
          <div className="flex-1">
            <div className={`h-1 rounded-full ${
              isOwn ? 'bg-green-200' : 'bg-gray-300'
            } relative overflow-hidden`}>
              <div 
                className={`h-full rounded-full transition-all duration-100 ${
                  isOwn ? 'bg-green-400' : 'bg-green-500'
                }`}
                style={{ width: `${audioProgress}%` }}
              />
            </div>
            <div className={`text-xs mt-1 ${
              isOwn ? 'text-green-100' : 'text-gray-600'
            }`}>
              {message.duration ? formatDuration(message.duration) : '0:00'}
            </div>
          </div>
        </div>
      );
    }

    return (
      <p className="whitespace-pre-wrap break-words">
        {message.content}
      </p>
    );
  };

  return (
    <div 
      className={`group relative mb-2 ${isOwn ? 'ml-12' : 'mr-12'} ${
        isOwn ? 'message-slide-in-right' : 'message-slide-in-left'
      } transition-transform duration-200`}
      style={{ 
        transform: isDragging ? `translateX(${dragOffset}px)` : 'translateX(0)' 
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag Reply Indicator */}
      {isDragging && Math.abs(dragOffset) > 30 && (
        <div className={`absolute top-1/2 -translate-y-1/2 ${
          isOwn ? '-left-12' : '-right-12'
        } text-gray-400 transition-opacity duration-200`}>
          <Reply className="w-5 h-5" />
        </div>
      )}

      {/* Message Actions (WhatsApp-style) */}
      {showActions && !isDragging && (
        <div className={`absolute top-1/2 -translate-y-1/2 ${
          isOwn ? '-left-16' : '-right-16'
        } flex items-center space-x-1 bg-white shadow-lg rounded-full px-2 py-1 z-10 border border-gray-200`}>
          <button
            onClick={handleReply}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            title="Reply"
          >
            <Reply className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}

      {/* WhatsApp-style Message Bubble */}
      <div className={`relative max-w-sm ${isOwn ? 'ml-auto' : 'mr-auto'}`}>
        <div
          className={`px-3 py-2 rounded-lg shadow-sm cursor-pointer ${
            isOwn
              ? 'bg-green-500 text-white rounded-br-none'
              : message.seenOnce
              ? 'bg-purple-100 text-purple-900 border border-purple-200 rounded-bl-none'
              : message.disappearingPhoto
              ? 'bg-orange-100 text-orange-900 border border-orange-200 rounded-bl-none'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
          } ${(message.seenOnce || message.disappearingPhoto) ? 'relative' : ''}`}
          onClick={handleDoubleTap}
        >
          {/* Special message indicators */}
          {message.seenOnce && (
            <div className="absolute -top-1 -right-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            </div>
          )}
          {message.disappearingPhoto && !message.seenOnce && (
            <div className="absolute -top-1 -right-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            </div>
          )}
          
          {/* Replied Message (if any) */}
          {repliedMessage && (
            <div className={`mb-2 p-2 rounded border-l-4 ${
              isOwn 
                ? 'border-green-300 bg-green-100 bg-opacity-20' 
                : 'border-gray-400 bg-gray-100'
            }`}>
              <p className={`text-xs font-medium ${
                isOwn ? 'text-green-200' : 'text-gray-600'
              }`}>
                {repliedMessage.senderKey}
              </p>
              <p className={`text-sm ${
                isOwn ? 'text-green-100' : 'text-gray-700'
              } truncate`}>
                {repliedMessage.type === 'image' ? '📷 Photo' : 
                 repliedMessage.type === 'voice' ? '🎵 Voice message' : 
                 repliedMessage.content}
              </p>
            </div>
          )}

          {/* Message Content */}
          {message.seenOnce ? renderSeenOnceContent() : renderMessageContent()}
          
          {/* Message Info (time and status) */}
          <div className={`flex items-center justify-end space-x-1 mt-1 ${
            isOwn ? 'text-green-100' : 'text-gray-500'
          } text-xs`}>
            <span>{formatTime(message.timestamp)}</span>
            {message.seenOnce && (
              <span className="text-purple-600">👁️</span>
            )}
            {message.disappearingPhoto && (
              <span className="text-orange-600">⏰</span>
            )}
          </div>
        </div>

        {/* Message Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {message.reactions.map((reaction, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-full px-2 py-1 text-xs shadow-sm flex items-center space-x-1"
              >
                <span>{reaction.emoji}</span>
                <span className="text-gray-600">{reaction.user}</span>
              </div>
            ))}
          </div>
        )}

        {/* WhatsApp-style tail */}
        <div className={`absolute top-0 w-3 h-3 ${
          isOwn 
            ? 'right-0 bg-green-500 transform rotate-45 translate-x-1/2' 
            : 'left-0 bg-white border-l border-b border-gray-200 transform rotate-45 -translate-x-1/2'
        }`} />
      </div>
    </div>
  );
};

export default MessageBubble;