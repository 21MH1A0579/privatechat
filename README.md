# Secure Ephemeral Chat with WebRTC Video Calling

A production-ready, secure two-person ephemeral chat application with WebRTC video calling capabilities. Messages exist only in memory and disappear on refresh - no database persistence.

## 🚀 Features

- **Secure Authentication**: Two secret keys (`Chaithu143` and `Geethu143`)
- **Ephemeral Messaging**: Messages stored only in memory (max 10, FIFO)
- **Seen-Once Messages**: Snapchat-style disappearing messages
- **WebRTC Video Calls**: Peer-to-peer video calling with full controls
- **Real-time Communication**: Socket.IO for instant messaging and signaling
- **Modern UI**: Instagram DM-inspired interface with Tailwind CSS
- **Security First**: Input sanitization, file validation, HTTPS support
- **Production Ready**: Comprehensive tests, deployment guides, health checks

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation & Setup

1. **Clone and install dependencies:**
```bash
git clone https://github.com/21MH1A0579/privatechat.git
cd privatechat
npm run install:all
```

2. **Generate HTTPS certificates (optional but recommended):**
```bash
npm run gen-cert
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env if you want to enable HTTPS
```

4. **Start the application:**
```bash
npm run dev
```

5. **Open in two browser windows/tabs:**
   - Navigate to `http://localhost:5173` (or `https://localhost:5173` if HTTPS enabled)
   - Login with `Chaithu143` in one window (logs in as Chaitanya)
   - Login with `Geethu143` in another window (logs in as Geetha)

## 🔧 Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=development
USE_HTTPS=false

# JWT Secret (CHANGE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Client Configuration
VITE_API_URL=http://localhost:3001
```

### HTTPS Setup (Recommended)

For local development with HTTPS:

1. Generate certificates: `npm run gen-cert`
2. Set `USE_HTTPS=true` in `.env`
3. Set `VITE_API_URL=https://localhost:3001` in `.env`
4. Accept the browser security warning for self-signed certificates

## 📱 Usage

### Authentication
- Only two users can connect simultaneously
- Use secret keys: `Chaithu143` (logs in as Chaitanya) or `Geethu143` (logs in as Geetha)
- Sessions are short-lived with JWT tokens

### Messaging
- **Regular messages**: Stay until FIFO limit (10 messages)
- **Seen-once messages**: Click the 👁️ button - disappear after viewing
- **Image sharing**: Upload images up to 3MB
- **Message status**: See delivery and read receipts

### Video Calling
- Click the video camera icon in the chat header
- Accept/reject incoming calls
- Full controls: mute audio, disable video, end call
- Peer-to-peer connection (server only for signaling)

### Ephemeral Behavior
- **Page refresh**: Clears all client-side messages
- **Server restart**: Clears all server-side messages
- **User disconnect**: Messages cleared when both users leave

## 🏗️ Architecture

### Backend (`/server`)
- **Express.js**: HTTP server with security middleware
- **Socket.IO**: WebSocket signaling and messaging
- **In-Memory Storage**: No database - messages in RAM only
- **JWT Authentication**: Short-lived session tokens
- **Health Checks**: `/health` and `/session` endpoints

### Frontend (`/src`)
- **React 18**: Functional components with hooks
- **Tailwind CSS**: Modern, responsive UI
- **Socket.IO Client**: Real-time communication
- **WebRTC**: Direct peer-to-peer video calling

### Message Lifecycle
1. User types message and clicks send
2. Client optimistically displays message
3. Server validates and stores in memory (FIFO)
4. Server broadcasts to all connected clients
5. Client receives acknowledgment
6. If FIFO limit exceeded, oldest message removed

### Seen-Once Implementation
1. Sender marks message as `seenOnce: true`
2. Recipient sees blurred message with "Tap to view"
3. On tap, message reveals for 3 seconds
4. Client notifies server message was viewed
5. Server removes message from memory
6. All clients remove message from UI

## 🧪 Testing

Run the comprehensive test suite:

```bash
npm test
```

Tests cover:
- Authentication flow
- Message FIFO behavior
- Seen-once functionality
- Connection limits
- WebRTC signaling
- Error handling

## 🚀 Deployment

### DigitalOcean App Platform

1. **Create new app** from GitHub repository
2. **Configure build settings:**
   ```yaml
   build_command: npm run build
   run_command: npm start
   ```
3. **Set environment variables:**
   ```
   NODE_ENV=production
   JWT_SECRET=your-production-secret
   USE_HTTPS=true
   ```
4. **Enable HTTPS** in DigitalOcean dashboard

### Vercel (Frontend) + Railway (Backend)

**Frontend (Vercel):**
```bash
npm install -g vercel
vercel --prod
```

**Backend (Railway):**
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

### AWS EC2

1. **Launch EC2 instance** (Ubuntu 20.04+)
2. **Install dependencies:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs nginx certbot
   ```
3. **Clone and setup:**
   ```bash
   git clone https://github.com/21MH1A0579/privatechat.git
   cd privatechat
   npm run install:all
   npm run build
   ```
4. **Configure Nginx** for reverse proxy
5. **Setup SSL** with Let's Encrypt:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```
6. **Use PM2** for process management:
   ```bash
   npm install -g pm2
   pm2 start server/dist/index.js --name chat-server
   pm2 startup
   pm2 save
   ```

## 🔒 Security Features

- **Input Sanitization**: XSS prevention for text messages
- **File Validation**: Image type and size limits (3MB)
- **Rate Limiting**: Prevents spam and DoS attacks
- **Origin Validation**: CORS protection
- **Session Management**: Short-lived JWT tokens
- **HTTPS Support**: TLS encryption for all communications
- **No Persistence**: No data stored on disk

## 🐛 Troubleshooting

### Common Issues

**CORS Errors:**
- Ensure server is running on port 3001
- Check VITE_API_URL in .env matches server URL
- Verify CORS origins in server configuration

**WebRTC Connection Failed:**
- Check firewall settings
- Ensure both users are on same network or use STUN servers
- Verify browser permissions for camera/microphone

**HTTPS Certificate Warnings:**
- Self-signed certificates will show browser warnings
- Click "Advanced" → "Proceed to localhost"
- For production, use proper SSL certificates

**Socket Connection Issues:**
- Verify server is running: `curl http://localhost:3001/health`
- Check browser console for connection errors
- Ensure WebSocket isn't blocked by firewall

### Development vs Production

**Development:**
- Self-signed certificates OK
- Detailed error messages
- Hot reloading enabled
- CORS allows localhost

**Production:**
- Proper SSL certificates required
- Error messages sanitized
- Static file serving
- CORS restricted to your domain

## 📊 Performance Considerations

- **Memory Usage**: ~1MB per 1000 messages (text only)
- **Connection Limit**: 2 concurrent users maximum
- **Message Limit**: 10 messages in memory (FIFO)
- **File Size Limit**: 3MB for images
- **Session Duration**: 24 hours maximum

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Socket.IO for real-time communication
- WebRTC for peer-to-peer video calling
- Tailwind CSS for beautiful UI components
- React team for the excellent framework