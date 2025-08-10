import React, { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PlexLogin from './PlexLogin';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback 
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while checking gallery access
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-forest-500">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-6 text-gold-500" />
          <p className="text-mist-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Show gallery entrance if not authenticated
  if (!isAuthenticated) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-forest-500 px-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-12">
            <h1 className="font-serif font-bold text-4xl lg:text-5xl text-cream-500 mb-4 tracking-tight">
              Plex DualSub Manager
            </h1>
            <p className="text-mist-500 text-lg leading-relaxed">
              Professional subtitle management for your Plex media server
            </p>
            <div className="mt-8 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent"></div>
          </div>
          <div className="card-gallery">
            <PlexLogin />
          </div>
        </div>
      </div>
    );
  }

  // Show protected content
  return <>{children}</>;
};

export default ProtectedRoute;