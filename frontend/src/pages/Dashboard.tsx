import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Film, Database, Subtitles, TrendingUp, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { fixPlexImageUrl } from '../utils/imageUtils';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  
  // Fetch basic stats
  const { data: libraries } = useQuery({
    queryKey: ['libraries'],
    queryFn: apiClient.getLibraries,
  });

  // Get total count for stats with episode counts
  const { data: showsData } = useQuery({
    queryKey: ['shows-total'],
    queryFn: () => apiClient.getShows(undefined, undefined, false), // Use slow mode to get episode counts
  });

  // Get recent shows for preview (limit to 4 for clean grid)
  const { data: recentShowsData } = useQuery({
    queryKey: ['shows-recent'],
    queryFn: () => apiClient.getShows(undefined, 4, false), // Use slow mode to get episode counts
  });

  const { data: status } = useQuery({
    queryKey: ['connection-status'],
    queryFn: apiClient.getStatus,
  });


  return (
    <div className="min-h-screen">
      {/* 1. ELEGANT HERO */}
      <section className="py-12 lg:py-20">
        <div className="text-center px-4 md:px-6 lg:px-8 max-w-full mx-auto">
          {/* Personal Welcome */}
          <div className="mb-8">
            <p className="text-mist-500 font-light text-lg lg:text-xl mb-2">
              Welcome back{user?.friendlyName ? `, ${user.friendlyName}` : ''}
            </p>
            
            {/* Subtle Status Indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {status?.connected ? (
                <>
                  <Wifi className="w-4 h-4 text-success-500" />
                  <span className="text-success-500 text-sm font-medium">{status.server_name}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-error-500" />
                  <span className="text-error-500 text-sm font-medium">Disconnected</span>
                </>
              )}
            </div>
          </div>

          {/* Main Title */}
          <h1 className="font-serif font-bold text-4xl md:text-5xl lg:text-6xl text-cream-500 mb-6 tracking-tight">
            Your Media Gallery
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-mist-500 font-light leading-relaxed max-w-3xl mx-auto">
            Professional subtitle management with sophisticated dual-language capabilities
          </p>
          
          {/* Elegant Divider */}
          <div className="mt-12 h-px bg-gradient-to-r from-transparent via-gold-500/30 to-transparent max-w-sm mx-auto"></div>
        </div>
      </section>

      {/* 2. FEATURED CONTENT GALLERY */}
      {recentShowsData?.shows && recentShowsData.shows.length > 0 && (
        <section className="py-12 px-4 md:px-6 lg:px-8 max-w-full mx-auto">
          <div>
            <div className="mb-12 text-center md:text-left">
              <h2 className="font-serif font-bold text-2xl md:text-3xl text-cream-500 mb-2">
                Continue Working
              </h2>
              <p className="text-mist-500 font-light">Recently added to your collection</p>
            </div>
            
            {/* Responsive Featured Gallery */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {recentShowsData.shows.map((show, index) => (
                <Link
                  key={show.id}
                  to={`/shows/${show.id}`}
                  className="group"
                >
                  <div className="relative overflow-hidden rounded-xl bg-charcoal-500 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                    {/* Show Thumbnail */}
                    <div className="aspect-[2/3] overflow-hidden relative">
                      {fixPlexImageUrl(show.thumb) ? (
                        <img
                          src={fixPlexImageUrl(show.thumb)!}
                          alt={show.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                          onError={(e) => {
                            // Hide the broken image and show the fallback
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      {/* Fallback Icon */}
                      <div className={`fallback-icon w-full h-full flex items-center justify-center bg-sage-500/20 ${fixPlexImageUrl(show.thumb) ? 'hidden' : 'flex'}`}>
                        <Film className="w-12 h-12 text-sage-500" />
                      </div>
                      
                      {/* Elegant Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-serif font-bold text-cream-500 text-lg mb-1 line-clamp-2 group-hover:text-gold-500 transition-colors duration-200">
                        {show.title}
                      </h3>
                      <p className="text-mist-500 text-sm font-light">
                        {show.episode_count} episodes
                      </p>
                    </div>

                    {/* Hover Action */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="bg-gold-500 text-black px-4 py-2 rounded-lg font-medium shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                        Manage Subtitles
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. PRIMARY ACTIONS */}
      <section className="py-12 px-4 md:px-6 lg:px-8 max-w-full mx-auto">
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Dual Subtitles */}
            <div className="card-gallery group relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="w-16 h-16 bg-gold-500/20 rounded-xl flex items-center justify-center group-hover:bg-gold-500/30 transition-colors duration-200 flex-shrink-0">
                  <Subtitles className="w-8 h-8 text-gold-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif font-bold text-xl md:text-2xl text-cream-500 mb-3 group-hover:text-gold-500 transition-colors duration-200">
                    Create Dual Subtitles
                  </h3>
                  <p className="text-mist-500 mb-6 leading-relaxed font-light">
                    Generate sophisticated dual-language subtitle files with customizable positioning and timing.
                  </p>
                  <Link
                    to="/shows"
                    className="inline-flex items-center gap-3 btn-primary group-hover:shadow-lg group-hover:shadow-gold-500/25 transition-all duration-200"
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Browse All Shows */}
            <div className="card-gallery group relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="w-16 h-16 bg-gold-500/20 rounded-xl flex items-center justify-center group-hover:bg-gold-500/30 transition-colors duration-200 flex-shrink-0">
                  <Film className="w-8 h-8 text-gold-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif font-bold text-xl md:text-2xl text-cream-500 mb-3 group-hover:text-gold-500 transition-colors duration-200">
                    Browse All Shows
                  </h3>
                  <p className="text-mist-500 mb-6 leading-relaxed font-light">
                    Explore your complete Plex media library and manage subtitle files for individual episodes.
                  </p>
                  <Link
                    to="/shows"
                    className="inline-flex items-center gap-3 btn-secondary group-hover:border-gold-500 transition-all duration-200"
                  >
                    Browse Library
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SUBTLE STATISTICS */}
      <section className="py-12 px-4 md:px-6 lg:px-8 max-w-full mx-auto">
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <div className="text-center p-6 bg-charcoal-500/50 rounded-xl backdrop-blur-sm border border-sage-500/20">
              <Database className="w-6 h-6 text-gold-500 mx-auto mb-2" />
              <p className="text-2xl font-serif font-bold text-cream-500 mb-1">
                {libraries?.libraries?.length || 0}
              </p>
              <p className="text-mist-500 text-sm font-light">Libraries</p>
            </div>
            
            <div className="text-center p-6 bg-charcoal-500/50 rounded-xl backdrop-blur-sm border border-sage-500/20">
              <Film className="w-6 h-6 text-gold-500 mx-auto mb-2" />
              <p className="text-2xl font-serif font-bold text-cream-500 mb-1">
                {showsData?.count || 0}
              </p>
              <p className="text-mist-500 text-sm font-light">Shows</p>
            </div>
            
            <div className="text-center p-6 bg-charcoal-500/50 rounded-xl backdrop-blur-sm border border-sage-500/20 col-span-2 md:col-span-1">
              <TrendingUp className="w-6 h-6 text-success-500 mx-auto mb-2" />
              <p className="text-2xl font-serif font-bold text-cream-500 mb-1">
                {showsData?.shows ? showsData.shows.reduce((acc, show) => acc + (show.episode_count || 0), 0) : 0}
              </p>
              <p className="text-mist-500 text-sm font-light">Episodes</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};