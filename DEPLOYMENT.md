# Netlify Deployment Guide

This guide will help you deploy your Ephemeral Chat App to Netlify.

## Prerequisites

1. A Netlify account (free tier works fine)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Configure Environment Variables

1. In your Netlify dashboard, go to your site settings
2. Navigate to "Environment variables"
3. Add the following variables:

```
JWT_SECRET=your-super-secret-jwt-key-change-in-production-make-it-long-and-random
NODE_ENV=production
```

**Important:** Change the JWT_SECRET to a secure, random string in production!

## Step 2: Deploy Settings

When connecting your repository to Netlify, use these build settings:

- **Base directory**: ` ` (leave empty)
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Functions directory**: `netlify/functions`

## Step 3: Post-Deployment Configuration

After your first deployment:

1. Note your Netlify site URL (e.g., `https://your-app-name.netlify.app`)
2. Update the environment variable:
   ```
   VITE_API_URL=https://your-app-name.netlify.app
   ```
3. Redeploy the site

## Step 4: Update CORS Configuration

The serverless functions are already configured to handle CORS, but if you need to restrict access to specific domains, you can modify the functions in `netlify/functions/` to update the `Access-Control-Allow-Origin` header.

## Features Available in Netlify Deployment

✅ **Available:**
- Text messaging
- Image sharing
- User authentication
- Session management
- Health checks

⚠️ **Limited:**
- Real-time features (Socket.IO)
- Video calling (WebRTC signaling)

**Note:** Netlify Functions don't support persistent WebSocket connections, so real-time features like Socket.IO and WebRTC signaling will need alternative implementations (like using WebRTC directly with STUN/TURN servers or third-party services like Pusher, Ably, or Firebase).

## Alternative for Real-Time Features

For full real-time functionality, consider:

1. **Hybrid Approach**: Deploy the frontend to Netlify and the backend to a service that supports WebSockets (Railway, Render, Heroku, etc.)
2. **Use WebRTC directly**: Implement peer-to-peer connections without server-side signaling
3. **Third-party services**: Use services like Pusher, Ably, or Firebase for real-time features

## Troubleshooting

### Build Failures
- Check that all dependencies are properly listed in `package.json`
- Verify environment variables are set correctly
- Check the build logs for specific error messages

### Function Errors
- Verify that `netlify/functions/package.json` has all required dependencies
- Check function logs in the Netlify dashboard
- Ensure environment variables are accessible in functions

### CORS Issues
- Verify the `Access-Control-Allow-Origin` headers in function responses
- Check that your frontend is making requests to the correct API endpoints

## Manual Testing

After deployment, test these endpoints:
- `https://your-site.netlify.app/health` - Should return server status
- `https://your-site.netlify.app/session` - Should handle session validation (POST request)

Your app should be live and functional for basic messaging features!
