import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Film, Database, Subtitles, TrendingUp, ArrowRight } from 'lucide-react';
import { apiClient } from '../lib/api';

export const Dashboard: React.FC = () => {
  // Fetch basic stats
  const { data: libraries } = useQuery({
    queryKey: ['libraries'],
    queryFn: apiClient.getLibraries,
  });

  // Get total count for stats
  const { data: showsData } = useQuery({
    queryKey: ['shows-total'],
    queryFn: () => apiClient.getShows(),
  });

  // Get recent shows for preview (limit to 5 for display)
  const { data: recentShowsData } = useQuery({
    queryKey: ['shows-recent'],
    queryFn: () => apiClient.getShows(undefined, 5),
  });

  const { data: status } = useQuery({
    queryKey: ['connection-status'],
    queryFn: apiClient.getStatus,
  });

  const stats = [
    {
      title: 'TV Libraries',
      value: libraries?.libraries?.length || 0,
      icon: Database,
      color: 'text-blue-400',
    },
    {
      title: 'Total Shows',
      value: showsData?.count || 0,
      icon: Film,
      color: 'text-green-400',
    },
    {
      title: 'Server Status',
      value: status?.connected ? 'Connected' : 'Disconnected',
      icon: TrendingUp,
      color: status?.connected ? 'text-green-400' : 'text-red-400',
    },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <div>
        <h1 className="text-4xl font-bold text-plex-gray-100 mb-4">
          Welcome to Plex Dual Subtitle Manager
        </h1>
        <p className="text-xl text-plex-gray-400">
          Manage your TV show subtitles with advanced dual subtitle creation and customization.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-plex-gray-400 text-sm font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-plex-gray-100 mt-1">{stat.value}</p>
                </div>
                <Icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-plex-orange/20 rounded-lg flex items-center justify-center">
              <Film className="w-6 h-6 text-plex-orange" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-plex-gray-100 mb-2">
                Browse TV Shows
              </h3>
              <p className="text-plex-gray-400 mb-4">
                View your Plex TV show library and manage subtitles for individual episodes.
              </p>
              <Link
                to="/shows"
                className="inline-flex items-center gap-2 btn-primary"
              >
                Browse Shows
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Subtitles className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-plex-gray-100 mb-2">
                Create Dual Subtitles
              </h3>
              <p className="text-plex-gray-400 mb-4">
                Combine two subtitle files with custom positioning, colors, and fonts.
              </p>
              <Link
                to="/shows"
                className="inline-flex items-center gap-2 btn-secondary"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Shows Preview */}
      {recentShowsData?.shows && recentShowsData.shows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-plex-gray-100">Recent Shows</h2>
            <Link
              to="/shows"
              className="text-plex-orange hover:text-plex-orange-dark transition-colors font-medium"
            >
              View All Shows →
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {recentShowsData.shows.map((show) => (
              <Link
                key={show.id}
                to={`/shows/${show.id}`}
                className="group"
              >
                <div className="card hover:border-plex-orange/50 transition-all duration-200 p-4">
                  <div className="aspect-[2/3] bg-plex-gray-700 rounded-lg mb-3 overflow-hidden relative group-hover:scale-105 transition-transform duration-200">
                    {show.thumb ? (
                      <img
                        src={show.thumb}
                        alt={show.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-8 h-8 text-plex-gray-500" />
                      </div>
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                  </div>
                  <h3 className="font-medium text-plex-gray-100 text-sm group-hover:text-plex-orange transition-colors line-clamp-2">
                    {show.title}
                  </h3>
                  <p className="text-xs text-plex-gray-400 mt-1">
                    {show.episode_count} episodes
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Features Overview */}
      <div className="card">
        <h2 className="text-2xl font-bold text-plex-gray-100 mb-6">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg mx-auto mb-3 flex items-center justify-center">
              <Subtitles className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="font-semibold text-plex-gray-100 mb-2">Dual Subtitles</h3>
            <p className="text-sm text-plex-gray-400">
              Create dual-language subtitles with custom positioning and styling
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg mx-auto mb-3 flex items-center justify-center">
              <Database className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="font-semibold text-plex-gray-100 mb-2">Extract Embedded</h3>
            <p className="text-sm text-plex-gray-400">
              Extract embedded subtitles from video files to external format
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg mx-auto mb-3 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="font-semibold text-plex-gray-100 mb-2">Sync Validation</h3>
            <p className="text-sm text-plex-gray-400">
              Automatic timing validation ensures subtitles match video duration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};