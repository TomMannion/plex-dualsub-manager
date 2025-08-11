import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  ArrowRight,
  Calendar, 
  Play, 
  Subtitles, 
  Download,
  CheckCircle,
  XCircle,
  Search,
  Sparkles
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { BulkDualSubtitleWizard } from '../components/bulk/BulkDualSubtitleWizard';
import { fixPlexImageUrl } from '../utils/imageUtils';
import type { Episode } from '../types';

export const ShowDetail: React.FC = () => {
  const { showId } = useParams<{ showId: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [showBulkWizard, setShowBulkWizard] = useState(false);

  // Fetch show details
  const { data: show, isLoading } = useQuery({
    queryKey: ['show', showId],
    queryFn: () => apiClient.getShowDetail(showId!),
    enabled: !!showId,
  });

  // Filter episodes
  const filteredEpisodes = show?.episodes.filter((episode: Episode) => {
    const matchesSearch = episode.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeason = !selectedSeason || episode.season.toString() === selectedSeason;
    return matchesSearch && matchesSeason;
  }) || [];

  // Group episodes by season for better organization
  const episodesBySeason = filteredEpisodes.reduce((acc, episode) => {
    const season = episode.season;
    if (!acc[season]) acc[season] = [];
    acc[season].push(episode);
    return acc;
  }, {} as Record<number, Episode[]>);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-plex-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-plex-gray-700 rounded w-2/3 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-4">
                <div className="h-4 bg-plex-gray-700 rounded mb-2"></div>
                <div className="h-3 bg-plex-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-plex-gray-100 mb-2">Show not found</h2>
        <Link to="/shows" className="btn-primary">
          ← Back to Shows
        </Link>
      </div>
    );
  }

  // Get the best image URL (prefer art over thumb for background)
  const backgroundImageUrl = fixPlexImageUrl(show.art) || fixPlexImageUrl(show.thumb);

  return (
    <div className="relative min-h-screen">
      {/* Background Image */}
      {backgroundImageUrl && (
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${backgroundImageUrl})`,
          }}
        >
          {/* Multi-layer overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal-600/95 via-charcoal-700/90 to-charcoal-800/95" />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal-800/80 via-transparent to-charcoal-800/80" />
          <div className="absolute inset-0 backdrop-blur-sm" />
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10 space-y-6 px-4 md:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/shows" className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-cream-500 mb-3 drop-shadow-lg">{show.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-cream-400">
            <div className="flex items-center gap-1 bg-charcoal-600/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">{show.year}</span>
            </div>
            <div className="flex items-center gap-1 bg-charcoal-600/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <Play className="w-4 h-4" />
              <span className="font-medium">{show.episode_count} episodes</span>
            </div>
            <div className="flex items-center gap-1 bg-charcoal-600/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <Subtitles className="w-4 h-4" />
              <span className="font-medium">{show.subtitle_coverage} coverage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {show.summary && (
        <div className="bg-charcoal-600/80 backdrop-blur-sm rounded-2xl p-6 border border-sage-500/20 shadow-xl">
          <p className="text-cream-400 leading-relaxed text-lg font-light">{show.summary}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-charcoal-600/80 backdrop-blur-sm rounded-xl p-4 text-center border border-sage-500/20 shadow-lg">
          <div className="text-2xl font-bold text-gold-500">{show.episode_count}</div>
          <div className="text-sm text-cream-400 font-medium">Episodes</div>
        </div>
        <div className="bg-charcoal-600/80 backdrop-blur-sm rounded-xl p-4 text-center border border-sage-500/20 shadow-lg">
          <div className="text-2xl font-bold text-success-400">{show.episodes_with_subtitles}</div>
          <div className="text-sm text-cream-400 font-medium">With Subtitles</div>
        </div>
        <div className="bg-charcoal-600/80 backdrop-blur-sm rounded-xl p-4 text-center border border-sage-500/20 shadow-lg">
          <div className="text-2xl font-bold text-blue-400">{show.total_external_subtitles}</div>
          <div className="text-sm text-cream-400 font-medium">External</div>
        </div>
        <div className="bg-charcoal-600/80 backdrop-blur-sm rounded-xl p-4 text-center border border-sage-500/20 shadow-lg">
          <div className="text-2xl font-bold text-purple-400">{show.total_embedded_subtitles}</div>
          <div className="text-sm text-cream-400 font-medium">Embedded</div>
        </div>
      </div>

      {/* Bulk Actions */}
      <div 
        className="relative overflow-hidden rounded-2xl border border-success-500/30 cursor-pointer group shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
        onClick={() => setShowBulkWizard(true)}
      >
        {/* Green Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-success-600/20 via-success-500/15 to-success-400/20 group-hover:from-success-600/30 group-hover:via-success-500/25 group-hover:to-success-400/30 transition-all duration-300" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-success-500/5 to-success-600/10" />
        
        {/* Content */}
        <div className="relative backdrop-blur-sm bg-charcoal-600/60 p-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-success-500/20 rounded-xl flex items-center justify-center group-hover:bg-success-500/30 transition-colors duration-200 flex-shrink-0 shadow-lg">
              <Sparkles className="w-8 h-8 text-success-400 group-hover:text-success-300 transition-colors duration-200" />
            </div>
            <div className="flex-1">
              <h3 className="font-serif font-bold text-xl md:text-2xl text-cream-500 mb-3 group-hover:text-success-300 transition-colors duration-200 drop-shadow-sm">
                Create Bulk Dual Subtitles
              </h3>
              <p className="text-cream-400/90 leading-relaxed font-light">
                Generate dual-language subtitles for the entire series with smart language detection and batch processing.
              </p>
              <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="text-sm text-success-400 font-medium flex items-center gap-2">
                  <span>Click to start bulk processing</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Subtle Border Glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-success-500/0 via-success-400/20 to-success-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-plex-gray-500" />
          <input
            type="text"
            placeholder="Search episodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
        
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="input-field min-w-48"
        >
          <option value="">All Seasons</option>
          {show.seasons.map((season) => (
            <option key={season.id} value={season.index}>
              Season {season.index} ({season.episode_count} episodes)
            </option>
          ))}
        </select>
      </div>

      {/* Episodes */}
      {Object.keys(episodesBySeason).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(episodesBySeason)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([season, episodes]) => (
              <div key={season}>
                <h3 className="text-xl font-serif font-bold text-cream-500 mb-4 flex items-center gap-2 drop-shadow-md">
                  <Play className="w-5 h-5 text-gold-500" />
                  Season {season}
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {episodes.map((episode) => (
                    <EpisodeCard key={episode.id} episode={episode} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="bg-charcoal-600/60 backdrop-blur-sm rounded-2xl p-8 inline-block">
            <Play className="w-16 h-16 text-sage-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-cream-500 mb-2">No episodes found</h3>
            <p className="text-mist-500">Try adjusting your search or season filter.</p>
          </div>
        </div>
      )}

      {/* Bulk Dual Subtitle Wizard */}
      {showBulkWizard && (
        <BulkDualSubtitleWizard
          showId={showId!}
          showTitle={show.title}
          onClose={() => setShowBulkWizard(false)}
          onComplete={() => {
            // Optionally refetch show data to update stats
            console.log('Bulk dual subtitle creation completed');
          }}
        />
      )}
      </div>
    </div>
  );
};

const EpisodeCard: React.FC<{ episode: Episode }> = ({ episode }) => {
  const hasSubtitles = episode.file_info?.has_subtitles || false;
  const externalCount = episode.file_info?.external_subtitles?.length || 0;
  const embeddedCount = episode.file_info?.embedded_subtitles?.length || 0;
  
  return (
    <Link
      to={`/episodes/${episode.id}`}
      className="group"
    >
      <div className="bg-charcoal-600/80 backdrop-blur-sm rounded-xl border border-sage-500/20 hover:border-gold-500/50 transition-all duration-200 p-4 shadow-lg">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h4 className="font-semibold text-cream-500 group-hover:text-gold-500 transition-colors mb-1">
              {episode.season_episode}: {episode.title}
            </h4>
            <div className="text-sm text-mist-500">
              {episode.viewed && (
                <span className="inline-flex items-center gap-1 text-green-400 mr-3">
                  <CheckCircle className="w-3 h-3" />
                  Watched
                </span>
              )}
              {episode.duration && (
                <span>{Math.round(episode.duration / 60000)} min</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {hasSubtitles ? (
              <div className="flex items-center gap-1 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs">
                  {externalCount + embeddedCount} subs
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-400">
                <XCircle className="w-4 h-4" />
                <span className="text-xs">No subs</span>
              </div>
            )}
          </div>
        </div>

        {hasSubtitles && (
          <div className="flex items-center gap-4 text-xs text-mist-400">
            {externalCount > 0 && (
              <div className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                <span>{externalCount} external</span>
              </div>
            )}
            {embeddedCount > 0 && (
              <div className="flex items-center gap-1">
                <Subtitles className="w-3 h-3" />
                <span>{embeddedCount} embedded</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-xs text-gold-500 font-medium">
            Click to manage subtitles →
          </div>
        </div>
      </div>
    </Link>
  );
};