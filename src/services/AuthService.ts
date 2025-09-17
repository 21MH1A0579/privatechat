import { logger } from '../utils/Logger';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: string;
  error?: string;
}

export interface SessionValidation {
  valid: boolean;
  user: string;
}

export class AuthService {
  private static readonly TOKEN_KEY = 'chat_token';
  private static readonly COMPONENT = 'AuthService';

  static async login(secretKey: string): Promise<LoginResponse> {
    const startTime = Date.now();
    logger.info(this.COMPONENT, `Attempting login with secret key (length: ${secretKey.length})`);
    
    try {
      // First, try to connect to health endpoint to check server availability
      logger.debug(this.COMPONENT, `Checking server health at ${API_BASE}/health`);
      const response = await fetch(`${API_BASE}/health`);
      
      if (!response.ok) {
        logger.error(this.COMPONENT, `Server health check failed`, {
          status: response.status,
          statusText: response.statusText
        });
        throw new Error('Server not available');
      }
      
      const duration = Date.now() - startTime;
      logger.apiCall(this.COMPONENT, 'GET', '/health', duration, response.status);
      logger.info(this.COMPONENT, `Login successful - server available`, { duration });

      // Return success - actual authentication will happen via socket when available
      // For now, just validate the secret key format locally
      const validKeys = ['Chaithu143', 'Geethu143'];
      if (!validKeys.includes(secretKey)) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      const userMapping: Record<string, string> = {
        'Chaithu143': 'Chaitanya',
        'Geethu143': 'Geetha'
      };

      return {
        success: true,
        user: userMapping[secretKey],
        token: 'temp-token' // Temporary token, real one comes from socket
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(this.COMPONENT, `Login failed`, {
        error: error.message,
        duration,
        secretKeyLength: secretKey.length
      });
      
      return {
        success: false,
        error: 'Connection failed'
      };
    }
  }

  static async validateSession(token: string): Promise<SessionValidation> {
    const startTime = Date.now();
    logger.info(this.COMPONENT, `Validating session token (length: ${token.length})`);
    
    try {
      const response = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        logger.warn(this.COMPONENT, `Session validation failed`, {
          status: response.status,
          statusText: response.statusText,
          duration,
          tokenLength: token.length
        });
        throw new Error('Session validation failed');
      }

      const data = await response.json();
      logger.apiCall(this.COMPONENT, 'POST', '/session', duration, response.status);
      logger.info(this.COMPONENT, `Session validated successfully`, {
        user: data.user,
        duration
      });
      
      return data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(this.COMPONENT, `Session validation error`, {
        error: error.message,
        duration,
        tokenLength: token.length
      });
      
      return { valid: false, user: '' };
    }
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    logger.debug(this.COMPONENT, `Token stored in localStorage`, {
      tokenLength: token.length
    });
  }

  static getToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    logger.debug(this.COMPONENT, `Token retrieved from localStorage`, {
      hasToken: !!token,
      tokenLength: token?.length || 0
    });
    return token;
  }

  static clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    logger.info(this.COMPONENT, `Token cleared from localStorage`);
  }
}