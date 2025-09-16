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

  static async login(secretKey: string): Promise<LoginResponse> {
    try {
      // First, try to connect to socket for authentication
      const response = await fetch(`${API_BASE}/health`);
      if (!response.ok) {
        throw new Error('Server not available');
      }

      // Return success - actual authentication happens via socket
      return {
        success: true,
        user: secretKey,
        token: 'temp-token' // Temporary token, real one comes from socket
      };
    } catch (error) {
      return {
        success: false,
        error: 'Connection failed'
      };
    }
  }

  static async validateSession(token: string): Promise<SessionValidation> {
    try {
      const response = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error('Session validation failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return { valid: false, user: '' };
    }
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }
}