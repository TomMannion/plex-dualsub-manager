import React, { useState, useEffect } from 'react';
import { 
  X, Clock, CheckCircle, XCircle, AlertCircle, Play, Pause, 
  Download, RefreshCw, StopCircle, Eye, FileText, AlertTriangle
} from 'lucide-react';
import axios from 'axios';

interface Job {
  id: string;
  type: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress: {
    current_step: string;
    current_item: string;
    processed: number;
    total: number;
    percentage: number;
    estimated_time_remaining: string;
    details: Record<string, any>;
  };
  result?: {
    successful: Array<{
      episode_id: string;
      episode_title: string;
      output_file: string;
      output_path: string;
    }>;
    failed: Array<{
      episode_id: string;
      episode_title: string;
      error: string;
    }>;
    skipped: Array<{
      episode_id: string;
      episode_title: string;
      reason: string;
    }>;
  };
  error?: string;
  metadata: Record<string, any>;
}

interface JobDetailModalProps {
  jobId: string;
  onClose: () => void;
  onJobComplete?: () => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ 
  jobId, 
  onClose, 
  onJobComplete 
}) => {
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchJobDetails = async () => {
    try {
      setError(null);
      
      // Create axios instance with same config as api.ts
      const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000'  
        : `http://${window.location.hostname}:8000`;
      
      const response = await axios.get(`${API_BASE}/api/jobs/${jobId}`, {
        headers: {
          'x-plex-token': localStorage.getItem('plexAuthToken') || ''
        }
      });
      const newJob = response.data;
      
      // Check if job was just completed
      if (job?.status !== 'completed' && newJob.status === 'completed' && onJobComplete) {
        onJobComplete();
      }
      
      setJob(newJob);
    } catch (err: any) {
      console.error('Failed to fetch job details:', err);
      setError(err.response?.data?.detail || 'Failed to fetch job details');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelJob = async () => {
    if (!job || isCancelling) return;
    
    setIsCancelling(true);
    try {
      // Create axios instance with same config as api.ts
      const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000'  
        : `http://${window.location.hostname}:8000`;
      
      await axios.post(`${API_BASE}/api/jobs/${job.id}/cancel`, {}, {
        headers: {
          'x-plex-token': localStorage.getItem('plexAuthToken') || ''
        }
      });
      // Refresh job details
      await fetchJobDetails();
    } catch (err: any) {
      console.error('Failed to cancel job:', err);
      setError(err.response?.data?.detail || 'Failed to cancel job');
    } finally {
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    fetchJobDetails();
    
    // Set up polling for job updates every 1 second for active jobs
    const interval = setInterval(() => {
      if (job?.status === 'running' || job?.status === 'pending') {
        fetchJobDetails();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [jobId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-warning-500" />;
      case 'running':
        return <Play className="w-5 h-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-success-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-error-500" />;
      case 'cancelled':
        return <Pause className="w-5 h-5 text-sage-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-mist-500" />;
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const calculateDuration = (startStr?: string, endStr?: string) => {
    if (!startStr) return null;
    
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date();
    const diffMs = end.getTime() - start.getTime();
    
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-charcoal-500 rounded-xl p-8 border border-sage-500/30">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-cream-500">Loading job details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-charcoal-500 rounded-xl p-8 border border-error-500/30 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-error-500">Error</h2>
            <button onClick={onClose} className="text-mist-500 hover:text-cream-500">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-error-400">{error}</p>
          <button onClick={onClose} className="btn-primary mt-4 w-full">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-charcoal-500 rounded-2xl border border-sage-500/30 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-sage-500/20">
          <div className="flex items-center gap-3">
            {getStatusIcon(job.status)}
            <div>
              <h2 className="text-xl font-semibold text-cream-500">
                {job.title}
              </h2>
              <p className="text-mist-500 text-sm">
                {job.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(job.status === 'pending' || job.status === 'running') && (
              <button
                onClick={cancelJob}
                disabled={isCancelling}
                className="btn-secondary flex items-center gap-2"
              >
                <StopCircle className="w-4 h-4" />
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}
            <button onClick={onClose} className="text-mist-500 hover:text-cream-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {/* Job Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <h3 className="font-medium text-cream-500">Job Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-mist-500">Status:</span>
                  <span className="text-cream-500 capitalize">{job.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mist-500">Created:</span>
                  <span className="text-cream-500">{formatDateTime(job.created_at)}</span>
                </div>
                {job.started_at && (
                  <div className="flex justify-between">
                    <span className="text-mist-500">Started:</span>
                    <span className="text-cream-500">{formatDateTime(job.started_at)}</span>
                  </div>
                )}
                {job.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-mist-500">Completed:</span>
                    <span className="text-cream-500">{formatDateTime(job.completed_at)}</span>
                  </div>
                )}
                {job.started_at && (
                  <div className="flex justify-between">
                    <span className="text-mist-500">Duration:</span>
                    <span className="text-cream-500">
                      {calculateDuration(job.started_at, job.completed_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress */}
            {job.status === 'running' && (
              <div className="space-y-3">
                <h3 className="font-medium text-cream-500">Progress</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-mist-500">{job.progress.current_step}</span>
                    <span className="text-cream-500 font-medium">
                      {Math.round(job.progress.percentage)}%
                    </span>
                  </div>
                  <div className="w-full bg-charcoal-400 rounded-full h-2">
                    <div 
                      className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress.percentage}%` }}
                    />
                  </div>
                  {job.progress.current_item && (
                    <p className="text-sm text-mist-400">
                      {job.progress.current_item}
                    </p>
                  )}
                  <div className="text-sm text-mist-500">
                    {job.progress.processed} of {job.progress.total} completed
                  </div>
                  {job.progress.estimated_time_remaining && (
                    <div className="text-sm text-blue-400">
                      {job.progress.estimated_time_remaining} remaining
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          {job.result && job.status === 'completed' && (
            <div className="space-y-4">
              <h3 className="font-medium text-cream-500">Results</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-success-500/10 border border-success-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-success-500" />
                    <span className="font-medium text-success-500">Successful</span>
                  </div>
                  <div className="text-2xl font-bold text-success-500">
                    {job.result.successful?.length || 0}
                  </div>
                </div>

                <div className="bg-error-500/10 border border-error-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-error-500" />
                    <span className="font-medium text-error-500">Failed</span>
                  </div>
                  <div className="text-2xl font-bold text-error-500">
                    {job.result.failed?.length || 0}
                  </div>
                </div>

                <div className="bg-warning-500/10 border border-warning-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-warning-500" />
                    <span className="font-medium text-warning-500">Skipped</span>
                  </div>
                  <div className="text-2xl font-bold text-warning-500">
                    {job.result.skipped?.length || 0}
                  </div>
                </div>
              </div>

              {/* Detailed Results */}
              {job.result.failed && job.result.failed.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-error-500 mb-3">Failed Episodes</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {job.result.failed.map((item, index) => (
                      <div key={index} className="bg-error-500/10 border border-error-500/20 rounded p-3">
                        <div className="font-medium text-error-400">
                          {item.episode_title}
                        </div>
                        <div className="text-sm text-error-300 mt-1">
                          {item.error}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {job.result.skipped && job.result.skipped.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-warning-500 mb-3">Skipped Episodes</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {job.result.skipped.map((item, index) => (
                      <div key={index} className="bg-warning-500/10 border border-warning-500/20 rounded p-3">
                        <div className="font-medium text-warning-400">
                          {item.episode_title}
                        </div>
                        <div className="text-sm text-warning-300 mt-1">
                          {item.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Details */}
          {job.status === 'failed' && job.error && (
            <div className="space-y-4">
              <h3 className="font-medium text-error-500">Error Details</h3>
              <div className="bg-error-500/10 border border-error-500/20 rounded-lg p-4">
                <pre className="text-sm text-error-400 whitespace-pre-wrap overflow-auto max-h-40">
                  {job.error}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};