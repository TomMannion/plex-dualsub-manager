import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Play, Pause, Eye } from 'lucide-react';
import axios from 'axios';

interface Job {
  id: string;
  type: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  progress: {
    current_step: string;
    current_item: string;
    processed: number;
    total: number;
    percentage: number;
    estimated_time_remaining: string;
    details: Record<string, any>;
  };
  result?: any;
  error?: string;
}

interface JobStatusWidgetProps {
  onViewJobDetails: (jobId: string) => void;
}

export const JobStatusWidget: React.FC<JobStatusWidgetProps> = ({ onViewJobDetails }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      setError(null);
      
      // Create axios instance with same config as api.ts
      const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000'  
        : `http://${window.location.hostname}:8000`;
      
      const response = await axios.get(`${API_BASE}/api/jobs/`, {
        headers: {
          'x-plex-token': localStorage.getItem('plexAuthToken') || ''
        }
      });
      setJobs(response.data);
    } catch (err: any) {
      console.error('Failed to fetch jobs:', err);
      setError(err.response?.data?.detail || 'Failed to fetch jobs');
    }
  };

  useEffect(() => {
    fetchJobs();
    
    // Set up polling for job updates every 5 seconds to reduce console spam
    const interval = setInterval(fetchJobs, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-warning-500" />;
      case 'running':
        return <Play className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-error-500" />;
      case 'cancelled':
        return <Pause className="w-4 h-4 text-sage-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-mist-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-warning-500';
      case 'running': return 'text-blue-500';
      case 'completed': return 'text-success-500';
      case 'failed': return 'text-error-500';
      case 'cancelled': return 'text-sage-500';
      default: return 'text-mist-500';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return date.toLocaleDateString();
  };

  // Filter to show only active jobs and recent completed/failed jobs (last 24 hours)
  const relevantJobs = jobs.filter(job => {
    if (['pending', 'running'].includes(job.status)) return true;
    
    const jobDate = new Date(job.created_at);
    const now = new Date();
    const diffHours = (now.getTime() - jobDate.getTime()) / (1000 * 60 * 60);
    
    return diffHours < 24; // Show jobs from last 24 hours
  }).slice(0, 5); // Limit to 5 most recent

  if (error) {
    return (
      <div className="bg-charcoal-400/30 rounded-xl p-4 border border-error-500/20">
        <div className="flex items-center gap-2 text-error-400">
          <XCircle className="w-4 h-4" />
          <span className="text-sm">Failed to load jobs</span>
        </div>
      </div>
    );
  }

  if (relevantJobs.length === 0) {
    return (
      <div className="bg-gradient-to-r from-charcoal-500/50 via-charcoal-400/30 to-charcoal-500/50 rounded-2xl p-6 border border-sage-500/20 shadow-lg">
        <div className="flex items-center justify-center gap-3 text-mist-500">
          <CheckCircle className="w-5 h-5" />
          <span className="text-base font-light">All background tasks completed</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-charcoal-500/50 via-charcoal-400/30 to-charcoal-500/50 rounded-2xl border border-sage-500/20 shadow-lg backdrop-blur-sm">
      <div className="p-6 border-b border-sage-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-500/20 rounded-xl flex items-center justify-center">
              <Play className="w-5 h-5 text-gold-500" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-xl text-cream-500">Background Tasks</h3>
              <p className="text-sm text-mist-500 font-light">Monitor your processing jobs</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {jobs.filter(j => j.status === 'running').length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 rounded-full">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm text-blue-400 font-medium">
                  {jobs.filter(j => j.status === 'running').length} active
                </span>
              </div>
            )}
            {jobs.filter(j => j.status === 'completed').length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-success-500/20 rounded-full">
                <CheckCircle className="w-3 h-3 text-success-500" />
                <span className="text-sm text-success-400 font-medium">
                  {jobs.filter(j => j.status === 'completed').length} completed
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <div className="grid gap-3">
          {relevantJobs.map(job => (
            <div
              key={job.id}
              className="p-4 rounded-xl hover:bg-charcoal-500/50 transition-all duration-200 cursor-pointer group border border-transparent hover:border-sage-500/30"
              onClick={() => onViewJobDetails(job.id)}
            >
              <div className="flex items-start gap-4 w-full">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getStatusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-medium text-cream-500 truncate">
                          {job.title}
                        </h4>
                        <p className="text-sm text-mist-500 truncate">
                          {job.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                          job.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                          job.status === 'completed' ? 'bg-success-500/20 text-success-400' :
                          job.status === 'failed' ? 'bg-error-500/20 text-error-400' :
                          job.status === 'pending' ? 'bg-warning-500/20 text-warning-400' :
                          'bg-sage-500/20 text-sage-400'
                        }`}>
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                        <span className="text-sm text-mist-500">
                          {formatDate(job.created_at)}
                        </span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-4 h-4 text-mist-500" />
                          <span className="text-sm text-mist-500 font-medium">View Details</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {job.status === 'running' && (
                <div className="mt-3 px-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-mist-400 font-medium">{job.progress.current_step}</span>
                    <span className="text-blue-400 font-medium">
                      {Math.round(job.progress.percentage)}%
                    </span>
                  </div>
                  <div className="w-full bg-charcoal-500 rounded-full h-2">
                    <div 
                      className="h-2 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress.percentage}%` }}
                    />
                  </div>
                  {job.progress.current_item && (
                    <p className="text-sm text-mist-400 mt-2 truncate">
                      Currently: {job.progress.current_item}
                    </p>
                  )}
                  {job.progress.estimated_time_remaining && (
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-blue-400">
                        {job.progress.estimated_time_remaining} remaining
                      </span>
                      <span className="text-mist-500">
                        {job.progress.processed} of {job.progress.total} completed
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {job.status === 'completed' && job.result && (
                <div className="mt-3 px-4">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-success-400 font-medium">
                      ✓ {job.result.successful?.length || 0} successful
                    </span>
                    {job.result.failed?.length > 0 && (
                      <span className="text-error-400 font-medium">
                        ✗ {job.result.failed.length} failed
                      </span>
                    )}
                    {job.result.skipped?.length > 0 && (
                      <span className="text-warning-400 font-medium">
                        ⚠ {job.result.skipped.length} skipped
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {job.status === 'failed' && job.error && (
                <div className="mt-3 px-4">
                  <div className="text-sm text-error-400 bg-error-500/10 rounded-lg p-3">
                    {job.error.split('\n')[0]} {/* Show first line of error */}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};