import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Calendar, 
  Play, 
  Subtitles, 
  Download,
  CheckCircle,
  XCircle,
  Search,
  Filter
} from 'lucide-react';
import { apiClient } from '../lib/api';
import type { Episode } from '../types';

export const ShowDetail: React.FC = () => {
  const { showId } = useParams<{ showId: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/shows" className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-plex-gray-100 mb-2">{show.title}</h1>
          <div className="flex items-center gap-4 text-plex-gray-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{show.year}</span>
            </div>
            <div className="flex items-center gap-1">
              <Play className="w-4 h-4" />
              <span>{show.episode_count} episodes</span>
            </div>
            <div className="flex items-center gap-1">
              <Subtitles className="w-4 h-4" />
              <span>{show.subtitle_coverage} coverage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {show.summary && (
        <div className="card">
          <p className="text-plex-gray-300 leading-relaxed">{show.summary}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center p-4">
          <div className="text-2xl font-bold text-plex-orange">{show.episode_count}</div>
          <div className="text-sm text-plex-gray-400">Episodes</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-2xl font-bold text-green-400">{show.episodes_with_subtitles}</div>
          <div className="text-sm text-plex-gray-400">With Subtitles</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-2xl font-bold text-blue-400">{show.total_external_subtitles}</div>
          <div className="text-sm text-plex-gray-400">External</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-2xl font-bold text-purple-400">{show.total_embedded_subtitles}</div>
          <div className="text-sm text-plex-gray-400">Embedded</div>
        </div>
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
                <h3 className="text-xl font-bold text-plex-gray-100 mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-plex-orange" />
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
          <Play className="w-16 h-16 text-plex-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-plex-gray-300 mb-2">No episodes found</h3>
          <p className="text-plex-gray-500">Try adjusting your search or season filter.</p>
        </div>
      )}
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
      <div className="card hover:border-plex-orange/50 transition-all duration-200 p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h4 className="font-semibold text-plex-gray-100 group-hover:text-plex-orange transition-colors mb-1">
              {episode.season_episode}: {episode.title}
            </h4>
            <div className="text-sm text-plex-gray-400">
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
          <div className="flex items-center gap-4 text-xs text-plex-gray-400">
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
          <div className="text-xs text-plex-orange font-medium">
            Click to manage subtitles →
          </div>
        </div>
      </div>
    </Link>
  );
};