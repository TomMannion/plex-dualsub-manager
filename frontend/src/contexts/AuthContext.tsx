import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import PlexAuthService from '../services/plexAuth';

interface PlexUser {
  id: number;
  friendlyName: string;
  email: string;
  thumb: string;
  username: string;
}

interface AuthContextType {
  user: PlexUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  validateAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<PlexUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initialize auth state on app startup
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (PlexAuthService.isAuthenticated()) {
          const isValid = await PlexAuthService.validateStoredAuth();
          if (isValid) {
            const userData = PlexAuthService.getStoredUserData();
            if (userData) {
              setUser({
                id: userData.user.id,
                friendlyName: userData.user.friendlyName,
                email: userData.user.email,
                thumb: userData.user.thumb,
                username: userData.user.username,
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        PlexAuthService.logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      setIsLoading(true);
      
      PlexAuthService.startAuthFlow()
        .then(({ loginUrl, pinId }) => {
          // Open popup for auth
          const popup = window.open(
            loginUrl,
            'plexAuth',
            'width=600,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
          );

          if (!popup) {
            throw new Error('Please allow popups for this site and try again');
          }

          // Poll for completion
          PlexAuthService.pollForAuth(
            pinId,
            (authToken, userData) => {
              // Success
              setUser({
                id: userData.user.id,
                friendlyName: userData.user.friendlyName,
                email: userData.user.email,
                thumb: userData.user.thumb,
                username: userData.user.username,
              });
              setIsLoading(false);
              popup.close();
              resolve();
            },
            (error) => {
              // Error
              setIsLoading(false);
              popup.close();
              reject(error);
            }
          );

          // Monitor popup closure
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed);
              if (isLoading) {
                setIsLoading(false);
                reject(new Error('Authentication cancelled'));
              }
            }
          }, 1000);
        })
        .catch((error) => {
          setIsLoading(false);
          reject(error);
        });
    });
  };

  const logout = () => {
    PlexAuthService.logout();
    setUser(null);
  };

  const validateAuth = async (): Promise<boolean> => {
    try {
      const isValid = await PlexAuthService.validateStoredAuth();
      if (!isValid) {
        setUser(null);
      }
      return isValid;
    } catch (error) {
      setUser(null);
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    validateAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;