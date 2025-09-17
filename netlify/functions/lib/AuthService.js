import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const VALID_KEYS = ['Chaithu143', 'Geethu143'];

export class AuthService {
  constructor() {
    this.USER_MAPPING = {
      'Chaithu143': 'Chaitanya',
      'Geethu143': 'Geetha'
    };
  }

  validateSecretKey(key) {
    return VALID_KEYS.includes(key);
  }

  getUsername(secretKey) {
    return this.USER_MAPPING[secretKey] || '';
  }

  generateToken(secretKey) {
    if (!this.validateSecretKey(secretKey)) {
      throw new Error('Invalid secret key');
    }

    const username = this.getUsername(secretKey);
    return jwt.sign(
      { secretKey, username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (!this.validateSecretKey(decoded.secretKey)) {
        throw new Error('Invalid secret key in token');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  getOtherUser(currentUsername) {
    const usernames = Object.values(this.USER_MAPPING);
    return usernames.find(username => username !== currentUsername) || '';
  }
}
