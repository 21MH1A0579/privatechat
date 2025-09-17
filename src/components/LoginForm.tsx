import React, { useState } from 'react';
import { Lock, MessageCircle } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [secretKey, setSecretKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Check if server is available
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/health`);
      if (!response.ok) {
        throw new Error('Server not available');
      }

      // The actual authentication will happen via socket in ChatRoom
      // Server will handle all validation
      console.log(`🔍 [LOGIN-FORM] User entered secret key: "${secretKey}" (length: ${secretKey.length})`);
      console.log(`🔍 [LOGIN-FORM] About to call onLogin with: "${secretKey}"`);
      onLogin(secretKey);
      console.log(`🔍 [LOGIN-FORM] onLogin called successfully`);
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Secure Ephemeral Chat
          </h2>
          <p className="text-gray-600">
            Enter your secret key to join the conversation
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="secret-key" className="sr-only">
              Secret Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="secret-key"
                name="secret-key"
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-12 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter your secret key"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || !secretKey.trim()}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Enter Chat'
              )}
            </button>
          </div>
        </form>

        <div className="text-center text-xs text-gray-500 space-y-1">
          <p>🔒 End-to-end encrypted • No message persistence</p>
          <p>💬 Max 2 users • Messages auto-delete after 10</p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;