import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const VALID_KEYS = ['Chaithu143', 'Geethu143'];

export interface AuthPayload {
  secretKey: string;
  username: string;
  iat: number;
  exp: number;
}

export class AuthService {
  private readonly USER_MAPPING: Record<string, string> = {
    'Chaithu143': 'Chaitanya',
    'Geethu143': 'Geetha'
  };

  validateSecretKey(key: string): boolean {
    return VALID_KEYS.includes(key);
  }

  getUsername(secretKey: string): string {
    return this.USER_MAPPING[secretKey] || '';
  }

  generateToken(secretKey: string): string {
    if (!this.validateSecretKey(secretKey)) {
      throw new Error('Invalid secret key');
    }

    const username = this.getUsername(secretKey);
    return jwt.sign(
      { secretKey, username },
      JWT_SECRET,
      { expiresIn: '24h' } // Short-lived token
    );
  }

  verifyToken(token: string): AuthPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
      
      if (!this.validateSecretKey(decoded.secretKey)) {
        throw new Error('Invalid secret key in token');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  getOtherUser(currentUsername: string): string {
    const usernames = Object.values(this.USER_MAPPING);
    return usernames.find(username => username !== currentUsername) || '';
  }
}