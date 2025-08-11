import React from 'react';
import { FileText, Download } from 'lucide-react';
import type { LanguageAvailability } from '../../types/bulk';
import { COMPREHENSIVE_LANGUAGES } from '../../data/languages';

interface LanguageAvailabilityCardProps {
  languageCode: string;
  availability: LanguageAvailability;
  totalEpisodes: number;
}

export const LanguageAvailabilityCard: React.FC<LanguageAvailabilityCardProps> = ({
  languageCode,
  availability,
  totalEpisodes
}) => {
  const language = COMPREHENSIVE_LANGUAGES.find(l => l.code === languageCode);
  const percentage = Math.min(100, Math.round((availability.episodes_available / totalEpisodes) * 100));
  
  // Determine card styling based on availability
  const getCardStyling = () => {
    if (percentage >= 90) return 'border-success-500/30 bg-success-500/5';
    if (percentage >= 70) return 'border-warning-500/30 bg-warning-500/5';
    return 'border-sage-500/30 bg-sage-500/5';
  };

  const getPercentageColor = () => {
    if (percentage >= 90) return 'text-success-500';
    if (percentage >= 70) return 'text-warning-500';
    return 'text-sage-500';
  };

  return (
    <div className={`p-4 rounded-xl border transition-all duration-200 hover:border-gold-500/50 ${getCardStyling()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h5 className="font-semibold text-cream-500 truncate">
            {language?.name || languageCode}
          </h5>
          <p className="text-xs text-mist-500 uppercase tracking-wide">
            {languageCode}
          </p>
        </div>
        <div className={`text-right ${getPercentageColor()}`}>
          <div className="text-lg font-bold">
            {percentage}%
          </div>
          <div className="text-xs">
            {availability.episodes_available}/{totalEpisodes}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-charcoal-400 rounded-full h-2 mb-3">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            percentage >= 90 ? 'bg-success-500' :
            percentage >= 70 ? 'bg-warning-500' : 'bg-sage-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Source Breakdown */}
      <div className="flex items-center justify-between text-xs text-mist-500">
        <div className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          <span>{availability.episodes_with_external} external</span>
        </div>
        <div className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          <span>{availability.episodes_with_embedded} embedded</span>
        </div>
      </div>
    </div>
  );
};