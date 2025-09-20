import React, { useState, useEffect, useRef } from 'react';
import { Send, Image, Video, LogOut, Users, Clock, Phone, Paperclip, Smile, MicIcon } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
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
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState<'voice' | 'video'>('video');
  const [incomingCall, setIncomingCall] = useState<{ from: string; type: 'voice' | 'video' } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [otherUserEverJoined, setOtherUserEverJoined] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const disappearingFileInputRef = useRef<HTMLInputElement>(null);
  const socketService = useRef<SocketService | null>(null);
  const webrtcService = useRef<WebRTCService | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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
    socketService.current.on('login-success', ({ user }: { user: string }) => {
      console.log(`✅ [CHATROOM] Login success received for user: "${user}"`);
      logger.info(COMPONENT, `Login successful`, { user });
      logger.setUserId(user);
      setCurrentUser(user);
      console.log(`🏠 [CHATROOM] About to call join() for user: "${user}"`);
      socketService.current?.join();
      console.log(`🏠 [CHATROOM] Join() called for user: "${user}"`);
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

    socketService.current.on('photo-viewed', ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, viewedAt: new Date().toISOString() } : msg
      ));
    });

    socketService.current.on('users-online', ({ users }: { users: string[] }) => {
      console.log(`👥 [USERS-ONLINE] Received users:`, users);
      console.log(`👥 [USERS-ONLINE] Current user state: "${currentUser}"`);
      
      setOnlineUsers(users);
      
      // Handle race condition: if currentUser is not set yet, we need to determine other user differently
      if (users.length >= 2) {
        if (currentUser) {
          // Normal case: currentUser is set, find the other user
          const otherOnlineUser = users.find(user => user !== currentUser);
          console.log(`👥 [USERS-ONLINE] Found other user (normal): "${otherOnlineUser}"`);
          if (otherOnlineUser) {
            setOtherUser(otherOnlineUser);
          }
        } else {
          // Race condition case: currentUser not set yet, determine other user by secret key mapping
          const userMapping: Record<string, string> = {
            'Chaithu143': 'Chaitanya',
            'Geethu143': 'Geetha'
          };
          
          const expectedCurrentUser = userMapping[secretKey];
          const otherOnlineUser = users.find(user => user !== expectedCurrentUser);
          console.log(`👥 [USERS-ONLINE] Race condition - expected current: "${expectedCurrentUser}", found other: "${otherOnlineUser}"`);
          
          if (otherOnlineUser) {
            setOtherUser(otherOnlineUser);
          }
        }
      }
    });

    socketService.current.on('user-joined', ({ user }: { user: string }) => {
      console.log(`👤 [USER-JOINED] User joined: "${user}", currentUser: "${currentUser}"`);
      
      // Handle race condition here too
      const userMapping: Record<string, string> = {
        'Chaithu143': 'Chaitanya',
        'Geethu143': 'Geetha'
      };
      const expectedCurrentUser = userMapping[secretKey];
      
      if (user !== currentUser && user !== expectedCurrentUser) {
        console.log(`👤 [USER-JOINED] Setting other user: "${user}"`);
        setOtherUser(user);
        setOtherUserEverJoined(true);
      }
    });

    socketService.current.on('user-left', ({ user }: { user: string }) => {
      if (user !== currentUser) {
        // User left, so they're offline now
        setOtherUserEverJoined(true); // Mark that they were here before
      }
    });

    socketService.current.on('typing', ({ user, isTyping }: { user: string; isTyping: boolean }) => {
      if (user !== currentUser) {
        setOtherUserTyping(isTyping);
      }
    });

    socketService.current.on('message-reaction', ({ messageId, emoji, user }: { messageId: string; emoji: string; user: string }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, reactions: [...(msg.reactions || []), { emoji, user }] }
          : msg
      ));
    });

    socketService.current.on('call-start', ({ from, type }: { from: string; type: 'voice' | 'video' }) => {
      if (from !== currentUser) {
        setIncomingCall({ from, type: type || 'video' });
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

  // Handle late currentUser update (after users-online event)
  useEffect(() => {
    if (currentUser && onlineUsers.length >= 2 && !otherUser) {
      console.log(`👥 [LATE-UPDATE] currentUser now set: "${currentUser}", finding other user from:`, onlineUsers);
      const otherOnlineUser = onlineUsers.find(user => user !== currentUser);
      if (otherOnlineUser) {
        console.log(`👥 [LATE-UPDATE] Found other user: "${otherOnlineUser}"`);
        setOtherUser(otherOnlineUser);
      }
    }
  }, [currentUser, onlineUsers, otherUser]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showEmojiPicker && !target.closest('.emoji-picker-container') && !target.closest('.emoji-button')) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketService.current) return;

    const messageData = {
      type: 'text' as const,
      content: newMessage.trim(),
      seenOnce: false,
      replyTo: replyingTo?.id
    };

    console.log(`📤 Sending message: "${messageData.content}" at ${new Date().toISOString()}`);
    socketService.current.sendMessage(messageData);
    setNewMessage('');
    setReplyingTo(null); // Clear reply after sending
    
    // Immediately stop typing when message is sent
    if (isTyping) {
      setIsTyping(false);
      socketService.current.sendTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleSendSeenOnce = () => {
    if (!newMessage.trim() || !socketService.current) return;

    const messageData = {
      type: 'text' as const,
      content: newMessage.trim(),
      seenOnce: true,
      replyTo: replyingTo?.id
    };

    socketService.current.sendMessage(messageData);
    setNewMessage('');
    setReplyingTo(null); // Clear reply after sending
    
    // Immediately stop typing when message is sent
    if (isTyping) {
      setIsTyping(false);
      socketService.current.sendTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, disappearing: boolean = false) => {
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
        seenOnce: false,
        disappearingPhoto: disappearing
      };

      socketService.current?.sendMessage(messageData);
    };
    reader.readAsDataURL(file);

    // Reset file inputs
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (disappearingFileInputRef.current) {
      disappearingFileInputRef.current.value = '';
    }
  };

  const handleStartCall = (type: 'voice' | 'video' = 'video') => {
    if (socketService.current && webrtcService.current) {
      setCallType(type);
      socketService.current.startCall(type);
      setInCall(true);
    }
  };

  const handleAcceptCall = () => {
    if (webrtcService.current && incomingCall) {
      setCallType(incomingCall.type);
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

  const handlePhotoViewed = (messageId: string) => {
    if (socketService.current) {
      socketService.current.markPhotoViewed(messageId);
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  const handleReact = (messageId: string, emoji: string) => {
    if (socketService.current) {
      socketService.current.reactToMessage(messageId, emoji);
    }
  };

  const handleTyping = (value: string) => {
    if (socketService.current) {
      // If user is typing and there's content
      if (value.length > 0) {
        if (!isTyping) {
          setIsTyping(true);
          socketService.current.sendTyping(true);
        }
        
        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        // Stop typing after 1 second of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          socketService.current?.sendTyping(false);
        }, 1000);
      } else {
        // If input is empty, immediately stop typing
        if (isTyping) {
          setIsTyping(false);
          socketService.current.sendTyping(false);
          
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
        }
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    handleTyping(value);
  };

  const handleInputBlur = () => {
    // Immediately stop typing when input loses focus
    if (isTyping) {
      setIsTyping(false);
      socketService.current?.sendTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Immediately stop typing when Enter is pressed
      if (isTyping) {
        setIsTyping(false);
        socketService.current?.sendTyping(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64Audio = reader.result as string;
          
          const messageData = {
            type: 'voice' as const,
            content: base64Audio,
            seenOnce: false,
            duration: recordingDuration
          };
          
          socketService.current?.sendMessage(messageData);
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      setIsRecording(true);
      setRecordingDuration(0);
      mediaRecorder.start();
      
      // Start duration counter
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting voice recording:', error);
      alert('Could not access microphone');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
    // Don't close the picker - let user select multiple emojis
  };

  const getOtherUserName = () => {
    console.log(`🔍 getOtherUserName called - currentUser: "${currentUser}", otherUser: "${otherUser}"`);
    
    if (otherUser) {
      console.log(`🔍 getOtherUserName returning otherUser: "${otherUser}"`);
      return otherUser;
    }
    
    // Fallback logic based on secret key
    const userMapping: Record<string, string> = {
      'Chaithu143': 'Chaitanya',
      'Geethu143': 'Geetha'
    };
    const currentUserFromKey = userMapping[secretKey];
    const result = currentUserFromKey === 'Chaitanya' ? 'Geetha' : 'Chaitanya';
    
    console.log(`🔍 getOtherUserName fallback - secretKey: "${secretKey}", currentFromKey: "${currentUserFromKey}", returning: "${result}"`);
    return result;
  };

  if (inCall) {
    return (
      <VideoCall
        webrtcService={webrtcService.current!}
        onEndCall={handleEndCall}
        otherUser={getOtherUserName()}
        callType={callType}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* WhatsApp-style Header */}
      <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
            <span className="text-gray-700 font-semibold text-sm">
              {getOtherUserName().charAt(0)}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="font-medium text-white">{getOtherUserName()}</h1>
            <p className="text-sm text-green-100 flex items-center">
              {otherUserTyping ? (
                <span className="flex items-center">
                  typing
                  <div className="flex space-x-1 ml-1">
                    <div className="w-1 h-1 bg-green-100 rounded-full typing-dot"></div>
                    <div className="w-1 h-1 bg-green-100 rounded-full typing-dot"></div>
                    <div className="w-1 h-1 bg-green-100 rounded-full typing-dot"></div>
                  </div>
                </span>
              ) : (
                <>
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    isConnected && onlineUsers.length === 2 ? 'bg-green-300' : 
                    isConnected && onlineUsers.length === 1 && (otherUserEverJoined || otherUser) ? 'bg-red-400' : 'bg-gray-400'
                  }`} />
                  {isConnected && onlineUsers.length === 2 ? 'online' : 
                   isConnected && onlineUsers.length === 1 && (otherUserEverJoined || otherUser) ? 'offline' :
                   isConnected ? 'waiting...' : 'connecting...'}
                </>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleStartCall('voice')}
            disabled={!isConnected || onlineUsers.length < 2}
            className="p-2 text-green-100 hover:text-white hover:bg-green-700 rounded-full transition-colors disabled:opacity-50"
            title="Voice call"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleStartCall('video')}
            disabled={!isConnected || onlineUsers.length < 2}
            className="p-2 text-green-100 hover:text-white hover:bg-green-700 rounded-full transition-colors disabled:opacity-50"
            title="Video call"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 text-green-100 hover:text-white hover:bg-green-700 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-2"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23f0f0f0' fill-opacity='0.1' fill-rule='evenodd'%3E%3Cpath d='m0 40l40-40h-40z'/%3E%3Cpath d='m40 40v-40h-40z' fill-opacity='0.05'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {/* Reply Banner */}
        {replyingTo && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 mb-4 rounded-r-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">
                  Replying to {replyingTo.senderKey}
                </p>
                <p className="text-sm text-yellow-700 truncate">
                  {replyingTo.type === 'image' ? '📷 Photo' : replyingTo.content}
                </p>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-yellow-600 hover:text-yellow-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <div className="bg-white rounded-lg p-6 shadow-sm max-w-sm mx-auto">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-2 opacity-75">Start the conversation with {getOtherUserName()}!</p>
              <p className="text-xs mt-3 text-green-600">🔒 Messages are end-to-end encrypted</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const repliedMessage = message.replyTo 
              ? messages.find(m => m.id === message.replyTo)
              : undefined;
              
            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.senderKey === currentUser}
                onSeenOnceViewed={handleSeenOnceViewed}
                onPhotoViewed={handlePhotoViewed}
                onReply={handleReply}
                onReact={handleReact}
                repliedMessage={repliedMessage}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* WhatsApp-style Input Area */}
      <div className="bg-gray-50 px-4 py-3">
        <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleImageUpload(e, false)}
            accept="image/*"
            className="hidden"
          />
          
          <input
            type="file"
            ref={disappearingFileInputRef}
            onChange={(e) => handleImageUpload(e, true)}
            accept="image/*"
            className="hidden"
          />

          {/* Attachment Button */}
          <div className="relative group">
            <button
              type="button"
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-full transition-colors"
              title="Attach"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            
            {/* Attachment Menu */}
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-3 w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Image className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-gray-700">Photo</span>
              </button>
              <button
                type="button"
                onClick={() => disappearingFileInputRef.current?.click()}
                className="flex items-center space-x-3 w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-gray-700">Disappearing Photo</span>
              </button>
            </div>
          </div>

          {/* Message Input */}
          <div className="flex-1 bg-white rounded-full border border-gray-300 flex items-center">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              className="flex-1 px-4 py-2 bg-transparent rounded-full focus:outline-none"
              disabled={!isConnected}
            />
            
            {/* Emoji Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="emoji-button p-2 text-gray-600 hover:text-gray-800 rounded-full transition-colors"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {/* Voice/Send Button */}
          {newMessage.trim() ? (
            <div className="flex space-x-1">
              {/* Seen-once toggle */}
              <button
                type="button"
                onClick={handleSendSeenOnce}
                disabled={!isConnected}
                className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-full transition-colors disabled:opacity-50"
                title="Send as view-once message"
              >
                👁️
              </button>
              
              {/* Send Button */}
              <button
                type="submit"
                disabled={!isConnected}
                className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50"
                title="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onMouseDown={startVoiceRecording}
              onMouseUp={stopVoiceRecording}
              onMouseLeave={stopVoiceRecording}
              className={`p-2 rounded-full transition-colors ${
                isRecording 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
              }`}
              title={isRecording ? `Recording... ${recordingDuration}s` : "Hold to record voice message"}
            >
              <MicIcon className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="emoji-picker-container fixed bottom-20 right-4 z-50">
          <div className="relative bg-white rounded-lg shadow-lg border border-gray-200">
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="absolute top-2 right-2 z-10 p-1 hover:bg-gray-100 rounded-full transition-colors"
              title="Close"
            >
              ✕
            </button>
            <EmojiPicker 
              onEmojiClick={handleEmojiClick}
              autoFocusSearch={false}
              theme={"light" as any}
              width={300}
              height={400}
            />
          </div>
        </div>
      )}

      {/* WhatsApp-style Incoming Call Modal */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-700 font-semibold text-xl">
                  {incomingCall.from.charAt(0)}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                {incomingCall.from}
              </h3>
              <p className="text-gray-600 mb-8 flex items-center justify-center">
                {incomingCall.type === 'voice' ? (
                  <>
                    <Phone className="w-4 h-4 mr-2" />
                    Incoming voice call...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Incoming video call...
                  </>
                )}
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={handleRejectCall}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <Phone className="w-5 h-5 transform rotate-[135deg]" />
                  <span>Decline</span>
                </button>
                <button
                  onClick={handleAcceptCall}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                >
                  {incomingCall.type === 'voice' ? (
                    <Phone className="w-5 h-5" />
                  ) : (
                    <Video className="w-5 h-5" />
                  )}
                  <span>Accept</span>
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
