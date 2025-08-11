import type { DualSubtitleConfig } from './index';

export interface EpisodeSubtitleInfo {
  episode_id: string;
  season_episode: string;
  title: string;
  has_external: boolean;
  has_embedded: boolean;
  embedded_streams?: Array<{
    stream_index: number;
    language_code: string;
    display_name: string;
  }>;
}

export interface LanguageAvailability {
  name: string;
  episodes_available: number;
  episodes_with_external: number;
  episodes_with_embedded: number;
  episode_details: EpisodeSubtitleInfo[];
}

export interface SubtitleAnalysis {
  total_episodes: number;
  language_availability: {
    [languageCode: string]: LanguageAvailability;
  };
}

export interface EpisodeConfig {
  episode_id: string;
  primary_source: 'external' | 'embedded';
  secondary_source: 'external' | 'embedded';
  primary_stream_index?: number;
  secondary_stream_index?: number;
  skip?: boolean;
}

export interface BulkDualSubtitleRequest {
  primary_language: string;
  secondary_language: string;
  styling_config: DualSubtitleConfig;
  episode_selections: EpisodeConfig[];
}

export interface BulkDualSubtitleResponse {
  job_id: string;
  estimated_duration: number;
}

export interface JobProgress {
  total_episodes: number;
  completed_episodes: number;
  current_episode?: string;
  estimated_remaining: number;
}

export interface JobResults {
  successful: Array<{
    episode_id: string;
    output_file: string;
  }>;
  failed: Array<{
    episode_id: string;
    error: string;
  }>;
  skipped: Array<{
    episode_id: string;
    reason: string;
  }>;
}

export interface JobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: JobProgress;
  results?: JobResults;
}

export type WizardStep = 'discovery' | 'preview' | 'processing' | 'results';