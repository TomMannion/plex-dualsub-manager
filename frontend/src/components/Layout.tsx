import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Film, Home, Settings, Wifi, WifiOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiClient } from '../lib/api';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  // Check connection status
  const { data: status } = useQuery({
    queryKey: ['connection-status'],
    queryFn: apiClient.getStatus,
    refetchInterval: 10000, // Check every 10 seconds
    retry: false,
  });

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/shows', label: 'TV Shows', icon: Film },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-plex-gray-800 border-b border-plex-gray-700 px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-4">
              <div className="w-10 h-10 bg-plex-orange rounded-xl flex items-center justify-center">
                <Film className="w-6 h-6 text-black" />
              </div>
              <h1 className="text-2xl font-bold text-plex-gray-100">
                Plex Dual Subtitle Manager
              </h1>
            </Link>

            <nav className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-plex-orange text-black font-medium shadow-lg'
                        : 'text-plex-gray-300 hover:text-plex-gray-100 hover:bg-plex-gray-700'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-3">
            {status ? (
              status.connected ? (
                <div className="flex items-center gap-3 text-green-400 bg-green-400/10 px-3 py-2 rounded-lg">
                  <Wifi className="w-5 h-5" />
                  <span className="font-medium">{status.server_name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
                  <WifiOff className="w-5 h-5" />
                  <span className="font-medium">Disconnected</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-3 text-yellow-400 bg-yellow-400/10 px-3 py-2 rounded-lg">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="font-medium">Connecting...</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-plex-gray-900">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
};