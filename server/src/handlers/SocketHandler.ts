import { Server, Socket } from 'socket.io';
import { AuthService } from '../services/AuthService.js';
import { MessageStore, Message } from '../services/MessageStore.js';

interface LogContext {
  socketId: string;
  userId?: string;
  timestamp: string;
  [key: string]: any;
}

export class SocketHandler {
  private connectedUsers = new Map<string, string>(); // socketId -> secretKey
  private static readonly COMPONENT = 'SocketHandler';

  constructor(
    private io: Server,
    private authService: AuthService,
    private messageStore: MessageStore
  ) {
    this.setupSocketHandlers();
  }

  private log(level: 'info' | 'warn' | 'error', message: string, context: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      component: SocketHandler.COMPONENT,
      message,
      ...context
    };

    const logMessage = `[${logEntry.level}] ${logEntry.timestamp} [${logEntry.component}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, context);
        break;
      case 'warn':
        console.warn(logMessage, context);
        break;
      case 'error':
        console.error(logMessage, context);
        break;
    }
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.log('info', `Client connected`, {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
        clientIP: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Authentication required for all events
      socket.on('login', (data) => this.handleLogin(socket, data));
      
      // Protected events (require authentication)
      socket.on('join', () => this.handleJoin(socket));
      socket.on('message', (data) => this.handleMessage(socket, data));
      socket.on('seen-once-viewed', (data) => this.handleSeenOnceViewed(socket, data));
      
      // WebRTC signaling events
      socket.on('offer', (data) => this.handleOffer(socket, data));
      socket.on('answer', (data) => this.handleAnswer(socket, data));
      socket.on('ice-candidate', (data) => this.handleIceCandidate(socket, data));
      socket.on('call-start', (data) => this.handleCallStart(socket, data));
      socket.on('call-end', () => this.handleCallEnd(socket));
      socket.on('video-state-change', (data) => this.handleVideoStateChange(socket, data));
      socket.on('hold-state-change', (data) => this.handleHoldStateChange(socket, data));

      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  private handleLogin(socket: Socket, data: { secretKey: string }): void {
    const startTime = Date.now();
    try {
      const { secretKey } = data;
      this.log('info', `Login attempt`, {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
        secretKeyLength: secretKey.length
      });
      
      if (!this.authService.validateSecretKey(secretKey)) {
        const duration = Date.now() - startTime;
        this.log('warn', `Invalid secret key provided`, {
          socketId: socket.id,
          timestamp: new Date().toISOString(),
          secretKeyLength: secretKey.length,
          duration: `${duration}ms`
        });
        socket.emit('login-error', { error: 'Invalid credentials' });
        return;
      }

      const username = this.authService.getUsername(secretKey);
      this.log('info', `Username mapped successfully`, {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
        userId: username,
        secretKeyLength: secretKey.length
      });
      
      // Check if user is already connected
      if (this.messageStore.hasConnection(username)) {
        const duration = Date.now() - startTime;
        this.log('warn', `User already connected`, {
          socketId: socket.id,
          timestamp: new Date().toISOString(),
          userId: username,
          duration: `${duration}ms`
        });
        socket.emit('login-error', { error: 'Invalid credentials' });
        return;
      }

      // Check connection limit (max 2 users)
      if (this.messageStore.getConnectionCount() >= 2) {
        const duration = Date.now() - startTime;
        this.log('warn', `Room is full`, {
          socketId: socket.id,
          timestamp: new Date().toISOString(),
          userId: username,
          currentConnections: this.messageStore.getConnectionCount(),
          duration: `${duration}ms`
        });
        socket.emit('login-error', { error: 'Room is full' });
        return;
      }

      const token = this.authService.generateToken(secretKey);
      this.connectedUsers.set(socket.id, username);
      this.messageStore.addConnection(username);

      socket.emit('login-success', { token, user: username });
      console.log(`✅ User ${username} logged in successfully with secret key: "${secretKey}"`);
    } catch (error) {
      socket.emit('login-error', { error: 'Authentication failed' });
    }
  }

  private handleJoin(socket: Socket): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    socket.join('chat-room');
    
    // Send existing messages
    const messages = this.messageStore.getMessages();
    socket.emit('messages-history', messages);

    // Notify other users
    socket.to('chat-room').emit('user-joined', { user });
    
    console.log(`👥 User ${user} joined chat room`);
  }

  private handleMessage(socket: Socket, data: any): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      // Validate message data
      const { type, content, seenOnce = false } = data;
      
      if (!type || !content) {
        socket.emit('message-error', { error: 'Invalid message data' });
        return;
      }

      if (type === 'image') {
        // Validate image size (3MB limit)
        const sizeInBytes = (content.length * 3) / 4; // Rough base64 size calculation
        if (sizeInBytes > 3 * 1024 * 1024) {
          socket.emit('message-error', { error: 'Image too large (max 3MB)' });
          return;
        }
      }

      // Sanitize text content
      const sanitizedContent = type === 'text' 
        ? this.sanitizeText(content)
        : content;

      const message: Message = {
        id: this.generateMessageId(),
        senderKey: user, // user is now the username
        type,
        content: sanitizedContent,
        timestamp: new Date().toISOString(),
        seen: false,
        seenOnce
      };

      // Add to store
      const savedMessage = this.messageStore.addMessage(message);

      // Send acknowledgment to sender
      socket.emit('message-ack', { messageId: savedMessage.id });

      // Broadcast to all users in room
      this.io.to('chat-room').emit('new-message', savedMessage);

      console.log(`💬 Message from ${user}: ${type}`);
    } catch (error) {
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  }

  private handleSeenOnceViewed(socket: Socket, data: { messageId: string }): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    const { messageId } = data;
    const removed = this.messageStore.removeSeenOnceMessage(messageId);
    
    if (removed) {
      // Notify all clients to remove the message
      this.io.to('chat-room').emit('message-removed', { messageId });
      console.log(`👁️ Seen-once message ${messageId} viewed and removed`);
    }
  }

  // WebRTC signaling handlers
  private handleOffer(socket: Socket, data: any): void {
    socket.to('chat-room').emit('offer', data);
  }

  private handleAnswer(socket: Socket, data: any): void {
    socket.to('chat-room').emit('answer', data);
  }

  private handleIceCandidate(socket: Socket, data: any): void {
    socket.to('chat-room').emit('ice-candidate', data);
  }

  private handleCallStart(socket: Socket, data: any): void {
    const user = this.connectedUsers.get(socket.id);
    socket.to('chat-room').emit('call-start', { ...data, from: user });
  }

  private handleCallEnd(socket: Socket): void {
    const user = this.connectedUsers.get(socket.id);
    socket.to('chat-room').emit('call-end', { from: user });
  }

  private handleVideoStateChange(socket: Socket, data: any): void {
    socket.to('chat-room').emit('video-state-change', data);
  }

  private handleHoldStateChange(socket: Socket, data: any): void {
    socket.to('chat-room').emit('hold-state-change', data);
  }

  private handleDisconnect(socket: Socket): void {
    const user = this.connectedUsers.get(socket.id);
    if (user) {
      this.messageStore.removeConnection(user);
      this.connectedUsers.delete(socket.id);
      socket.to('chat-room').emit('user-left', { user });
      console.log(`👋 User ${user} disconnected`);

      // Clear messages if no one is connected
      if (this.messageStore.getConnectionCount() === 0) {
        this.messageStore.clearMessages();
        console.log('🧹 Cleared messages - no active connections');
      }
    }
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}