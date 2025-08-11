import React, { useEffect, useState } from 'react';
import { Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import type { EpisodeConfig, JobStatus } from '../../types/bulk';
import type { DualSubtitleConfig } from '../../types';
import { apiClient } from '../../lib/api';
import axios from 'axios';

interface ProcessingStepProps {
  showId: string;
  showTitle: string;
  primaryLanguage: string;
  secondaryLanguage: string;
  stylingConfig: DualSubtitleConfig;
  episodeConfigs: Map<string, EpisodeConfig>;
  onComplete: (results: JobStatus['results']) => void;
  onJobIdReceived: (jobId: string) => void;
}

export const ProcessingStep: React.FC<ProcessingStepProps> = ({
  showId,
  showTitle,
  primaryLanguage,
  secondaryLanguage,
  stylingConfig,
  episodeConfigs,
  onComplete,
  onJobIdReceived
}) => {
  const [progress, setProgress] = useState(0);
  const [currentEpisode, setCurrentEpisode] = useState<string>('');
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  const [averageTime, setAverageTime] = useState<number>(45);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Start background job and monitor its progress
  useEffect(() => {
    
    const startBackgroundJob = async () => {
      try {
        setIsProcessing(true);
        setError(null);
        
        // Create background job
        const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000'  
          : `http://${window.location.hostname}:8000`;
        
        const plexToken = localStorage.getItem('plexAuthToken');
        console.log('DEBUG: Plex token from localStorage:', plexToken ? plexToken.substring(0, 20) + '...' : 'None');
        console.log('DEBUG: All localStorage keys:', Object.keys(localStorage));
        
        const jobResponse = await axios.post(`${API_BASE}/api/jobs/bulk-dual-subtitle`, {
          show_id: showId,
          show_title: showTitle,
          primary_language: primaryLanguage,
          secondary_language: secondaryLanguage,
          styling_config: stylingConfig,
          episode_configs: Object.fromEntries(episodeConfigs) // Convert Map to object
        }, {
          headers: {
            'x-plex-token': plexToken || ''
          }
        });
        
        const jobId = jobResponse.data.job_id;
        console.log(`Background job started: ${jobId}`);
        
        // Notify parent that job has started
        onJobIdReceived(jobId);
        
        // Poll for job progress
        const pollInterval = setInterval(async () => {
          try {
            const jobDetails = await axios.get(`${API_BASE}/api/jobs/${jobId}`, {
              headers: {
                'x-plex-token': localStorage.getItem('plexAuthToken') || ''
              }
            });
            const job = jobDetails.data;
            
            // Update progress
            if (job.progress) {
              setProgress(job.progress.percentage || 0);
              setCurrentEpisode(job.progress.current_item || '');
              setEstimatedTimeRemaining(job.progress.estimated_time_remaining || '');
              if (job.progress.details?.average_time_per_episode) {
                setAverageTime(parseInt(job.progress.details.average_time_per_episode) || 45);
              }
            }
            
            // Check if job is completed
            if (job.status === 'completed') {
              clearInterval(pollInterval);
              setProgress(100);
              setIsProcessing(false);
              
              // Small delay to show completion state
              setTimeout(() => {
                onComplete(job.result || { successful: [], failed: [], skipped: [] });
              }, 1000);
              
            } else if (job.status === 'failed') {
              clearInterval(pollInterval);
              setError(job.error || 'Job failed');
              setIsProcessing(false);
              
            } else if (job.status === 'cancelled') {
              clearInterval(pollInterval);
              setError('Job was cancelled');
              setIsProcessing(false);
            }
            
          } catch (pollErr) {
            console.error('Error polling job status:', pollErr);
          }
        }, 1000); // Poll every second
        
        // Store the interval for cleanup
        return pollInterval;
        
      } catch (err: any) {
        console.error('Failed to start background job:', err);
        setError(err.response?.data?.detail || err.message || 'Failed to start processing');
        setIsProcessing(false);
      }
    };

    const intervalPromise = startBackgroundJob();
    
    // Cleanup function
    return () => {
      if (intervalPromise instanceof Promise) {
        intervalPromise.then(interval => {
          if (interval) clearInterval(interval);
        });
      } else if (intervalPromise) {
        clearInterval(intervalPromise);
      }
    };
  }, [showId, primaryLanguage, secondaryLanguage, stylingConfig, episodeConfigs, onComplete, onJobIdReceived]);

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <AlertTriangle className="w-12 h-12 text-error-500" />
          </div>
          
          <h3 className="text-xl font-semibold text-cream-500 mb-2">
            Processing Failed
          </h3>
          
          <p className="text-error-400 mb-4">
            {error}
          </p>
          
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          {isProcessing ? (
            <Loader className="w-12 h-12 text-gold-500 animate-spin" />
          ) : (
            <CheckCircle className="w-12 h-12 text-success-500" />
          )}
        </div>
        
        <h3 className="text-xl font-semibold text-cream-500 mb-2">
          {isProcessing ? 'Creating Dual Subtitles' : 'Processing Complete'}
        </h3>
        
        <p className="text-mist-500 mb-2">
          {isProcessing 
            ? `Processing ${primaryLanguage} + ${secondaryLanguage} subtitles...`
            : 'All episodes have been processed'
          }
        </p>

        {isProcessing && (
          <p className="text-xs text-mist-400 mb-4">
            Using hybrid sync: primary to video, secondary to primary (faster)
          </p>
        )}

        {/* Current Episode */}
        {currentEpisode && isProcessing && (
          <div className="text-center mb-6">
            <p className="text-sm text-gold-400 mb-2">
              Currently processing: {currentEpisode}
            </p>
            {estimatedTimeRemaining && (
              <div className="text-xs text-mist-500 space-y-1">
                <p>Estimated time remaining: <span className="text-warning-400">{estimatedTimeRemaining}</span></p>
                <p>Average per episode: <span className="text-blue-400">{averageTime}s</span></p>
              </div>
            )}
          </div>
        )}

        {/* Progress Bar */}
        <div className="w-full bg-charcoal-400 rounded-full h-3 mb-4">
          <div 
            className="h-3 bg-gold-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="text-sm text-mist-500">
          {Math.round(progress)}% complete
        </p>
      </div>
    </div>
  );
};