export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  userId?: string;
  sessionId?: string;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private sessionId: string;
  private userId?: string;

  private constructor() {
    this.logLevel = import.meta.env.PROD ? LogLevel.INFO : LogLevel.DEBUG;
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: LogLevel, component: string, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      userId: this.userId,
      sessionId: this.sessionId
    };
  }

  private log(level: LogLevel, component: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const entry = this.formatMessage(level, component, message, data);
    const prefix = `[${LogLevel[level]}] ${entry.timestamp} [${component}]`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix} ${message}`, data || '');
        break;
      case LogLevel.INFO:
        console.info(`${prefix} ${message}`, data || '');
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} ${message}`, data || '');
        break;
      case LogLevel.ERROR:
        console.error(`${prefix} ${message}`, data || '');
        break;
    }

    // In production, you could send logs to external service
    if (import.meta.env.PROD && level >= LogLevel.ERROR) {
      this.sendToExternalService(entry);
    }
  }

  private async sendToExternalService(entry: LogEntry): Promise<void> {
    try {
      // Example: Send to your logging service
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // });
    } catch (error) {
      console.warn('Failed to send log to external service:', error);
    }
  }

  debug(component: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, component, message, data);
  }

  info(component: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, component, message, data);
  }

  warn(component: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, component, message, data);
  }

  error(component: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, component, message, data);
  }

  // Specialized logging methods
  apiCall(component: string, method: string, url: string, duration?: number, status?: number): void {
    this.info(component, `API ${method} ${url}`, {
      method,
      url,
      duration: duration ? `${duration}ms` : undefined,
      status
    });
  }

  userAction(component: string, action: string, data?: any): void {
    this.info(component, `User action: ${action}`, {
      action,
      userId: this.userId,
      ...data
    });
  }

  socketEvent(component: string, event: string, data?: any): void {
    this.debug(component, `Socket event: ${event}`, {
      event,
      ...data
    });
  }

  performance(component: string, operation: string, duration: number): void {
    const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    this.log(level, component, `Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      slow: duration > 1000
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
