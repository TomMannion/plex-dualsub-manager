import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Film, Home, Settings, Wifi, WifiOff, User, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuth();

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
      {/* Elegant Navigation */}
      <header className="bg-charcoal-500/80 border-b border-sage-500/20 backdrop-blur-xl">
        <div className="px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-24 max-w-[1920px] 2xl:max-w-[2560px] mx-auto py-4 md:py-6">
          <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-4 md:gap-8 lg:gap-12 flex-1 min-w-0">
            <Link to="/" className="flex items-center gap-3 md:gap-4 group flex-shrink-0">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gold-500/20 rounded-xl flex items-center justify-center 
                            group-hover:bg-gold-500/30 group-hover:scale-105 transition-all duration-200">
                <Film className="w-5 h-5 md:w-7 md:h-7 text-gold-500" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-serif font-bold text-base md:text-lg lg:text-2xl text-cream-500 group-hover:text-gold-500 transition-colors duration-200 whitespace-nowrap">
                  Plex DualSub Manager
                </h1>
                <p className="text-xs text-mist-500 tracking-wide uppercase font-light whitespace-nowrap">
                  Subtitle Management
                </p>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      'flex items-center gap-2 transition-all duration-300 font-light text-sm relative group whitespace-nowrap',
                      isActive
                        ? 'text-gold-500'
                        : 'text-mist-500 hover:text-cream-500'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                    
                    {/* Elegant underline */}
                    <div className={clsx(
                      'absolute -bottom-1 left-0 right-0 h-px bg-gold-500 transition-all duration-300',
                      isActive 
                        ? 'opacity-100 scale-x-100' 
                        : 'opacity-0 scale-x-0 group-hover:opacity-50 group-hover:scale-x-100'
                    )} />
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Server Status - Simple Icon */}
            <div className="flex items-center">
              {status ? (
                status.connected ? (
                  <Wifi className="w-4 h-4 text-success-500" title={`Connected to ${status.server_name}`} />
                ) : (
                  <WifiOff className="w-4 h-4 text-error-500" title="Disconnected from server" />
                )
              ) : (
                <div className="w-2 h-2 bg-warning-500 rounded-full animate-pulse" title="Connecting to server..." />
              )}
            </div>

            {/* User Profile */}
            {user && (
              <div className="flex items-center gap-3">
                {/* User Info */}
                <div className="flex items-center gap-3">
                  {user.thumb && (
                    <img 
                      src={user.thumb} 
                      alt={user.friendlyName}
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="hidden md:block">
                    <p className="text-cream-500 font-medium text-sm">{user.friendlyName}</p>
                    <p className="text-mist-500 text-xs font-light">User</p>
                  </div>
                </div>
                
                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="text-mist-500 hover:text-cream-500 transition-colors duration-200 p-2"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Mobile Navigation Menu */}
            <div className="md:hidden">
              <nav className="flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={clsx(
                        'flex items-center justify-center p-2.5 rounded-lg transition-all duration-200',
                        isActive
                          ? 'bg-gold-500 text-black shadow-lg shadow-gold-500/20'
                          : 'text-mist-500 hover:text-cream-500 hover:bg-sage-500/10'
                      )}
                      title={item.label}
                    >
                      <Icon className="w-4 h-4" />
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-forest-500">
        {children}
      </main>
    </div>
  );
};