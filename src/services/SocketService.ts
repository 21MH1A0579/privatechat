import { io, Socket } from 'socket.io-client';
import { AuthService } from './AuthService';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface MessageData {
  type: 'text' | 'image';
  content: string;
  seenOnce: boolean;
}

export class SocketService {
  private socket: Socket | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  connect(): void {
    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.emit('connect');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.emit('disconnect');
    });

    // Authentication events
    this.socket.on('login-success', ({ token, user }) => {
      AuthService.setToken(token);
      console.log(`✅ Socket authentication successful! User: "${user}", Token: "${token}"`);
      this.emit('login-success', { token, user });
    });

    this.socket.on('login-error', ({ error }) => {
      console.error('Login error:', error);
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
      console.log('Message acknowledged:', messageId);
    });

    this.socket.on('message-error', ({ error }) => {
      console.error('Message error:', error);
    });

    this.socket.on('message-removed', (data) => {
      this.emit('message-removed', data);
    });

    // User events
    this.socket.on('user-joined', (data) => {
      this.emit('user-joined', data);
    });

    this.socket.on('user-left', (data) => {
      this.emit('user-left', data);
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

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventListeners.clear();
  }

  // Authentication
  login(secretKey: string): void {
    if (this.socket) {
      this.socket.emit('login', { secretKey });
    }
  }

  join(): void {
    if (this.socket) {
      this.socket.emit('join');
    }
  }

  // Messaging
  sendMessage(messageData: MessageData): void {
    if (this.socket) {
      this.socket.emit('message', messageData);
    }
  }

  markSeenOnceViewed(messageId: string): void {
    if (this.socket) {
      this.socket.emit('seen-once-viewed', { messageId });
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

  startCall(): void {
    if (this.socket) {
      this.socket.emit('call-start', {});
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