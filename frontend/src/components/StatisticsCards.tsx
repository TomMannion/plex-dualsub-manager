import React from 'react';

interface StatisticsCardsProps {
  totalShows: number;
  filteredCount: number;
  librariesCount: number;
  totalEpisodes: number;
  isLoadingCounts: boolean;
}

export const StatisticsCards: React.FC<StatisticsCardsProps> = ({
  totalShows,
  filteredCount,
  librariesCount,
  totalEpisodes,
  isLoadingCounts
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
      <div className="text-center p-4 md:p-6 bg-charcoal-500/50 rounded-xl backdrop-blur-sm border border-gold-500/20 shadow-lg shadow-black/10">
        <p className="text-xl md:text-2xl font-serif font-bold text-cream-500 mb-1">
          {totalShows}
        </p>
        <p className="text-mist-500 text-sm font-light">Total Shows</p>
      </div>
      
      <div className="text-center p-4 md:p-6 bg-charcoal-500/50 rounded-xl backdrop-blur-sm border border-gold-500/20 shadow-lg shadow-black/10">
        <p className="text-xl md:text-2xl font-serif font-bold text-cream-500 mb-1">
          {filteredCount}
        </p>
        <p className="text-mist-500 text-sm font-light">Filtered</p>
      </div>
      
      <div className="text-center p-4 md:p-6 bg-charcoal-500/50 rounded-xl backdrop-blur-sm border border-gold-500/20 shadow-lg shadow-black/10">
        <p className="text-xl md:text-2xl font-serif font-bold text-cream-500 mb-1">
          {librariesCount}
        </p>
        <p className="text-mist-500 text-sm font-light">Libraries</p>
      </div>
      
      <div className="text-center p-4 md:p-6 bg-charcoal-500/50 rounded-xl backdrop-blur-sm border border-gold-500/20 shadow-lg shadow-black/10">
        <p className="text-xl md:text-2xl font-serif font-bold text-cream-500 mb-1">
          {isLoadingCounts ? '...' : totalEpisodes.toLocaleString()}
        </p>
        <p className="text-mist-500 text-sm font-light">Episodes</p>
      </div>
    </div>
  );
};