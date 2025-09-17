export class MessageStore {
  constructor() {
    this.messages = [];
    this.activeConnections = new Set();
    this.MAX_MESSAGES = 10;
  }

  addMessage(message) {
    // Add to beginning of array (newest first)
    this.messages.unshift(message);
    
    // Enforce FIFO limit
    if (this.messages.length > this.MAX_MESSAGES) {
      this.messages = this.messages.slice(0, this.MAX_MESSAGES);
    }
    
    return message;
  }

  getMessages() {
    return [...this.messages]; // Return copy
  }

  markMessageSeen(messageId) {
    const message = this.messages.find(m => m.id === messageId);
    if (message) {
      message.seen = true;
      return true;
    }
    return false;
  }

  removeSeenOnceMessage(messageId) {
    const index = this.messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      const message = this.messages[index];
      if (message.seenOnce) {
        this.messages.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  clearMessages() {
    this.messages = [];
  }

  addConnection(userId) {
    this.activeConnections.add(userId);
  }

  removeConnection(userId) {
    this.activeConnections.delete(userId);
  }

  getActiveConnections() {
    return this.activeConnections.size;
  }

  hasConnection(userId) {
    return this.activeConnections.has(userId);
  }

  getConnectionCount() {
    return this.activeConnections.size;
  }
}
