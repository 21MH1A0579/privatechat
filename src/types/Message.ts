export interface Message {
  id: string;
  senderKey: string;
  type: 'text' | 'image';
  content: string;
  timestamp: string;
  seen: boolean;
  seenOnce: boolean;
}