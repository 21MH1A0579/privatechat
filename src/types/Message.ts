export interface MessageReaction {
  emoji: string;
  user: string;
}

export interface Message {
  id: string;
  senderKey: string;
  type: 'text' | 'image' | 'voice';
  content: string;
  timestamp: string;
  seenOnce: boolean;
  disappearingPhoto?: boolean; // New field for disappearing photos
  viewedAt?: string; // Timestamp when photo was viewed
  reactions?: MessageReaction[]; // Message reactions
  replyTo?: string; // ID of message being replied to
  duration?: number; // Voice message duration in seconds
  isDisappearing?: boolean; // Client-side flag for animation state
}