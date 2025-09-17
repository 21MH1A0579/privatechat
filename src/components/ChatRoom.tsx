import React, { useState, useEffect, useRef } from 'react';
import { Send, Image, Video, LogOut, Users } from 'lucide-react';
import MessageBubble from './MessageBubble';
import VideoCall from './VideoCall';
import { SocketService } from '../services/SocketService';
import { WebRTCService } from '../services/WebRTCService';
import { Message } from '../types/Message';
import { logger } from '../utils/Logger';

interface ChatRoomProps {
  currentUser: string; // This will be the secret key initially
  onLogout: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ currentUser: secretKey, onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>(''); // Will be set after socket auth
  const [otherUser, setOtherUser] = useState<string>('');
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ from: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketService = useRef<SocketService | null>(null);
  const webrtcService = useRef<WebRTCService | null>(null);
  
  const COMPONENT = 'ChatRoom';

  useEffect(() => {
    // Initialize services
    socketService.current = new SocketService();
    webrtcService.current = new WebRTCService(socketService.current);

    // Socket event listeners
    socketService.current.on('connect', () => {
      setIsConnected(true);
      console.log(`🔍 [CHATROOM] Socket connected, about to login`);
      console.log(`🔍 [CHATROOM] Secret key from props: "${secretKey}" (length: ${secretKey.length})`);
      
      logger.info(COMPONENT, `Socket connected, attempting login`, {
        secretKeyLength: secretKey.length,
        secretKeyValue: secretKey
      });
      socketService.current?.login(secretKey);
    });

    // Authentication events
    socketService.current.on('login-success', ({ user }) => {
      logger.info(COMPONENT, `Login successful`, { user });
      logger.setUserId(user);
      setCurrentUser(user);
      socketService.current?.join();
    });

    socketService.current.on('login-error', ({ error }: { error: string }) => {
      logger.error(COMPONENT, `Login failed`, { error });
      // Handle login error - redirect back to login form
      alert('Invalid credentials');
      onLogout();
    });

    socketService.current.on('disconnect', () => {
      setIsConnected(false);
    });

    socketService.current.on('messages-history', (msgs: Message[]) => {
      setMessages(msgs);
    });

    socketService.current.on('new-message', (message: Message) => {
      console.log(`📨 New message received: "${message.content}" from ${message.senderKey} at ${message.timestamp}`);
      setMessages(prev => [...prev, message]);
    });

    socketService.current.on('message-removed', ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    socketService.current.on('user-joined', ({ user }: { user: string }) => {
      if (user !== currentUser) {
        setOtherUser(user);
      }
    });

    socketService.current.on('call-start', ({ from }: { from: string }) => {
      if (from !== currentUser) {
        setIncomingCall({ from });
      }
    });

    socketService.current.on('call-end', () => {
      setInCall(false);
      setIncomingCall(null);
    });

    // Connect to server
    socketService.current.connect();

    // Cleanup on unmount
    return () => {
      socketService.current?.disconnect();
    };
  }, [secretKey]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketService.current) return;

    const messageData = {
      type: 'text' as const,
      content: newMessage.trim(),
      seenOnce: false
    };

    console.log(`📤 Sending message: "${messageData.content}" at ${new Date().toISOString()}`);
    socketService.current.sendMessage(messageData);
    setNewMessage('');
  };

  const handleSendSeenOnce = () => {
    if (!newMessage.trim() || !socketService.current) return;

    const messageData = {
      type: 'text' as const,
      content: newMessage.trim(),
      seenOnce: true
    };

    socketService.current.sendMessage(messageData);
    setNewMessage('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socketService.current) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (3MB)
    if (file.size > 3 * 1024 * 1024) {
      alert('Image must be smaller than 3MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      const messageData = {
        type: 'image' as const,
        content: dataUrl,
        seenOnce: false
      };

      socketService.current?.sendMessage(messageData);
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartCall = () => {
    if (socketService.current && webrtcService.current) {
      socketService.current.startCall();
      setInCall(true);
    }
  };

  const handleAcceptCall = () => {
    if (webrtcService.current) {
      setInCall(true);
      setIncomingCall(null);
    }
  };

  const handleRejectCall = () => {
    if (socketService.current) {
      socketService.current.endCall();
      setIncomingCall(null);
    }
  };

  const handleEndCall = () => {
    if (socketService.current && webrtcService.current) {
      console.log('🎥 Ending call from ChatRoom...');
      socketService.current.endCall();
      webrtcService.current.endCall();
      setInCall(false);
      console.log('🎥 Call state set to false in ChatRoom');
      
      // Force cleanup after a short delay to ensure all tracks are stopped
      setTimeout(async () => {
        if (webrtcService.current) {
          console.log('🎥 Force cleanup: calling endCall again after delay');
          webrtcService.current.endCall();
          // Check camera status after cleanup
          await webrtcService.current.checkCameraStatus();
        }
      }, 100);
    } else {
      console.log('🎥 Cannot end call: services not available');
    }
  };

  const handleSeenOnceViewed = (messageId: string) => {
    if (socketService.current) {
      socketService.current.markSeenOnceViewed(messageId);
    }
  };

  const getOtherUserName = () => {
    console.log(`🔍 getOtherUserName called - currentUser: "${currentUser}", otherUser: "${otherUser}"`);
    const result = otherUser || (currentUser === 'Chaitanya' ? 'Geetha' : 'Chaitanya');
    console.log(`🔍 getOtherUserName returning: "${result}"`);
    return result;
  };

  if (inCall) {
    return (
      <VideoCall
        webrtcService={webrtcService.current!}
        onEndCall={handleEndCall}
        otherUser={getOtherUserName()}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {getOtherUserName().charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">{getOtherUserName()}</h1>
            <p className="text-sm text-gray-500 flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              {isConnected ? 'Online' : 'Connecting...'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleStartCall}
            disabled={!isConnected}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No messages yet. Start the conversation!</p>
            <p className="text-sm mt-2">Messages are ephemeral and will disappear when you refresh.</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderKey === currentUser}
              onSeenOnceViewed={handleSeenOnceViewed}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
          >
            <Image className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!isConnected}
            />
          </div>

          <button
            type="button"
            onClick={handleSendSeenOnce}
            disabled={!newMessage.trim() || !isConnected}
            className="px-3 py-2 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-full transition-colors disabled:opacity-50"
            title="Send as seen-once message"
          >
            👁️
          </button>

          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-semibold text-lg">
                  {incomingCall.from.charAt(0)}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Incoming Video Call
              </h3>
              <p className="text-gray-600 mb-6">
                {incomingCall.from} is calling you
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleRejectCall}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptCall}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRoom;