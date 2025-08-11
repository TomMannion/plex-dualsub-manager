import React from 'react';
import { CheckCircle, XCircle, SkipForward, Eye, RotateCcw, X } from 'lucide-react';
import type { JobStatus } from '../../types/bulk';

interface ResultsStepProps {
  results: JobStatus['results'];
  onClose: () => void;
  onViewEpisode: (episodeId: string) => void;
  onRetryFailed: (episodeIds: string[]) => void;
}

export const ResultsStep: React.FC<ResultsStepProps> = ({
  results,
  onClose,
  onViewEpisode,
  onRetryFailed
}) => {
  if (!results) return null;

  // const totalProcessed = results.successful.length + results.failed.length + results.skipped.length;
  // const successRate = Math.round((results.successful.length / totalProcessed) * 100);

  return (
    <div className="p-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          {results.failed.length === 0 ? (
            <CheckCircle className="w-12 h-12 text-success-500" />
          ) : (
            <div className="relative">
              <CheckCircle className="w-12 h-12 text-success-500" />
              {results.failed.length > 0 && (
                <XCircle className="w-6 h-6 text-error-500 absolute -top-1 -right-1" />
              )}
            </div>
          )}
        </div>
        
        <h3 className="text-2xl font-semibold text-cream-500 mb-2">
          Processing Complete
        </h3>
        
        <p className="text-mist-500">
          {results.failed.length === 0 
            ? `Successfully created ${results.successful.length} dual subtitles`
            : `Created ${results.successful.length} dual subtitles with ${results.failed.length} failures`
          }
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="text-center p-6 bg-success-500/10 border border-success-500/20 rounded-xl">
          <CheckCircle className="w-8 h-8 text-success-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-success-500 mb-1">
            {results.successful.length}
          </div>
          <div className="text-success-500 text-sm">Successful</div>
        </div>

        {results.failed.length > 0 && (
          <div className="text-center p-6 bg-error-500/10 border border-error-500/20 rounded-xl">
            <XCircle className="w-8 h-8 text-error-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-error-500 mb-1">
              {results.failed.length}
            </div>
            <div className="text-error-500 text-sm">Failed</div>
          </div>
        )}

        {results.skipped.length > 0 && (
          <div className="text-center p-6 bg-warning-500/10 border border-warning-500/20 rounded-xl">
            <SkipForward className="w-8 h-8 text-warning-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-warning-500 mb-1">
              {results.skipped.length}
            </div>
            <div className="text-warning-500 text-sm">Skipped</div>
          </div>
        )}
      </div>

      {/* Failed Episodes Details */}
      {results.failed.length > 0 && (
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-cream-500 mb-4">
            Failed Episodes
          </h4>
          <div className="space-y-3">
            {results.failed.map((failure) => (
              <div
                key={failure.episode_id}
                className="flex items-center justify-between p-4 bg-error-500/10 border border-error-500/20 rounded-lg"
              >
                <div>
                  <p className="font-medium text-cream-500">
                    Episode {failure.episode_id}
                  </p>
                  <p className="text-sm text-error-400">
                    {failure.error}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onViewEpisode(failure.episode_id)}
                    className="p-2 text-mist-500 hover:text-cream-500 hover:bg-sage-500/20 rounded-lg transition-all duration-200"
                    title="View Episode"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRetryFailed([failure.episode_id])}
                    className="p-2 text-warning-500 hover:text-warning-400 hover:bg-warning-500/20 rounded-lg transition-all duration-200"
                    title="Retry"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onClose}
          className="btn-primary flex items-center gap-2"
        >
          Done
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};