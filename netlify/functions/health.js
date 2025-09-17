import { MessageStore } from './lib/MessageStore.js';

// Global instance to maintain state across function calls
let messageStore;

export const handler = async (event, context) => {
  const requestId = context.awsRequestId || `req-${Date.now()}`;
  const startTime = Date.now();
  
  // Log incoming request
  console.log(`[HEALTH] ${requestId} - Incoming ${event.httpMethod} request from ${event.headers?.['x-forwarded-for'] || 'unknown'}`);
  
  // Initialize messageStore if not exists
  if (!messageStore) {
    messageStore = new MessageStore();
    console.log(`[HEALTH] ${requestId} - MessageStore initialized`);
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    console.log(`[HEALTH] ${requestId} - CORS preflight request handled`);
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

  try {
    const activeConnections = messageStore.getActiveConnections();
    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      activeConnections,
      requestId
    };

    const duration = Date.now() - startTime;
    console.log(`[HEALTH] ${requestId} - SUCCESS: Health check completed in ${duration}ms, active connections: ${activeConnections}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[HEALTH] ${requestId} - ERROR: Health check failed in ${duration}ms:`, {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        requestId,
        timestamp: new Date().toISOString()
      }),
    };
  }
};
