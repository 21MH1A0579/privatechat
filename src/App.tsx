import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import ChatRoom from './components/ChatRoom';
import { AuthService } from './services/AuthService';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on app load
    const checkSession = async () => {
      const token = AuthService.getToken();
      if (token) {
        try {
          const isValid = await AuthService.validateSession(token);
          if (isValid.valid) {
            setIsAuthenticated(true);
            setCurrentUser(isValid.user);
          } else {
            AuthService.clearToken();
          }
        } catch (error) {
          AuthService.clearToken();
        }
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const handleLogin = (secretKey: string) => {
    setIsAuthenticated(true);
    setCurrentUser(secretKey); // This will be the secret key, username will be set in ChatRoom
  };

  const handleLogout = () => {
    AuthService.clearToken();
    setIsAuthenticated(false);
    setCurrentUser('');
    // Clear any client-side state
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {!isAuthenticated ? (
        <LoginForm onLogin={handleLogin} />
      ) : (
        <ChatRoom currentUser={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;