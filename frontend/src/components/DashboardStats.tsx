import React from 'react';
import { Database, Film, TrendingUp } from 'lucide-react';
import type { Show } from '../types';

interface Library {
  key: string;
  title: string;
}

interface ShowsData {
  shows: Show[];
  count: number;
}

interface DashboardStatsProps {
  libraries?: { libraries: Library[] };
  showsData?: ShowsData;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  libraries,
  showsData
}) => {
  const totalEpisodes = showsData?.shows 
    ? showsData.shows.reduce((acc, show) => acc + (show.episode_count || 0), 0) 
    : 0;

  return (
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
          {totalEpisodes}
        </p>
        <p className="text-mist-500 text-sm font-light">Episodes</p>
      </div>
    </div>
  );
};