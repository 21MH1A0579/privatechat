#!/bin/bash

# Create certs directory if it doesn't exist
mkdir -p certs

# Generate self-signed certificate for local development
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "✅ Self-signed certificates generated in ./certs/"
echo "🔒 You can now run the server with HTTPS enabled"
echo ""
echo "To use HTTPS:"
echo "1. Copy .env.example to .env"
echo "2. Set USE_HTTPS=true in .env"
echo "3. Set VITE_API_URL=https://localhost:3001 in .env"
echo "4. Run npm run dev"
echo ""
echo "⚠️  Your browser will show a security warning for self-signed certificates."
echo "   Click 'Advanced' and 'Proceed to localhost' to continue."