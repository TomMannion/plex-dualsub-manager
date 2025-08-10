import React, { useState, useCallback } from 'react';
import { LogIn, Loader2, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface PlexLoginProps {
  onLoginSuccess?: () => void;
  onLoginError?: (error: string) => void;
}

interface PlexUser {
  friendlyName: string;
  email: string;
  thumb: string;
}

export const PlexLogin: React.FC<PlexLoginProps> = ({ onLoginSuccess, onLoginError }) => {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const [authStep, setAuthStep] = useState<'idle' | 'waiting' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  const handleLogin = useCallback(async () => {
    setAuthStep('waiting');
    setError('');

    try {
      await login();
      setAuthStep('idle');
      onLoginSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setError(errorMessage);
      setAuthStep('error');
      onLoginError?.(errorMessage);
    }
  }, [login, onLoginSuccess, onLoginError]);

  const handleLogout = useCallback(() => {
    logout();
    setAuthStep('idle');
    setError('');
  }, [logout]);

  // Show curator profile if authenticated
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-4 p-6 bg-success/10 border border-success/20 rounded-xl backdrop-blur-sm">
        <div className="flex items-center gap-4 flex-1">
          {user.thumb && (
            <img 
              src={user.thumb} 
              alt={user.friendlyName}
              className="w-12 h-12 rounded-full object-cover border-2 border-success/30"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div>
            <div className="font-serif font-bold text-cream-500 text-lg">{user.friendlyName}</div>
            <div className="text-success text-sm">Connected</div>
            <div className="text-mist-500 text-xs">{user.email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn-ghost text-sm"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gallery Access Button */}
      {authStep === 'idle' && (
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full btn-primary flex items-center justify-center gap-3 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <LogIn className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
          )}
          {isLoading ? 'Connecting...' : 'Login with Plex'}
        </button>
      )}

      {/* Authentication in Progress */}
      {authStep === 'waiting' && (
        <div className="text-center p-8 bg-info/10 border border-info/20 rounded-xl backdrop-blur-sm">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-info" />
          <div className="font-serif font-bold text-cream-500 mb-2 text-xl">Plex Authentication</div>
          <div className="text-mist-500">
            Please complete the authentication process in the popup window to connect to your Plex server
          </div>
        </div>
      )}

      {/* Authentication Error */}
      {authStep === 'error' && error && (
        <div className="p-6 bg-error/10 border border-error/20 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-error" />
            <div className="font-serif font-bold text-cream-500 text-lg">Access Denied</div>
          </div>
          <div className="text-mist-500 mb-6 leading-relaxed">{error}</div>
          <button
            onClick={() => setAuthStep('idle')}
            className="btn-secondary w-full"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Gallery Information */}
      {authStep === 'idle' && (
        <div className="text-center">
          <p className="text-mist-500 text-sm leading-relaxed">
            Connect to your Plex media server to access your library and manage subtitle files
          </p>
        </div>
      )}
    </div>
  );
};

export default PlexLogin;