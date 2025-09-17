import { AuthService } from './lib/AuthService.js';

// Global instance
let authService;

export const handler = async (event, context) => {
  const requestId = context.awsRequestId || `req-${Date.now()}`;
  const startTime = Date.now();
  const clientIP = event.headers?.['x-forwarded-for'] || 'unknown';
  
  // Log incoming request
  console.log(`[SESSION] ${requestId} - Incoming ${event.httpMethod} request from ${clientIP}`);
  
  // Initialize authService if not exists
  if (!authService) {
    authService = new AuthService();
    console.log(`[SESSION] ${requestId} - AuthService initialized`);
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    console.log(`[SESSION] ${requestId} - CORS preflight request handled`);
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    const duration = Date.now() - startTime;
    console.warn(`[SESSION] ${requestId} - Method not allowed: ${event.httpMethod} in ${duration}ms`);
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({ 
        error: 'Method not allowed',
        requestId,
        timestamp: new Date().toISOString()
      }),
    };
  }

  try {
    const bodyData = JSON.parse(event.body || '{}');
    const { token } = bodyData;
    
    console.log(`[SESSION] ${requestId} - Validating session token (length: ${token ? token.length : 0})`);
    
    if (!token) {
      const duration = Date.now() - startTime;
      console.warn(`[SESSION] ${requestId} - Missing token in ${duration}ms`);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Request-ID': requestId,
        },
        body: JSON.stringify({ 
          error: 'Token required',
          requestId,
          timestamp: new Date().toISOString()
        }),
      };
    }

    const decoded = authService.verifyToken(token);
    const duration = Date.now() - startTime;
    
    console.log(`[SESSION] ${requestId} - SUCCESS: Token validated for user "${decoded.username}" in ${duration}ms`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({ 
        valid: true, 
        user: decoded.username,
        requestId,
        timestamp: new Date().toISOString()
      }),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const isTokenError = error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError';
    
    if (isTokenError) {
      console.warn(`[SESSION] ${requestId} - Invalid/expired token in ${duration}ms:`, {
        error: error.message,
        tokenError: error.name,
        clientIP,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error(`[SESSION] ${requestId} - Unexpected error in ${duration}ms:`, {
        error: error.message,
        stack: error.stack,
        clientIP,
        timestamp: new Date().toISOString()
      });
    }
    
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({ 
        valid: false, 
        error: 'Invalid token',
        requestId,
        timestamp: new Date().toISOString()
      }),
    };
  }
};
