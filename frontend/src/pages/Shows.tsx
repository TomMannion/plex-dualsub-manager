import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Search, Film, Calendar, Play, Subtitles, Grid, List } from 'lucide-react';
import { apiClient } from '../lib/api';
import { fixPlexImageUrl } from '../utils/imageUtils';
import { LanguageFilter } from '../components/LanguageFilter';
import { StatisticsCards } from '../components/StatisticsCards';
import type { Show } from '../types';

interface Language {
  code: string;
  name: string;
  nativeName?: string;
  commonCodes: string[];
}

export const Shows: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedLanguages, setSelectedLanguages] = useState<Language[]>([]);

  // Fetch libraries for filtering
  const { data: libraries } = useQuery({
    queryKey: ['libraries'],
    queryFn: apiClient.getLibraries,
  });

  // Fetch shows - use language filtering if languages are selected
  const { data: showsData, isLoading } = useQuery({
    queryKey: ['shows', selectedLibrary, selectedLanguages.map(l => l.code)],
    queryFn: () => {
      const languageCodes = selectedLanguages.map(l => l.code);
      if (languageCodes.length > 0) {
        return apiClient.getShowsWithLanguages(languageCodes, selectedLibrary || undefined);
      } else {
        return apiClient.getShows(selectedLibrary || undefined, undefined, true);
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Filter shows based on search term (language filtering is handled by backend)
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
    <div className="min-h-screen">
      {/* ELEGANT HEADER */}
      <section className="py-12 lg:py-16">
        <div className="px-4 md:px-6 lg:px-8 max-w-full mx-auto">
          <div className="text-center mb-12">
            <h1 className="font-serif font-bold text-4xl md:text-5xl lg:text-6xl text-cream-500 mb-6 tracking-tight">
              TV Shows
            </h1>
            <p className="text-lg md:text-xl text-mist-500 font-light leading-relaxed max-w-2xl mx-auto">
              Browse your Plex TV show library and manage subtitles.
            </p>
            
            {/* Elegant Divider */}
            <div className="mt-8 h-px bg-gradient-to-r from-transparent via-gold-500/30 to-transparent max-w-sm mx-auto"></div>
          </div>

          {/* SEARCH & FILTERS */}
          <div className="mb-12">
            {/* First Row: Search and Library */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 mb-4">
              {/* Search */}
              <div className="relative md:col-span-9">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-mist-500" />
                <input
                  type="text"
                  placeholder="Search your collection..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-charcoal-500 border border-gold-500/20 shadow-md shadow-black/10 text-cream-500 rounded-xl pl-12 pr-4 py-4 
                           focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50
                           placeholder:text-mist-500 font-light transition-all duration-200 hover:border-gold-500/40"
                />
              </div>

              {/* Library Filter */}
              <div className="md:col-span-2">
                {libraries?.libraries && libraries.libraries.length > 1 && (
                  <select
                    value={selectedLibrary}
                    onChange={(e) => setSelectedLibrary(e.target.value)}
                    className="w-full bg-charcoal-500 border border-gold-500/20 shadow-lg shadow-black/20 text-cream-500 rounded-xl px-6 md:px-8 py-4
                             focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50
                             font-light transition-all duration-200 hover:border-gold-500/40"
                  >
                    <option value="">All Libraries</option>
                    {libraries.libraries.map((library) => (
                      <option key={library.key} value={library.title}>
                        {library.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* View Toggle */}
              <div className="md:col-span-1 flex">
                <div className="flex bg-charcoal-500 border border-gold-500/20 shadow-lg shadow-black/20 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      viewMode === 'grid' 
                        ? 'bg-gold-500 text-black' 
                        : 'text-mist-500 hover:text-cream-500'
                    }`}
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      viewMode === 'list' 
                        ? 'bg-gold-500 text-black' 
                        : 'text-mist-500 hover:text-cream-500'
                    }`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Second Row: Language Filter */}
            <div className="grid grid-cols-1 gap-4 md:gap-6">
              <div>
                <LanguageFilter
                  selectedLanguages={selectedLanguages}
                  onLanguagesChange={setSelectedLanguages}
                  maxSelections={2}
                />
                {selectedLanguages.length > 0 && (
                  <div className="mt-4 flex items-center text-sm text-mist-500">
                    <div className="bg-charcoal-500/50 rounded-xl px-4 py-2 border border-gold-500/20">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gold-500 rounded-full animate-pulse" />
                        <span>Shows with {selectedLanguages.map(l => l.name).join(' + ')} subtitles</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SUBTLE STATS */}
          <StatisticsCards
            totalShows={showsData?.count || 0}
            filteredCount={filteredShows.length}
            librariesCount={libraries?.libraries?.length || 0}
            totalEpisodes={totalEpisodes}
            isLoadingCounts={isLoadingCounts}
          />
        </div>
      </section>

      {/* SHOWS GALLERY */}
      <section className="pb-12">
        <div className="px-4 md:px-6 lg:px-8 max-w-full mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 lg:gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[2/3] bg-charcoal-500 rounded-xl mb-3" />
                  <div className="h-4 bg-charcoal-500 rounded mb-2" />
                  <div className="h-3 bg-charcoal-500 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : filteredShows.length > 0 ? (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 lg:gap-6"
                : "space-y-4"
            }>
              {filteredShows.map((show) => (
                <ShowCard 
                  key={show.id} 
                  show={show} 
                  counts={showCounts.get(show.id)}
                  viewMode={viewMode}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-charcoal-500/50 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Film className="w-10 h-10 text-sage-500" />
              </div>
              <h3 className="font-serif font-bold text-2xl text-cream-500 mb-3">No shows found</h3>
              <p className="text-mist-500 font-light max-w-md mx-auto">
                {searchTerm 
                  ? 'Try adjusting your search terms or browse all shows.' 
                  : 'No shows available in your library.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const ShowCard: React.FC<{ 
  show: Show; 
  counts?: { episode_count: number; season_count: number };
  viewMode: 'grid' | 'list';
}> = ({ show, counts, viewMode }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (viewMode === 'list') {
    return (
      <Link to={`/shows/${show.id}`} className="group block">
        <div className="bg-charcoal-500 border border-gold-500/20 shadow-lg shadow-black/20 rounded-xl p-6 hover:border-gold-500/50 transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center gap-6">
            {/* Thumbnail */}
            <div className="w-16 h-24 bg-slate-500 rounded-lg overflow-hidden flex-shrink-0">
              {show.thumb && !imageError ? (
                <img
                  src={show.thumb}
                  alt={show.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="w-6 h-6 text-sage-500" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1">
              <h3 className="font-serif font-bold text-xl text-cream-500 mb-2 group-hover:text-gold-500 transition-colors">
                {show.title}
              </h3>
              <div className="flex items-center gap-6 text-sm text-mist-500">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{show.year || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  <span>
                    {counts?.episode_count !== undefined 
                      ? `${counts.episode_count} episodes` 
                      : 'Loading...'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Subtitles className="w-4 h-4" />
                  <span>
                    {counts?.season_count !== undefined 
                      ? `${counts.season_count} seasons` 
                      : 'Loading...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Arrow */}
            <div className="text-gold-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Play className="w-5 h-5" />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/shows/${show.id}`} className="group block">
      <div className="relative overflow-hidden rounded-xl bg-charcoal-500 border border-gold-500/15 shadow-lg shadow-black/30 hover:shadow-2xl hover:border-gold-500/30 transition-all duration-300 hover:-translate-y-2">
        {/* Show Thumbnail */}
        <div className="aspect-[2/3] overflow-hidden relative">
          {fixPlexImageUrl(show.thumb) && !imageError ? (
            <>
              {/* Placeholder while loading */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-slate-500 animate-pulse flex items-center justify-center">
                  <Film className="w-12 h-12 text-sage-500" />
                </div>
              )}
              {/* Actual image */}
              <img
                src={fixPlexImageUrl(show.thumb)!}
                alt={show.title}
                className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
                onLoad={() => {
                  setImageLoaded(true);
                }}
                onError={(e) => {
                  setImageError(true);
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-sage-500/20">
              <Film className="w-12 h-12 text-sage-500" />
            </div>
          )}
          
          {/* Elegant Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Hover Action */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-gold-500 text-black px-6 md:px-8 py-2 rounded-lg font-medium shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
              Manage Subtitles
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-serif font-bold text-cream-500 text-lg mb-2 line-clamp-2 group-hover:text-gold-500 transition-colors duration-200">
            {show.title}
          </h3>
          
          <div className="flex items-center gap-2 text-xs text-mist-500 mb-2">
            <Calendar className="w-3 h-3" />
            <span>{show.year || 'Unknown'}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-mist-500">
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