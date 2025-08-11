import React, { useMemo } from 'react';
import { ArrowRight, CheckCircle, AlertTriangle, XCircle, Settings } from 'lucide-react';
import type { SubtitleAnalysis, EpisodeConfig } from '../../types/bulk';
import type { DualSubtitleConfig } from '../../types';
import { COMPREHENSIVE_LANGUAGES } from '../../data/languages';
// import { DualSubtitleCreator } from '../DualSubtitleCreator';

interface EpisodePreviewStepProps {
  analysis: SubtitleAnalysis;
  primaryLanguage: string;
  secondaryLanguage: string;
  stylingConfig: DualSubtitleConfig;
  onStylingConfigChange: (config: DualSubtitleConfig) => void;
  onEpisodeConfigChange: (episodeId: string, config: EpisodeConfig) => void;
  episodeConfigs: Map<string, EpisodeConfig>;
  onStartProcessing: () => void;
}

export const EpisodePreviewStep: React.FC<EpisodePreviewStepProps> = ({
  analysis,
  primaryLanguage,
  secondaryLanguage,
  stylingConfig,
  onStylingConfigChange,
  onStartProcessing
}) => {
  // Calculate episode statistics
  const stats = useMemo(() => {
    const primaryAvail = analysis.language_availability[primaryLanguage];
    const secondaryAvail = analysis.language_availability[secondaryLanguage];
    
    if (!primaryAvail || !secondaryAvail) {
      return { ready: 0, needsAttention: 0, willSkip: analysis.total_episodes, alreadyExists: 0 };
    }

    // Find episodes that have both languages available
    const episodesWithBoth = primaryAvail.episode_details.filter(ep => 
      secondaryAvail.episode_details.some(secEp => secEp.episode_id === ep.episode_id)
    );

    // Check which episodes already have the requested dual subtitle combination
    const episodesWithExistingDual = episodesWithBoth.filter(ep => 
      ep.existing_dual_subtitles?.some((dualSub: any) => {
        if (!dualSub.dual_languages || dualSub.dual_languages.length < 2) return false;
        const [lang1, lang2] = dualSub.dual_languages;
        return (lang1 === primaryLanguage && lang2 === secondaryLanguage) ||
               (lang1 === secondaryLanguage && lang2 === primaryLanguage);
      })
    );

    const alreadyExists = episodesWithExistingDual.length;
    const ready = episodesWithBoth.length - alreadyExists; // Subtract existing dual subtitles
    const maxAvailable = Math.max(primaryAvail.episodes_available, secondaryAvail.episodes_available);
    const needsAttention = maxAvailable - episodesWithBoth.length;
    const willSkip = analysis.total_episodes - maxAvailable;

    return { ready, needsAttention, willSkip, alreadyExists };
  }, [analysis, primaryLanguage, secondaryLanguage]);

  const primaryLangName = COMPREHENSIVE_LANGUAGES.find(l => l.code === primaryLanguage)?.name || primaryLanguage;
  const secondaryLangName = COMPREHENSIVE_LANGUAGES.find(l => l.code === secondaryLanguage)?.name || secondaryLanguage;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-cream-500 mb-2">
          Episode Configuration
        </h3>
        <p className="text-mist-500">
          Creating {primaryLangName} + {secondaryLangName} dual subtitles
        </p>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center p-6 bg-success-500/10 border border-success-500/20 rounded-xl">
          <CheckCircle className="w-8 h-8 text-success-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-success-500 mb-1">
            {stats.ready}
          </div>
          <div className="text-success-500 text-sm">Episodes Ready</div>
          <p className="text-xs text-mist-500 mt-1">Both languages available</p>
        </div>

        {stats.needsAttention > 0 && (
          <div className="text-center p-6 bg-warning-500/10 border border-warning-500/20 rounded-xl">
            <AlertTriangle className="w-8 h-8 text-warning-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-warning-500 mb-1">
              {stats.needsAttention}
            </div>
            <div className="text-warning-500 text-sm">Need Attention</div>
            <p className="text-xs text-mist-500 mt-1">Missing one language</p>
          </div>
        )}

        {stats.alreadyExists > 0 && (
          <div className="text-center p-6 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <CheckCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-500 mb-1">
              {stats.alreadyExists}
            </div>
            <div className="text-blue-500 text-sm">Already Exists</div>
            <p className="text-xs text-mist-500 mt-1">Dual subtitles exist</p>
          </div>
        )}

        {stats.willSkip > 0 && (
          <div className="text-center p-6 bg-sage-500/10 border border-sage-500/20 rounded-xl">
            <XCircle className="w-8 h-8 text-sage-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-sage-500 mb-1">
              {stats.willSkip}
            </div>
            <div className="text-sage-500 text-sm">Will Skip</div>
            <p className="text-xs text-mist-500 mt-1">No subtitles available</p>
          </div>
        )}
      </div>

      {/* Processing Strategy */}
      <div className="bg-charcoal-400/30 rounded-xl p-6 border border-sage-500/20">
        <h4 className="flex items-center gap-2 text-lg font-semibold text-cream-500 mb-4">
          <Settings className="w-5 h-5" />
          Processing Strategy
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h5 className="font-medium text-cream-500 mb-2">Source Priority</h5>
            <div className="space-y-2 text-sm text-mist-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                <span>1. Use existing external subtitle files with fast sync</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-warning-500 rounded-full"></div>
                <span>2. Extract from embedded streams when needed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>3. Skip episodes with existing dual subtitles</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-sage-500 rounded-full"></div>
                <span>4. Skip episodes without required languages</span>
              </div>
            </div>
          </div>

          <div>
            <h5 className="font-medium text-cream-500 mb-2">Output Details</h5>
            <div className="space-y-2 text-sm text-mist-500">
              <div className="flex items-center justify-between">
                <span>Format:</span>
                <span className="text-cream-500 font-medium">{stylingConfig.output_format?.toUpperCase() || 'ASS'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Primary Position:</span>
                <span className="text-cream-500 font-medium">{stylingConfig.primary_position}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Secondary Position:</span>
                <span className="text-cream-500 font-medium">{stylingConfig.secondary_position}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Styling Configuration */}
        <div className="border-t border-sage-500/20 pt-6">
          <h5 className="font-medium text-cream-500 mb-4">Dual Subtitle Styling</h5>
          <div className="bg-charcoal-500 rounded-lg p-4 space-y-6">
            {/* Output Format Selection */}
            <div>
              <label className="block text-sm font-medium text-cream-500 mb-2">Output Format</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                    stylingConfig.output_format === 'ass' 
                      ? 'border-gold-500 bg-gold-500/10' 
                      : 'border-sage-500/30 hover:border-sage-500/50'
                  }`}
                  onClick={() => onStylingConfigChange({ ...stylingConfig, output_format: 'ass' })}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      stylingConfig.output_format === 'ass' ? 'border-gold-500 bg-gold-500' : 'border-mist-500'
                    }`} />
                    <h6 className="font-semibold text-cream-500">ASS Format (.ass) <span className="text-gold-500 text-xs">RECOMMENDED</span></h6>
                  </div>
                  <p className="text-sm text-mist-500">
                    Advanced styling with positioning control and better visual experience.
                  </p>
                </div>
                
                <div 
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                    stylingConfig.output_format === 'srt' 
                      ? 'border-gold-500 bg-gold-500/10' 
                      : 'border-sage-500/30 hover:border-sage-500/50'
                  }`}
                  onClick={() => onStylingConfigChange({ ...stylingConfig, output_format: 'srt' })}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      stylingConfig.output_format === 'srt' ? 'border-gold-500 bg-gold-500' : 'border-mist-500'
                    }`} />
                    <h6 className="font-semibold text-cream-500">SRT Format (.srt)</h6>
                  </div>
                  <p className="text-sm text-mist-500">
                    Simple format with language prefixes. Maximum compatibility.
                  </p>
                </div>
              </div>
            </div>

            {/* Advanced ASS Styling Options */}
            {stylingConfig.output_format === 'ass' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Primary Language Styling */}
                  <div className="space-y-4">
                    <h6 className="font-semibold text-cream-500 border-b border-sage-500/20 pb-2">
                      Primary Language ({primaryLangName})
                    </h6>

                    <div>
                      <label className="block text-sm font-medium text-cream-500 mb-2">Position</label>
                      <select
                        value={stylingConfig.primary_position}
                        onChange={(e) => onStylingConfigChange({ ...stylingConfig, primary_position: e.target.value as any })}
                        className="input-field w-full"
                      >
                        <option value="top">Upper (closer to center)</option>
                        <option value="bottom">Lower (closer to edge)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-cream-500 mb-2">Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={stylingConfig.primary_color}
                          onChange={(e) => onStylingConfigChange({ ...stylingConfig, primary_color: e.target.value })}
                          className="flex-shrink-0 cursor-pointer"
                          style={{ 
                            width: '48px',
                            height: '48px',
                            border: '2px solid rgba(74, 93, 79, 0.6)',
                            borderRadius: '8px',
                            padding: '0',
                            background: 'transparent',
                            outline: 'none',
                            minWidth: '48px'
                          }}
                        />
                        <input
                          type="text"
                          value={stylingConfig.primary_color}
                          onChange={(e) => onStylingConfigChange({ ...stylingConfig, primary_color: e.target.value })}
                          className="input-field flex-1 min-w-0"
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-cream-500 mb-2">
                        Font Size: {stylingConfig.primary_font_size}px
                      </label>
                      <input
                        type="range"
                        min="12"
                        max="48"
                        value={stylingConfig.primary_font_size}
                        onChange={(e) => onStylingConfigChange({ ...stylingConfig, primary_font_size: parseInt(e.target.value) })}
                        className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  </div>

                  {/* Secondary Language Styling */}
                  <div className="space-y-4">
                    <h6 className="font-semibold text-cream-500 border-b border-sage-500/20 pb-2">
                      Secondary Language ({secondaryLangName})
                    </h6>

                    <div>
                      <label className="block text-sm font-medium text-cream-500 mb-2">Position</label>
                      <select
                        value={stylingConfig.secondary_position}
                        onChange={(e) => onStylingConfigChange({ ...stylingConfig, secondary_position: e.target.value as any })}
                        className="input-field w-full"
                      >
                        <option value="top">Upper (closer to center)</option>
                        <option value="bottom">Lower (closer to edge)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-cream-500 mb-2">Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={stylingConfig.secondary_color}
                          onChange={(e) => onStylingConfigChange({ ...stylingConfig, secondary_color: e.target.value })}
                          className="flex-shrink-0 cursor-pointer"
                          style={{ 
                            width: '48px',
                            height: '48px',
                            border: '2px solid rgba(74, 93, 79, 0.6)',
                            borderRadius: '8px',
                            padding: '0',
                            background: 'transparent',
                            outline: 'none',
                            minWidth: '48px'
                          }}
                        />
                        <input
                          type="text"
                          value={stylingConfig.secondary_color}
                          onChange={(e) => onStylingConfigChange({ ...stylingConfig, secondary_color: e.target.value })}
                          className="input-field flex-1 min-w-0"
                          placeholder="#FFFF00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-cream-500 mb-2">
                        Font Size: {stylingConfig.secondary_font_size}px
                      </label>
                      <input
                        type="range"
                        min="12"
                        max="48"
                        value={stylingConfig.secondary_font_size}
                        onChange={(e) => onStylingConfigChange({ ...stylingConfig, secondary_font_size: parseInt(e.target.value) })}
                        className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Preview */}
                <div>
                  <h6 className="font-semibold text-cream-500 mb-3">Live Preview</h6>
                  <div className="bg-black rounded-lg p-8 min-h-32 relative overflow-hidden">
                    {/* Background to simulate video */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-600 opacity-30"></div>
                    
                    {/* Sample subtitles positioned as they would appear */}
                    <div className="relative h-full flex flex-col justify-end pb-4">
                      <div className="text-center space-y-1">
                        {/* Upper subtitle (closer to center) */}
                        <div 
                          style={{ 
                            color: stylingConfig.primary_position === 'top' ? stylingConfig.primary_color : stylingConfig.secondary_color, 
                            fontSize: `${stylingConfig.primary_position === 'top' ? stylingConfig.primary_font_size : stylingConfig.secondary_font_size}px`,
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                          }}
                          className="font-semibold"
                        >
                          {stylingConfig.primary_position === 'top' ? 'This is the primary subtitle' : 'This is the secondary subtitle'}
                        </div>
                        {/* Lower subtitle (closer to edge) */}
                        <div 
                          style={{ 
                            color: stylingConfig.primary_position === 'bottom' ? stylingConfig.primary_color : stylingConfig.secondary_color, 
                            fontSize: `${stylingConfig.primary_position === 'bottom' ? stylingConfig.primary_font_size : stylingConfig.secondary_font_size}px`,
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                          }}
                          className="font-semibold"
                        >
                          {stylingConfig.primary_position === 'bottom' ? 'This is the primary subtitle' : 'This is the secondary subtitle'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SRT Format Info */}
            {stylingConfig.output_format === 'srt' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h6 className="font-semibold text-cream-500 mb-2">SRT Format Preview</h6>
                <p className="text-mist-500 text-sm mb-3">
                  SRT format uses simple text prefixes to distinguish between languages:
                </p>
                <div className="bg-charcoal-600 rounded p-3 text-sm font-mono space-y-1">
                  <div className="text-cream-400">[{primaryLanguage.toUpperCase()}] This is the primary subtitle text</div>
                  <div className="text-cream-400">[{secondaryLanguage.toUpperCase()}] This is the secondary subtitle text</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end">
        <button
          onClick={onStartProcessing}
          className="btn-primary flex items-center gap-2"
          disabled={stats.ready === 0}
        >
          Start Processing {stats.ready} Episodes
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};