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

const API_BASE = 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

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

  async deleteSubtitle(filePath: string): Promise<{ success: boolean; message: string; backup: string }> {
    const response = await api.delete('/api/subtitles', {
      params: { file_path: filePath }
    });
    return response.data;
  },
};

export default apiClient;