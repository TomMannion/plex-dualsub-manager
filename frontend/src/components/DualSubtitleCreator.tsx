import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Palette, Maximize2, Eye, Loader, Check, AlertCircle } from 'lucide-react';
import { apiClient } from '../lib/api';
import type { ExternalSubtitle, DualSubtitleConfig } from '../types';

interface DualSubtitleCreatorProps {
  episodeId: string;
  subtitles: ExternalSubtitle[];
  onCreated?: () => void;
}

export const DualSubtitleCreator: React.FC<DualSubtitleCreatorProps> = ({
  episodeId,
  subtitles,
  onCreated
}) => {
  const [config, setConfig] = useState<DualSubtitleConfig & {
    primary_subtitle: string;
    secondary_subtitle: string;
    output_format: string;
    enable_sync: boolean;
  }>({
    primary_subtitle: '',
    secondary_subtitle: '',
    primary_position: 'bottom',
    secondary_position: 'top',
    primary_color: '#FFFFFF',
    secondary_color: '#FFFF00',
    primary_font_size: 22,
    secondary_font_size: 18,
    output_format: 'ass',
    enable_sync: true,
  });

  const [previewData, setPreviewData] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Mutation for creating dual subtitle
  const createMutation = useMutation({
    mutationFn: () => apiClient.createDualSubtitle(episodeId, config),
    onSuccess: () => {
      onCreated?.();
    },
  });

  // Mutation for preview
  const previewMutation = useMutation({
    mutationFn: () => apiClient.previewDualSubtitle(config),
    onSuccess: (data) => {
      setPreviewData(data);
      setShowPreview(true);
    },
  });

  const handlePreview = () => {
    if (!config.primary_subtitle || !config.secondary_subtitle) {
      console.log('Cannot preview: missing subtitle files');
      return;
    }
    console.log('Preview config:', config);
    previewMutation.mutate();
  };

  const handleCreate = () => {
    if (!config.primary_subtitle || !config.secondary_subtitle) {
      return;
    }
    createMutation.mutate();
  };

  const canProceed = config.primary_subtitle && config.secondary_subtitle && 
                    config.primary_subtitle !== config.secondary_subtitle;

  return (
    <div className="space-y-6">
      {/* Subtitle Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Primary Subtitle */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-plex-gray-200">
            Primary Subtitle (Main)
          </label>
          <select
            value={config.primary_subtitle}
            onChange={(e) => setConfig({ ...config, primary_subtitle: e.target.value })}
            className="input-field w-full"
          >
            <option value="">Select primary subtitle...</option>
            {subtitles.map((sub, index) => (
              <option key={index} value={sub.file_path}>
                {sub.file_name} ({sub.language_code || 'unknown'})
              </option>
            ))}
          </select>
        </div>

        {/* Secondary Subtitle */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-plex-gray-200">
            Secondary Subtitle (Overlay)
          </label>
          <select
            value={config.secondary_subtitle}
            onChange={(e) => setConfig({ ...config, secondary_subtitle: e.target.value })}
            className="input-field w-full"
          >
            <option value="">Select secondary subtitle...</option>
            {subtitles
              .filter((sub) => sub.file_path !== config.primary_subtitle)
              .map((sub, index) => (
                <option key={index} value={sub.file_path}>
                  {sub.file_name} ({sub.language_code || 'unknown'})
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Output Format Selection */}
      {canProceed && (
        <div className="border-t border-plex-gray-600 pt-6">
          <h4 className="text-lg font-semibold text-plex-gray-100 mb-4">Output Format</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                config.output_format === 'ass' 
                  ? 'border-plex-orange bg-plex-orange/10' 
                  : 'border-plex-gray-600 hover:border-plex-gray-500'
              }`}
              onClick={() => setConfig({ ...config, output_format: 'ass' })}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  config.output_format === 'ass' ? 'border-plex-orange bg-plex-orange' : 'border-plex-gray-500'
                }`} />
                <h5 className="font-semibold text-plex-gray-100">ASS Format (.ass) <span className="text-plex-orange text-xs">RECOMMENDED</span></h5>
              </div>
              <p className="text-sm text-plex-gray-400">
                Advanced styling with automatic language detection, CJK font optimization, and perfect positioning. Best visual experience.
              </p>
            </div>
            
            <div 
              className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                config.output_format === 'srt' 
                  ? 'border-plex-orange bg-plex-orange/10' 
                  : 'border-plex-gray-600 hover:border-plex-gray-500'
              }`}
              onClick={() => setConfig({ ...config, output_format: 'srt' })}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  config.output_format === 'srt' ? 'border-plex-orange bg-plex-orange' : 'border-plex-gray-500'
                }`} />
                <h5 className="font-semibold text-plex-gray-100">SRT Format (.srt)</h5>
              </div>
              <p className="text-sm text-plex-gray-400">
                Simple format with language prefixes (e.g., [EN], [JA]). Maximum compatibility with all players.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Synchronization Option */}
      {canProceed && (
        <div className="border-t border-plex-gray-600 pt-6">
          <h4 className="text-lg font-semibold text-plex-gray-100 mb-4">Synchronization</h4>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enable-sync"
              checked={config.enable_sync}
              onChange={(e) => setConfig({ ...config, enable_sync: e.target.checked })}
              className="w-4 h-4 text-plex-orange bg-plex-gray-700 border-plex-gray-600 rounded focus:ring-plex-orange focus:ring-2"
            />
            <label htmlFor="enable-sync" className="text-plex-gray-200">
              <span className="font-medium">Auto-sync secondary subtitle to primary</span>
              <span className="text-plex-orange ml-2">RECOMMENDED</span>
            </label>
          </div>
          <p className="text-sm text-plex-gray-400 mt-2 ml-7">
            Uses ffsubsync to automatically align subtitle timing. Helps fix sync issues when subtitles are out of time with each other.
          </p>
        </div>
      )}

      {/* Configuration Options */}
      {canProceed && config.output_format === 'ass' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Primary Subtitle Config */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-plex-gray-100 flex items-center gap-2">
              <Palette className="w-5 h-5 text-plex-orange" />
              Primary Subtitle Style
            </h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-plex-gray-200 mb-2">
                  Stack Position
                </label>
                <select
                  value={config.primary_position}
                  onChange={(e) => setConfig({ ...config, primary_position: e.target.value as any })}
                  className="input-field w-full"
                >
                  <option value="top">Upper (closer to center)</option>
                  <option value="bottom">Lower (closer to edge)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-plex-gray-200 mb-2">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.primary_color}
                    onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                    className="w-12 h-10 rounded border border-plex-gray-600 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.primary_color}
                    onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                    className="input-field flex-1"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-plex-gray-200 mb-2">
                  Font Size: {config.primary_font_size}px
                </label>
                <input
                  type="range"
                  min="12"
                  max="48"
                  value={config.primary_font_size}
                  onChange={(e) => setConfig({ ...config, primary_font_size: parseInt(e.target.value) })}
                  className="w-full h-2 bg-plex-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          </div>

          {/* Secondary Subtitle Config */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-plex-gray-100 flex items-center gap-2">
              <Maximize2 className="w-5 h-5 text-plex-orange" />
              Secondary Subtitle Style
            </h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-plex-gray-200 mb-2">
                  Stack Position
                </label>
                <select
                  value={config.secondary_position}
                  onChange={(e) => setConfig({ ...config, secondary_position: e.target.value as any })}
                  className="input-field w-full"
                >
                  <option value="top">Upper (closer to center)</option>
                  <option value="bottom">Lower (closer to edge)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-plex-gray-200 mb-2">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.secondary_color}
                    onChange={(e) => setConfig({ ...config, secondary_color: e.target.value })}
                    className="w-12 h-10 rounded border border-plex-gray-600 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.secondary_color}
                    onChange={(e) => setConfig({ ...config, secondary_color: e.target.value })}
                    className="input-field flex-1"
                    placeholder="#FFFF00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-plex-gray-200 mb-2">
                  Font Size: {config.secondary_font_size}px
                </label>
                <input
                  type="range"
                  min="12"
                  max="48"
                  value={config.secondary_font_size}
                  onChange={(e) => setConfig({ ...config, secondary_font_size: parseInt(e.target.value) })}
                  className="w-full h-2 bg-plex-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SRT Format Info */}
      {canProceed && config.output_format === 'srt' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-plex-gray-100 mb-2">SRT Format</h4>
          <p className="text-plex-gray-300 text-sm">
            SRT format uses simple text prefixes to distinguish between languages. Your subtitles will appear like:
          </p>
          <div className="mt-3 bg-plex-gray-700 rounded p-3 text-sm font-mono">
            <div className="text-plex-gray-200">[EN] This is the primary subtitle text</div>
            <div className="text-plex-gray-200">[JA] これはセカンダリー字幕のテキストです</div>
          </div>
        </div>
      )}

      {/* Live Preview */}
      {canProceed && (
        <div className="border-t border-plex-gray-600 pt-6">
          <h4 className="text-lg font-semibold text-plex-gray-100 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-plex-orange" />
            Live Style Preview
          </h4>
          
          <div className="bg-black rounded-lg p-8 min-h-32 relative overflow-hidden">
            {/* Background to simulate video */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-600 opacity-30"></div>
            
            {/* Sample subtitles positioned as they would appear */}
            <div className="relative h-full flex flex-col justify-end pb-4">
              {config.output_format === 'ass' ? (
                <>
                  {/* ASS Format - Stacked at bottom */}
                  <div className="text-center space-y-1">
                    {/* Upper subtitle in stack (closer to center) */}
                    {config.primary_position === 'top' ? (
                      <div 
                        style={{ 
                          color: config.primary_color, 
                          fontSize: `${config.primary_font_size}px`,
                          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                        }}
                        className="font-semibold"
                      >
                        This is the primary subtitle text
                      </div>
                    ) : config.secondary_position === 'top' ? (
                      <div 
                        style={{ 
                          color: config.secondary_color, 
                          fontSize: `${config.secondary_font_size}px`,
                          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                        }}
                        className="font-semibold"
                      >
                        This is the secondary subtitle text
                      </div>
                    ) : null}

                    {/* Lower subtitle in stack */}
                    {config.primary_position === 'bottom' ? (
                      <div 
                        style={{ 
                          color: config.primary_color, 
                          fontSize: `${config.primary_font_size}px`,
                          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                        }}
                        className="font-semibold"
                      >
                        This is the primary subtitle text
                      </div>
                    ) : config.secondary_position === 'bottom' ? (
                      <div 
                        style={{ 
                          color: config.secondary_color, 
                          fontSize: `${config.secondary_font_size}px`,
                          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                        }}
                        className="font-semibold"
                      >
                        This is the secondary subtitle text
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  {/* SRT Format - Combined with prefixes */}
                  <div className="invisible">Spacer</div>
                  <div className="text-center space-y-1">
                    <div 
                      className="font-semibold text-white"
                      style={{ 
                        fontSize: '18px',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                      }}
                    >
                      [EN] This is the primary subtitle text
                    </div>
                    <div 
                      className="font-semibold text-white"
                      style={{ 
                        fontSize: '18px',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                      }}
                    >
                      [JA] これはセカンダリー字幕のテキストです
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Settings info overlay */}
            <div className="absolute bottom-2 right-2 text-xs text-white/60 bg-black/40 rounded px-2 py-1">
              {config.output_format === 'ass' 
                ? `Primary: ${config.primary_position} • Secondary: ${config.secondary_position} • ASS Format`
                : 'SRT Format with language prefixes'
              }
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {canProceed && (
        <div className="flex items-center gap-4 pt-4 border-t border-plex-gray-600">
          <button
            onClick={handlePreview}
            disabled={previewMutation.isPending}
            className="btn-secondary flex items-center gap-2"
          >
            {previewMutation.isPending ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Preview with Real Content
          </button>

          <button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {createMutation.isPending ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Create Dual Subtitle
          </button>
        </div>
      )}

      {/* Error Messages */}
      {(createMutation.error || previewMutation.error) && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-medium">Error</p>
            <p className="text-red-200 text-sm">
              {createMutation.error?.message || previewMutation.error?.message}
            </p>
            {/* Debug info */}
            <details className="mt-2">
              <summary className="text-xs text-red-400 cursor-pointer">Debug Info</summary>
              <pre className="text-xs text-red-300 mt-1 whitespace-pre-wrap">
                {JSON.stringify(createMutation.error || previewMutation.error, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}

      {/* Success Message */}
      {createMutation.isSuccess && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-green-300 font-medium">Success!</p>
            <p className="text-green-200 text-sm">
              Dual subtitle created successfully. The new file has been saved to your media directory.
            </p>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div 
            className="bg-plex-gray-800 rounded-lg max-w-4xl max-h-[80vh] w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-plex-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-plex-gray-100">Subtitle Preview</h3>
                <p className="text-plex-gray-400 text-sm mt-1">
                  Preview of the first few subtitle entries
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-plex-gray-400 hover:text-plex-gray-200 transition-colors p-2"
                title="Close preview"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-96">
              <div className="space-y-6">
                {/* Primary Subtitles */}
                <div>
                  <h4 className="text-lg font-semibold text-plex-gray-100 mb-3 flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: previewData.config?.primary_color || '#ffffff' }}
                    />
                    Primary Subtitle ({previewData.config?.primary_position})
                  </h4>
                  <div className="space-y-2">
                    {previewData.primary?.map((line: any, index: number) => (
                      <div key={index} className="bg-plex-gray-700 rounded p-3">
                        <div className="text-xs text-plex-gray-400 mb-1">{line.time}</div>
                        <div className="text-sm text-plex-gray-200">{line.text}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Secondary Subtitles */}
                <div>
                  <h4 className="text-lg font-semibold text-plex-gray-100 mb-3 flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: previewData.config?.secondary_color || '#ffff00' }}
                    />
                    Secondary Subtitle ({previewData.config?.secondary_position})
                  </h4>
                  <div className="space-y-2">
                    {previewData.secondary?.map((line: any, index: number) => (
                      <div key={index} className="bg-plex-gray-700 rounded p-3">
                        <div className="text-xs text-plex-gray-400 mb-1">{line.time}</div>
                        <div className="text-sm text-plex-gray-200">{line.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-plex-gray-700 flex justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};