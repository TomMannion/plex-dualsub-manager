import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Search, Film, Calendar, Play, Subtitles } from 'lucide-react';
import { apiClient } from '../lib/api';
import type { Show } from '../types';

export const Shows: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState<string>('');

  // Fetch libraries for filtering
  const { data: libraries } = useQuery({
    queryKey: ['libraries'],
    queryFn: apiClient.getLibraries,
  });

  // Fetch shows in fast mode (no counts)
  const { data: showsData, isLoading } = useQuery({
    queryKey: ['shows', selectedLibrary],
    queryFn: () => apiClient.getShows(selectedLibrary || undefined, undefined, true),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Filter shows based on search term
  const filteredShows = showsData?.shows.filter((show: Show) =>
    show.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Use React Query for fetching counts with proper caching
  const countQueries = useQueries({
    queries: filteredShows.map(show => ({
      queryKey: ['show-counts', show.id],
      queryFn: () => apiClient.getShowCounts(show.id),
      staleTime: 10 * 60 * 1000, // Cache for 10 minutes
      cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
      retry: 1, // Only retry once on failure
    }))
  });

  // Build a map of counts from query results
  const showCounts = new Map<string, { episode_count: number; season_count: number }>();
  countQueries.forEach((query, index) => {
    if (query.data && filteredShows[index]) {
      showCounts.set(filteredShows[index].id, query.data);
    }
  });

  // Calculate stats with actual counts when available
  const totalEpisodes = filteredShows.reduce((acc, show) => {
    const counts = showCounts.get(show.id);
    return acc + (counts?.episode_count || 0);
  }, 0);

  const isLoadingCounts = countQueries.some(q => q.isLoading);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-plex-gray-100 mb-4">TV Shows</h1>
        <p className="text-lg text-plex-gray-400">
          Browse your Plex TV show library and manage subtitles.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-plex-gray-500" />
          <input
            type="text"
            placeholder="Search shows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>

        {/* Library Filter */}
        {libraries?.libraries && libraries.libraries.length > 1 && (
          <select
            value={selectedLibrary}
            onChange={(e) => setSelectedLibrary(e.target.value)}
            className="input-field min-w-48"
          >
            <option value="">All Libraries</option>
            {libraries.libraries.map((library) => (
              <option key={library.key} value={library.title}>
                {library.title} ({library.show_count} shows)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center p-4">
          <div className="text-2xl font-bold text-plex-orange">{showsData?.count || 0}</div>
          <div className="text-sm text-plex-gray-400">Total Shows</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-2xl font-bold text-blue-400">{filteredShows.length}</div>
          <div className="text-sm text-plex-gray-400">Filtered</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-2xl font-bold text-green-400">
            {libraries?.libraries?.length || 0}
          </div>
          <div className="text-sm text-plex-gray-400">Libraries</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-2xl font-bold text-purple-400">
            {isLoadingCounts ? '...' : totalEpisodes}
          </div>
          <div className="text-sm text-plex-gray-400">Episodes</div>
        </div>
      </div>

      {/* Shows Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="aspect-[2/3] bg-plex-gray-700 rounded-lg mb-3" />
              <div className="h-4 bg-plex-gray-700 rounded mb-2" />
              <div className="h-3 bg-plex-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filteredShows.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-8">
          {filteredShows.map((show) => (
            <ShowCard 
              key={show.id} 
              show={show} 
              counts={showCounts.get(show.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Film className="w-16 h-16 text-plex-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-plex-gray-300 mb-2">No shows found</h3>
          <p className="text-plex-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'No shows available in your library.'}
          </p>
        </div>
      )}
    </div>
  );
};

const ShowCard: React.FC<{ 
  show: Show; 
  counts?: { episode_count: number; season_count: number } 
}> = ({ show, counts }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <Link
      to={`/shows/${show.id}`}
      className="group block"
    >
      <div className="card hover:border-plex-orange/50 transition-all duration-200 p-4 h-full">
        {/* Poster */}
        <div className="aspect-[2/3] bg-plex-gray-700 rounded-lg mb-3 overflow-hidden relative group-hover:scale-105 transition-transform duration-200">
          {show.thumb && !imageError ? (
            <>
              {/* Placeholder while loading */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-plex-gray-700 animate-pulse flex items-center justify-center">
                  <Film className="w-12 h-12 text-plex-gray-500" />
                </div>
              )}
              {/* Actual image with lazy loading */}
              <img
                src={show.thumb}
                alt={show.title}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-12 h-12 text-plex-gray-500" />
            </div>
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
            <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-plex-gray-100 group-hover:text-plex-orange transition-colors line-clamp-2">
            {show.title}
          </h3>
          
          <div className="flex items-center gap-2 text-xs text-plex-gray-400">
            <Calendar className="w-3 h-3" />
            <span>{show.year || 'Unknown'}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-plex-gray-400">
            <div className="flex items-center gap-1">
              <Play className="w-3 h-3" />
              <span>
                {counts?.episode_count !== undefined 
                  ? `${counts.episode_count} eps` 
                  : '...'
                }
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Subtitles className="w-3 h-3" />
              <span>
                {counts?.season_count !== undefined 
                  ? `${counts.season_count} seasons` 
                  : '...'
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};