import axios from 'axios';
import type {
  ConnectionStatus,
  Library,
  Show,
  ShowDetail,
  Episode,
  EpisodeSubtitles,
  DualSubtitleConfig,
  DualSubtitleResult,
  SubtitlePreview,
  UploadResult,
  ExtractResult,
} from '../types';
import type { SubtitleAnalysis } from '../types/bulk';
import PlexAuthService from '../services/plexAuth';

// Dynamic API base - use current host with backend port
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:8000'  
  : `http://${window.location.hostname}:8000`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Add request interceptor to include Plex auth token
api.interceptors.request.use((config) => {
  try {
    const authHeaders = PlexAuthService.getAuthHeaders();
    config.headers = { ...config.headers, ...authHeaders };
  } catch (error) {
    // No auth token available - this is ok for some endpoints
    console.debug('No Plex auth token available');
  }
  return config;
});

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid, clear it
      PlexAuthService.logout();
      // You might want to redirect to login or show login modal here
      console.warn('Plex authentication expired');
    }
    return Promise.reject(error);
  }
);

// API Client
export const apiClient = {
  // Connection
  async getStatus(): Promise<ConnectionStatus> {
    const response = await api.get('/api/status');
    return response.data;
  },

  // Libraries
  async getLibraries(): Promise<{ libraries: Library[] }> {
    const response = await api.get('/api/libraries');
    return response.data;
  },

  // Shows
  async getShows(library?: string, limit?: number, fastMode: boolean = true): Promise<{ count: number; shows: Show[] }> {
    const params = new URLSearchParams();
    if (library) params.append('library', library);
    if (limit) params.append('limit', limit.toString());
    params.append('fast_mode', fastMode.toString());
    
    const response = await api.get(`/api/shows?${params.toString()}`);
    return response.data;
  },

  async getShowsWithLanguages(
    languages?: string[], 
    library?: string, 
    limit?: number
  ): Promise<{ count: number; shows: Show[]; requested_languages: string[] }> {
    const params = new URLSearchParams();
    if (languages && languages.length > 0) params.append('languages', languages.join(','));
    if (library) params.append('library', library);
    if (limit) params.append('limit', limit.toString());
    
    const response = await api.get(`/api/shows/with-languages?${params.toString()}`);
    return response.data;
  },

  async getShowCounts(showId: string): Promise<{ id: string; episode_count: number; season_count: number }> {
    const response = await api.get(`/api/shows/${showId}/counts`);
    return response.data;
  },

  async getShowDetail(showId: string): Promise<ShowDetail> {
    const response = await api.get(`/api/shows/${showId}`);
    return response.data;
  },

  // Episodes
  async getEpisodeDetail(episodeId: string): Promise<Episode> {
    const response = await api.get(`/api/episodes/${episodeId}`);
    return response.data;
  },

  async getEpisodeSubtitles(episodeId: string): Promise<EpisodeSubtitles> {
    const response = await api.get(`/api/episodes/${episodeId}/subtitles`);
    return response.data;
  },

  // Subtitle Operations
  async uploadSubtitle(
    episodeId: string,
    file: File,
    language: string
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);

    const response = await api.post(`/api/episodes/${episodeId}/subtitles/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async extractEmbeddedSubtitle(
    episodeId: string,
    streamIndex: number,
    languageCode: string,
    subtitleType: string
  ): Promise<ExtractResult> {
    const formData = new FormData();
    formData.append('stream_index', streamIndex.toString());
    formData.append('language_code', languageCode);
    formData.append('subtitle_type', subtitleType);

    const response = await api.post(`/api/episodes/${episodeId}/subtitles/extract-embedded`, formData);
    return response.data;
  },

  async previewDualSubtitle(config: {
    primary_subtitle: string;
    secondary_subtitle: string;
    primary_position: string;
    secondary_position: string;
    primary_color: string;
    secondary_color: string;
    primary_font_size: number;
    secondary_font_size: number;
    enable_sync?: boolean;
  }): Promise<SubtitlePreview> {
    const formData = new FormData();
    Object.entries(config).forEach(([key, value]) => {
      formData.append(key, value.toString());
    });

    const response = await api.post('/api/subtitles/dual/preview', formData);
    return response.data;
  },

  async createDualSubtitle(
    episodeId: string,
    config: DualSubtitleConfig & {
      primary_subtitle: string;
      secondary_subtitle: string;
      enable_sync?: boolean;
    }
  ): Promise<DualSubtitleResult> {
    const formData = new FormData();
    Object.entries(config).forEach(([key, value]) => {
      formData.append(key, value.toString());
    });

    const response = await api.post(`/api/episodes/${episodeId}/subtitles/dual`, formData);
    return response.data;
  },

  async createDualSubtitleWithTimeout(
    episodeId: string,
    config: DualSubtitleConfig & {
      primary_subtitle: string;
      secondary_subtitle: string;
      enable_sync?: boolean;
    },
    timeout: number = 180000 // 3 minutes default
  ): Promise<DualSubtitleResult> {
    const formData = new FormData();
    Object.entries(config).forEach(([key, value]) => {
      formData.append(key, value.toString());
    });

    const response = await api.post(`/api/episodes/${episodeId}/subtitles/dual`, formData, {
      timeout: timeout
    });
    return response.data;
  },

  async deleteSubtitle(filePath: string): Promise<{ success: boolean; message: string; backup: string }> {
    const response = await api.delete('/api/subtitles', {
      params: { file_path: filePath }
    });
    return response.data;
  },

  // Bulk Operations
  async getSubtitleAnalysis(showId: string): Promise<SubtitleAnalysis> {
    // Get show details to get all episodes
    const showDetail = await this.getShowDetail(showId);
    const episodes = showDetail.episodes;
    
    // Fetch subtitle data for all episodes
    const episodeSubtitlePromises = episodes.map(episode => 
      this.getEpisodeSubtitles(episode.id).catch(() => null) // Handle failures gracefully
    );
    
    const allEpisodeSubtitles = await Promise.all(episodeSubtitlePromises);
    
    // Aggregate language availability using Sets to track unique episodes
    const languageMap = new Map<string, {
      name: string;
      episodes_available: number;
      episodes_with_external: number;
      episodes_with_embedded: number;
      episode_details: Array<{
        episode_id: string;
        season_episode: string;
        title: string;
        has_external: boolean;
        has_embedded: boolean;
        existing_dual_subtitles?: Array<{
          file_path: string;
          file_name: string;
          dual_languages?: string[];
        }>;
        embedded_streams?: Array<{
          stream_index: number;
          language_code: string;
          display_name: string;
        }>;
      }>;
      _episode_ids: Set<string>; // Track unique episodes
      _external_episode_ids: Set<string>; // Track episodes with external subs
      _embedded_episode_ids: Set<string>; // Track episodes with embedded subs
    }>();
    
    // Process each episode's subtitle data
    episodes.forEach((episode, index) => {
      const subtitles = allEpisodeSubtitles[index];
      if (!subtitles) return;
      
      const episodeInfo = {
        episode_id: episode.id,
        season_episode: episode.season_episode,
        title: episode.title,
        has_external: false,
        has_embedded: false,
        embedded_streams: [] as Array<{
          stream_index: number;
          language_code: string;
          display_name: string;
        }>
      };
      
      // Track languages found in this episode to avoid duplicate episode_details
      const episodeLangSet = new Set<string>();
      
      // Check for existing dual subtitles
      const existingDualSubtitles = subtitles.external_subtitles?.filter(sub => sub.is_dual_subtitle) || [];
      episodeInfo.existing_dual_subtitles = existingDualSubtitles;
      
      // Process external subtitles
      if (subtitles.external_subtitles) {
        episodeInfo.has_external = subtitles.external_subtitles.length > 0;
        
        subtitles.external_subtitles.forEach(sub => {
          // Skip dual subtitles from regular language processing
          if (sub.is_dual_subtitle) return;
          
          const langCode = sub.language_code || 'unknown';
          
          if (!languageMap.has(langCode)) {
            languageMap.set(langCode, {
              name: this.getLanguageName(langCode),
              episodes_available: 0,
              episodes_with_external: 0,
              episodes_with_embedded: 0,
              episode_details: [],
              _episode_ids: new Set(),
              _external_episode_ids: new Set(),
              _embedded_episode_ids: new Set()
            });
          }
          
          const langData = languageMap.get(langCode)!;
          
          // Only add episode info once per language per episode
          if (!episodeLangSet.has(langCode)) {
            langData._episode_ids.add(episode.id);
            langData._external_episode_ids.add(episode.id);
            langData.episode_details.push(episodeInfo);
            episodeLangSet.add(langCode);
          }
        });
      }
      
      // Process embedded subtitles
      if (subtitles.embedded_subtitles) {
        episodeInfo.has_embedded = subtitles.embedded_subtitles.length > 0;
        
        subtitles.embedded_subtitles.forEach(sub => {
          const langCode = sub.languageCode || 'unknown';
          
          episodeInfo.embedded_streams!.push({
            stream_index: sub.stream_index,
            language_code: langCode,
            display_name: sub.display_name
          });
          
          if (!languageMap.has(langCode)) {
            languageMap.set(langCode, {
              name: this.getLanguageName(langCode),
              episodes_available: 0,
              episodes_with_external: 0,
              episodes_with_embedded: 0,
              episode_details: [],
              _episode_ids: new Set(),
              _external_episode_ids: new Set(),
              _embedded_episode_ids: new Set()
            });
          }
          
          const langData = languageMap.get(langCode)!;
          
          // Only add episode info once per language per episode
          if (!episodeLangSet.has(langCode)) {
            langData._episode_ids.add(episode.id);
            langData._embedded_episode_ids.add(episode.id);
            langData.episode_details.push(episodeInfo);
            episodeLangSet.add(langCode);
          } else {
            // Episode already tracked for this language, but update embedded episode set
            langData._embedded_episode_ids.add(episode.id);
          }
        });
      }
    });
    
    // Convert Sets to counts
    languageMap.forEach((langData) => {
      langData.episodes_available = langData._episode_ids.size;
      langData.episodes_with_external = langData._external_episode_ids.size;
      langData.episodes_with_embedded = langData._embedded_episode_ids.size;
      // Clean up the temporary Sets
      delete (langData as any)._episode_ids;
      delete (langData as any)._external_episode_ids;
      delete (langData as any)._embedded_episode_ids;
    });
    
    // Convert map to object
    const language_availability: { [key: string]: any } = {};
    languageMap.forEach((value, key) => {
      language_availability[key] = value;
    });
    
    return {
      total_episodes: episodes.length,
      language_availability
    };
  },
  
  // Bulk dual subtitle creation
  async processBulkDualSubtitles(
    showId: string,
    primaryLanguage: string, 
    secondaryLanguage: string,
    stylingConfig: DualSubtitleConfig,
    episodeConfigs: Map<string, any>,
    onProgress?: (progress: { 
      processed: number; 
      total: number; 
      currentEpisode?: string; 
      estimatedTimeRemaining?: string;
      averageTimePerEpisode?: number;
    }) => void
  ): Promise<{ successful: any[]; failed: any[]; skipped: any[] }> {
    const analysis = await this.getSubtitleAnalysis(showId);
    const primaryAvail = analysis.language_availability[primaryLanguage];
    const secondaryAvail = analysis.language_availability[secondaryLanguage];
    
    if (!primaryAvail || !secondaryAvail) {
      throw new Error('Selected languages not available in this show');
    }

    // Find episodes that have both languages available
    const episodesWithBoth = primaryAvail.episode_details.filter(ep => 
      secondaryAvail.episode_details.some(secEp => secEp.episode_id === ep.episode_id)
    );

    // Filter out episodes that already have the requested dual subtitle combination
    const episodesToProcess = episodesWithBoth.filter(ep => {
      if (!ep.existing_dual_subtitles) return true;
      
      return !ep.existing_dual_subtitles.some((dualSub: any) => {
        if (!dualSub.dual_languages || dualSub.dual_languages.length < 2) return false;
        const [lang1, lang2] = dualSub.dual_languages;
        return (lang1 === primaryLanguage && lang2 === secondaryLanguage) ||
               (lang1 === secondaryLanguage && lang2 === primaryLanguage);
      });
    });

    const results = {
      successful: [] as any[],
      failed: [] as any[],
      skipped: [] as any[]
    };

    const total = episodesToProcess.length;
    const episodeTimes: number[] = [];
    const startTime = Date.now();
    
    for (let i = 0; i < episodesToProcess.length; i++) {
      const episode = episodesToProcess[i];
      const episodeStartTime = Date.now();
      
      // Calculate time estimates
      const averageTimePerEpisode = episodeTimes.length > 0 
        ? episodeTimes.reduce((a, b) => a + b, 0) / episodeTimes.length 
        : 45000; // Default estimate: 45 seconds per episode
      
      const remainingEpisodes = total - i;
      const estimatedRemainingMs = remainingEpisodes * averageTimePerEpisode;
      const estimatedTimeRemaining = this.formatTimeRemaining(estimatedRemainingMs);
      
      if (onProgress) {
        onProgress({ 
          processed: i, 
          total, 
          currentEpisode: `${episode.season_episode}: ${episode.title}`,
          estimatedTimeRemaining,
          averageTimePerEpisode: Math.round(averageTimePerEpisode / 1000)
        });
      }

      try {
        // Find suitable subtitle files for this episode
        const episodeSubtitles = await this.getEpisodeSubtitles(episode.episode_id);
        
        // Find primary language subtitle
        const primarySub = episodeSubtitles.external_subtitles?.find(sub => 
          sub.language_code === primaryLanguage
        );
        
        // Find secondary language subtitle  
        const secondarySub = episodeSubtitles.external_subtitles?.find(sub =>
          sub.language_code === secondaryLanguage
        );

        if (!primarySub || !secondarySub) {
          // Try embedded subtitles if external not found
          const primaryEmbedded = episodeSubtitles.embedded_subtitles?.find(sub =>
            sub.languageCode === primaryLanguage
          );
          const secondaryEmbedded = episodeSubtitles.embedded_subtitles?.find(sub =>
            sub.languageCode === secondaryLanguage
          );

          if (!primarySub && !primaryEmbedded) {
            results.skipped.push({
              episode_id: episode.episode_id,
              reason: `Missing ${primaryLanguage} subtitle`
            });
            continue;
          }

          if (!secondarySub && !secondaryEmbedded) {
            results.skipped.push({
              episode_id: episode.episode_id,
              reason: `Missing ${secondaryLanguage} subtitle`
            });
            continue;
          }
        }

        // Create dual subtitle using existing API with optimized sync settings
        const config = {
          ...stylingConfig,
          primary_subtitle: primarySub?.file_path || `embedded:${episodeSubtitles.embedded_subtitles?.find(s => s.languageCode === primaryLanguage)?.stream_index}`,
          secondary_subtitle: secondarySub?.file_path || `embedded:${episodeSubtitles.embedded_subtitles?.find(s => s.languageCode === secondaryLanguage)?.stream_index}`,
          enable_sync: true, // Re-enable sync with optimizations
          sync_method: 'auto', // Use auto method selection with fallbacks
          bulk_mode: true // Flag for optimized bulk processing
        };

        // Use extended timeout for bulk sync operations (4 minutes per episode)
        const result = await this.createDualSubtitleWithTimeout(episode.episode_id, config, 240000);
        
        // Track timing for estimates
        const episodeEndTime = Date.now();
        const episodeDuration = episodeEndTime - episodeStartTime;
        episodeTimes.push(episodeDuration);
        
        results.successful.push({
          episode_id: episode.episode_id,
          output_file: result.output_file,
          episode_title: episode.title
        });

      } catch (error: any) {
        let errorMessage = error.message || 'Unknown error';
        
        // Handle specific error types
        if (error.code === 'ECONNABORTED' || errorMessage.includes('timeout')) {
          errorMessage = 'Processing timeout (subtitle creation takes longer than expected)';
        } else if (error.response?.status === 500) {
          errorMessage = error.response?.data?.detail || 'Server error during subtitle creation';
        } else if (error.response?.status === 404) {
          errorMessage = 'Episode or subtitle files not found';
        }
        
        results.failed.push({
          episode_id: episode.episode_id,
          error: errorMessage,
          episode_title: episode.title
        });
      }
    }

    if (onProgress) {
      onProgress({ processed: total, total });
    }

    return results;
  },

  // Helper method to format time remaining
  formatTimeRemaining(ms: number): string {
    const seconds = Math.round(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  },

  // Helper method to check if episode already has requested dual subtitle combination
  episodeHasDualSubtitle(episode: any, primaryLang: string, secondaryLang: string): boolean {
    if (!episode.existing_dual_subtitles) return false;
    
    return episode.existing_dual_subtitles.some((dualSub: any) => {
      if (!dualSub.dual_languages || dualSub.dual_languages.length < 2) return false;
      
      const [lang1, lang2] = dualSub.dual_languages;
      // Check both orders since dual subtitles can be created in either order
      return (lang1 === primaryLang && lang2 === secondaryLang) ||
             (lang1 === secondaryLang && lang2 === primaryLang);
    });
  },
  
  // Helper method to get language name from code
  getLanguageName(code: string): string {
    // Common language mappings
    const languages: { [key: string]: string } = {
      'en': 'English',
      'ja': 'Japanese', 
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ko': 'Korean',
      'zh': 'Chinese',
      'zho': 'Chinese',
      'spa': 'Spanish',
      'ar': 'Arabic',
      'unknown': 'Unknown',
      // Chinese variants
      'zh-TW': 'Chinese (Traditional)',
      'zh-HK': 'Chinese (Hong Kong)',
      'zh-CN': 'Chinese (Simplified)',
      'zh-SG': 'Chinese (Singapore)'
    };
    
    // Handle common subtitle variant suffixes that get misidentified as language codes
    if (code === 'hi') {
      return 'Hearing Impaired'; // Likely .zh.hi.srt or similar pattern
    }
    
    return languages[code] || code.toUpperCase();
  },
};

export default apiClient;