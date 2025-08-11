import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Languages, Loader, ArrowRight } from 'lucide-react';
import { apiClient } from '../../lib/api';
import type { SubtitleAnalysis } from '../../types/bulk';
import { LanguageAvailabilityCard } from './LanguageAvailabilityCard';
import { COMPREHENSIVE_LANGUAGES } from '../../data/languages';

interface LanguageDiscoveryStepProps {
  showId: string;
  analysis: SubtitleAnalysis | null;
  onAnalysisLoad: (analysis: SubtitleAnalysis) => void;
  onLanguageSelect: (primary: string, secondary: string) => void;
  selectedPrimary?: string;
  selectedSecondary?: string;
}

export const LanguageDiscoveryStep: React.FC<LanguageDiscoveryStepProps> = ({
  showId,
  analysis,
  onAnalysisLoad,
  onLanguageSelect,
  selectedPrimary = '',
  selectedSecondary = ''
}) => {
  const [primaryLanguage, setPrimaryLanguage] = useState(selectedPrimary);
  const [secondaryLanguage, setSecondaryLanguage] = useState(selectedSecondary);
  // const [languageSearchTerm, setLanguageSearchTerm] = useState('');

  // Fetch subtitle analysis for the show
  const { data: analysisData, isLoading, error } = useQuery({
    queryKey: ['subtitle-analysis', showId],
    queryFn: () => apiClient.getSubtitleAnalysis(showId),
    enabled: !analysis, // Only fetch if we don't already have analysis
    staleTime: 0, // Always refetch to get updated language mappings
    cacheTime: 0, // Don't cache for long
  });

  useEffect(() => {
    if (analysisData && !analysis) {
      onAnalysisLoad(analysisData);
    }
  }, [analysisData, analysis, onAnalysisLoad]);

  // Get sorted languages by availability
  const sortedLanguages = analysis ? 
    Object.entries(analysis.language_availability)
      .sort(([, a], [, b]) => b.episodes_available - a.episodes_available)
      .slice(0, 6) // Show top 6 most available languages
    : [];

  // Auto-select most common languages if none selected
  useEffect(() => {
    if (sortedLanguages.length >= 2 && !primaryLanguage && !secondaryLanguage) {
      const [firstLang] = sortedLanguages[0];
      const [secondLang] = sortedLanguages[1];
      setPrimaryLanguage(firstLang);
      setSecondaryLanguage(secondLang);
    }
  }, [sortedLanguages, primaryLanguage, secondaryLanguage]);

  const handleContinue = () => {
    if (primaryLanguage && secondaryLanguage && primaryLanguage !== secondaryLanguage) {
      onLanguageSelect(primaryLanguage, secondaryLanguage);
    }
  };

  const canContinue = primaryLanguage && 
                     secondaryLanguage && 
                     primaryLanguage !== secondaryLanguage &&
                     analysis?.language_availability[primaryLanguage] &&
                     analysis?.language_availability[secondaryLanguage];

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <Loader className="w-8 h-8 text-gold-500 animate-spin" />
        </div>
        <h3 className="text-xl font-semibold text-cream-500 mb-2">
          Analyzing Subtitle Availability
        </h3>
        <p className="text-mist-500">
          Scanning episodes for available languages...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-error-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Languages className="w-8 h-8 text-error-500" />
        </div>
        <h3 className="text-xl font-semibold text-cream-500 mb-2">
          Analysis Failed
        </h3>
        <p className="text-mist-500 mb-4">
          Unable to analyze subtitle availability for this show.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const previewData = primaryLanguage && secondaryLanguage ? {
    primary: analysis.language_availability[primaryLanguage],
    secondary: analysis.language_availability[secondaryLanguage],
    compatible: Math.min(
      analysis.language_availability[primaryLanguage]?.episodes_available || 0,
      analysis.language_availability[secondaryLanguage]?.episodes_available || 0
    )
  } : null;

  return (
    <div className="p-6 space-y-6">
      {/* Analysis Summary */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Languages className="w-8 h-8 text-gold-500" />
          <h3 className="text-2xl font-semibold text-cream-500">
            Found {Object.keys(analysis.language_availability).length} Languages
          </h3>
        </div>
        <p className="text-mist-500">
          Analyzed {analysis.total_episodes} episodes
        </p>
      </div>

      {/* Most Available Languages */}
      <div>
        <h4 className="text-lg font-semibold text-cream-500 mb-4">
          Most Available Languages
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {sortedLanguages.map(([languageCode, availability]) => (
            <LanguageAvailabilityCard
              key={languageCode}
              languageCode={languageCode}
              availability={availability}
              totalEpisodes={analysis.total_episodes}
            />
          ))}
        </div>
      </div>

      {/* Language Selection */}
      <div className="border-t border-sage-500/20 pt-6">
        <h4 className="text-lg font-semibold text-cream-500 mb-4">
          Select Languages for Dual Subtitles
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Primary Language */}
          <div>
            <label className="block text-sm font-medium text-cream-500 mb-2">
              Primary Language (Main)
            </label>
            <select
              value={primaryLanguage}
              onChange={(e) => setPrimaryLanguage(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Select primary language...</option>
              {Object.entries(analysis.language_availability).map(([code, avail]) => {
                const language = COMPREHENSIVE_LANGUAGES.find(l => l.code === code);
                return (
                  <option key={code} value={code}>
                    {language?.name || code} ({avail.episodes_available}/{analysis.total_episodes} episodes)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Secondary Language */}
          <div>
            <label className="block text-sm font-medium text-cream-500 mb-2">
              Secondary Language (Overlay)
            </label>
            <select
              value={secondaryLanguage}
              onChange={(e) => setSecondaryLanguage(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Select secondary language...</option>
              {Object.entries(analysis.language_availability)
                .filter(([code]) => code !== primaryLanguage)
                .map(([code, avail]) => {
                  const language = COMPREHENSIVE_LANGUAGES.find(l => l.code === code);
                  return (
                    <option key={code} value={code}>
                      {language?.name || code} ({avail.episodes_available}/{analysis.total_episodes} episodes)
                    </option>
                  );
                })}
            </select>
          </div>
        </div>

        {/* Preview Results */}
        {previewData && (
          <div className="bg-gold-500/10 border border-gold-500/20 rounded-xl p-6 mb-6">
            <h5 className="font-semibold text-cream-500 mb-3">Preview Results</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-4 bg-success-500/10 border border-success-500/20 rounded-lg">
                <div className="text-2xl font-bold text-success-500 mb-1">
                  {previewData.compatible}
                </div>
                <div className="text-success-500">Episodes Ready</div>
              </div>
              <div className="text-center p-4 bg-warning-500/10 border border-warning-500/20 rounded-lg">
                <div className="text-2xl font-bold text-warning-500 mb-1">
                  {Math.max(previewData.primary.episodes_available, previewData.secondary.episodes_available) - previewData.compatible}
                </div>
                <div className="text-warning-500">Need Attention</div>
              </div>
              <div className="text-center p-4 bg-sage-500/10 border border-sage-500/20 rounded-lg">
                <div className="text-2xl font-bold text-sage-500 mb-1">
                  {analysis.total_episodes - Math.max(previewData.primary.episodes_available, previewData.secondary.episodes_available)}
                </div>
                <div className="text-sage-500">Will Skip</div>
              </div>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Configuration
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};