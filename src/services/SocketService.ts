import { io, Socket } from 'socket.io-client';
import { AuthService } from './AuthService';
import { logger } from '../utils/Logger';

const SERVER_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface MessageData {
  type: 'text' | 'image' | 'voice';
  content: string;
  seenOnce: boolean;
  disappearingPhoto?: boolean;
  duration?: number;
  replyTo?: string;
}

export class SocketService {
  private socket: Socket | null = null;
  private eventListeners: Map<string, Function[]> = new Map();
  private static readonly COMPONENT = 'SocketService';

  connect(): void {
    logger.info(SocketService.COMPONENT, `Connecting to server at ${SERVER_URL}`);
    
    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      logger.info(SocketService.COMPONENT, `Connected to server`, {
        socketId: this.socket?.id,
        transport: this.socket?.io.engine?.transport?.name
      });
      this.emit('connect');
    });

    this.socket.on('disconnect', (reason) => {
      logger.warn(SocketService.COMPONENT, `Disconnected from server`, {
        reason,
        socketId: this.socket?.id
      });
      this.emit('disconnect');
    });

    // Authentication events
    this.socket.on('login-success', ({ token, user }) => {
      AuthService.setToken(token);
      logger.setUserId(user);
      logger.info(SocketService.COMPONENT, `Socket authentication successful`, {
        user,
        tokenLength: token.length,
        socketId: this.socket?.id
      });
      this.emit('login-success', { token, user });
    });

    this.socket.on('login-error', ({ error }) => {
      logger.error(SocketService.COMPONENT, `Socket login error`, {
        error,
        socketId: this.socket?.id
      });
      this.emit('login-error', { error });
    });

    // Message events
    this.socket.on('messages-history', (messages) => {
      this.emit('messages-history', messages);
    });

    this.socket.on('new-message', (message) => {
      this.emit('new-message', message);
    });

    this.socket.on('message-ack', ({ messageId }) => {
      logger.debug(SocketService.COMPONENT, `Message acknowledged`, {
        messageId,
        socketId: this.socket?.id
      });
    });

    this.socket.on('message-error', ({ error }) => {
      logger.error(SocketService.COMPONENT, `Message error`, {
        error,
        socketId: this.socket?.id
      });
    });

    this.socket.on('message-removed', (data) => {
      this.emit('message-removed', data);
    });

    this.socket.on('message-disappearing', (data) => {
      console.log(`👁️ [SOCKET-SERVICE] Received message-disappearing event:`, data);
      this.emit('message-disappearing', data);
    });

    this.socket.on('photo-viewed', (data) => {
      this.emit('photo-viewed', data);
    });

    // User events
    this.socket.on('user-joined', (data) => {
      console.log(`👤 [SOCKET-SERVICE] Received user-joined event:`, data);
      this.emit('user-joined', data);
    });

    this.socket.on('user-left', (data) => {
      this.emit('user-left', data);
    });

    this.socket.on('users-online', (data) => {
      console.log(`👥 [SOCKET-SERVICE] Received users-online event:`, data);
      this.emit('users-online', data);
    });

    // WebRTC signaling events
    this.socket.on('offer', (data) => {
      this.emit('offer', data);
    });

    this.socket.on('answer', (data) => {
      this.emit('answer', data);
    });

    this.socket.on('ice-candidate', (data) => {
      this.emit('ice-candidate', data);
    });

    this.socket.on('call-start', (data) => {
      this.emit('call-start', data);
    });

    this.socket.on('call-end', (data) => {
      this.emit('call-end', data);
    });

    this.socket.on('video-state-change', (data) => {
      this.emit('video-state-change', data);
    });

    this.socket.on('hold-state-change', (data) => {
      this.emit('hold-state-change', data);
    });

    this.socket.on('message-reaction', (data) => {
      this.emit('message-reaction', data);
    });

    this.socket.on('typing', (data) => {
      this.emit('typing', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      logger.info(SocketService.COMPONENT, `Disconnecting socket`, {
        socketId: this.socket.id
      });
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventListeners.clear();
  }

  // Authentication
  login(secretKey: string): void {
    if (!this.socket) {
      logger.error(SocketService.COMPONENT, `Cannot login - socket not connected`);
      return;
    }
    
    console.log(`🔍 [CLIENT-LOGIN] About to send login request`);
    console.log(`🔍 [CLIENT-LOGIN] Secret key: "${secretKey}" (length: ${secretKey.length})`);
    console.log(`🔍 [CLIENT-LOGIN] Socket ID: ${this.socket.id}`);
    console.log(`🔍 [CLIENT-LOGIN] Data to send:`, { secretKey });
    
    logger.info(SocketService.COMPONENT, `Sending login request`, {
      secretKeyLength: secretKey.length,
      secretKeyValue: secretKey,
      socketId: this.socket.id
    });
    
    this.socket.emit('login', { secretKey });
    console.log(`🔍 [CLIENT-LOGIN] Login request sent`);
  }

  join(): void {
    if (!this.socket) {
      logger.error(SocketService.COMPONENT, `Cannot join - socket not connected`);
      return;
    }
    console.log(`🏠 [CLIENT-JOIN] About to join chat room`);
    logger.info(SocketService.COMPONENT, `Joining chat room`, {
      socketId: this.socket.id
    });
    this.socket.emit('join');
    console.log(`🏠 [CLIENT-JOIN] Join request sent`);
  }

  // Messaging
  sendMessage(messageData: MessageData): void {
    if (!this.socket) {
      console.log(`❌ [SOCKET-SERVICE] Cannot send message - socket not connected`);
      logger.error(SocketService.COMPONENT, `Cannot send message - socket not connected`);
      return;
    }
    
    console.log(`📤 [SOCKET-SERVICE] Sending message:`, {
      type: messageData.type,
      contentLength: messageData.content.length,
      seenOnce: messageData.seenOnce,
      disappearingPhoto: messageData.disappearingPhoto,
      socketId: this.socket.id
    });
    
    logger.info(SocketService.COMPONENT, `Sending message`, {
      type: messageData.type,
      contentLength: messageData.content.length,
      seenOnce: messageData.seenOnce,
      socketId: this.socket.id
    });
    
    this.socket.emit('message', messageData);
    console.log(`📤 [SOCKET-SERVICE] Message emitted to server`);
  }

  markSeenOnceViewed(messageId: string): void {
    if (this.socket) {
      this.socket.emit('seen-once-viewed', { messageId });
    }
  }

  markPhotoViewed(messageId: string): void {
    if (this.socket) {
      this.socket.emit('photo-viewed', { messageId });
    }
  }

  // WebRTC signaling
  sendOffer(offer: RTCSessionDescriptionInit): void {
    if (this.socket) {
      this.socket.emit('offer', offer);
    }
  }

  sendAnswer(answer: RTCSessionDescriptionInit): void {
    if (this.socket) {
      this.socket.emit('answer', answer);
    }
  }

  sendIceCandidate(candidate: RTCIceCandidate): void {
    if (this.socket) {
      this.socket.emit('ice-candidate', candidate);
    }
  }

  startCall(type: 'voice' | 'video' = 'video'): void {
    console.log(`📞 [SOCKET-SERVICE] Starting ${type} call via socket...`);
    
    if (this.socket) {
      this.socket.emit('call-start', { type });
      console.log(`📞 [SOCKET-SERVICE] Call-start event emitted with type: ${type}`);
    } else {
      console.error(`❌ [SOCKET-SERVICE] Cannot start call - socket not connected`);
    }
  }

  reactToMessage(messageId: string, emoji: string): void {
    if (this.socket) {
      this.socket.emit('message-reaction', { messageId, emoji });
    }
  }

  sendTyping(isTyping: boolean): void {
    if (this.socket) {
      this.socket.emit('typing', { isTyping });
    }
  }

  endCall(): void {
    if (this.socket) {
      this.socket.emit('call-end');
    }
  }

  sendVideoState(data: { videoEnabled: boolean }): void {
    if (this.socket) {
      this.socket.emit('video-state-change', data);
    }
  }

  sendHoldState(data: { onHold: boolean }): void {
    if (this.socket) {
      this.socket.emit('hold-state-change', data);
    }
  }

  // Event handling
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
}