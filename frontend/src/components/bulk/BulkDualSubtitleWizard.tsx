import React, { useState, useCallback } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import type { WizardStep, SubtitleAnalysis, EpisodeConfig, JobStatus } from '../../types/bulk';
import type { DualSubtitleConfig } from '../../types';
import { LanguageDiscoveryStep } from './LanguageDiscoveryStep';
import { EpisodePreviewStep } from './EpisodePreviewStep';
import { ProcessingStep } from './ProcessingStep';
import { ResultsStep } from './ResultsStep';

interface BulkDualSubtitleWizardProps {
  showId: string;
  showTitle: string;
  onClose: () => void;
  onComplete?: () => void;
}

export const BulkDualSubtitleWizard: React.FC<BulkDualSubtitleWizardProps> = ({
  showId,
  showTitle,
  onClose,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('discovery');
  const [analysis, setAnalysis] = useState<SubtitleAnalysis | null>(null);
  const [primaryLanguage, setPrimaryLanguage] = useState<string>('');
  const [secondaryLanguage, setSecondaryLanguage] = useState<string>('');
  const [stylingConfig, setStylingConfig] = useState<DualSubtitleConfig>({
    primary_position: 'bottom',
    secondary_position: 'top',
    primary_color: '#FFFFFF',
    secondary_color: '#FFFF00',
    primary_font_size: 22,
    secondary_font_size: 18,
    primary_language: '',
    secondary_language: '',
    output_format: 'ass',
    secondary_timing_offset: -200, // Default to -200ms to compensate for common lag
  });
  const [episodeConfigs, setEpisodeConfigs] = useState<Map<string, EpisodeConfig>>(new Map());
  const [jobId, setJobId] = useState<string>('');
  const [, setResults] = useState<JobStatus['results'] | null>(null);

  const handleLanguageSelect = useCallback((primary: string, secondary: string) => {
    setPrimaryLanguage(primary);
    setSecondaryLanguage(secondary);
    setStylingConfig(prev => ({
      ...prev,
      primary_language: primary,
      secondary_language: secondary
    }));
    setCurrentStep('preview');
  }, []);

  const handleEpisodeConfigChange = useCallback((episodeId: string, config: EpisodeConfig) => {
    setEpisodeConfigs(prev => new Map(prev.set(episodeId, config)));
  }, []);

  const handleStartProcessing = useCallback(() => {
    setCurrentStep('processing');
  }, []);

  const handleJobStarted = useCallback((startedJobId: string) => {
    setJobId(startedJobId);
    setCurrentStep('results'); // Reuse results step for job started confirmation
  }, []);

  const handleProcessingComplete = useCallback((jobResults: JobStatus['results']) => {
    setResults(jobResults);
    // No longer needed - jobs run in background
  }, []);

  const handleBack = () => {
    switch (currentStep) {
      case 'preview':
        setCurrentStep('discovery');
        break;
      case 'processing':
        // Allow going back if job hasn't started yet
        setCurrentStep('preview');
        break;
      case 'results':
        // Don't allow going back from job started confirmation
        break;
      default:
        break;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'discovery':
        return 'Language Discovery';
      case 'preview':
        return 'Episode Configuration';
      case 'processing':
        return 'Starting Background Job';
      case 'results':
        return jobId ? 'Job Started Successfully' : 'Processing Complete';
      default:
        return 'Bulk Dual Subtitles';
    }
  };

  const canGoBack = currentStep === 'preview' || (currentStep === 'processing' && !jobId);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-4 bg-black/30 backdrop-blur-md pt-40 overflow-y-auto">
      <div className="bg-charcoal-500 rounded-2xl border border-sage-500/30 shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-sage-500/20">
          <div className="flex items-center gap-4">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-charcoal-400 border border-sage-500/20 text-sage-500 hover:bg-sage-500 hover:text-cream-500 transition-all duration-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-2xl font-serif font-bold text-cream-500">
                {getStepTitle()}
              </h2>
              <p className="text-mist-500 text-sm mt-1">
                {showTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-mist-500 hover:text-cream-500 hover:bg-sage-500/20 transition-all duration-200 p-2 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator */}
        <div className="px-6 py-4 border-b border-sage-500/20 bg-charcoal-400/30">
          <div className="flex items-center justify-between">
            {(['discovery', 'preview', 'results'] as WizardStep[]).map((step, index) => {
              const stepLabels = ['Language Discovery', 'Configuration', 'Start Job'];
              const isActive = step === currentStep || (currentStep === 'processing' && step === 'results');
              const isCompleted = 
                (step === 'discovery' && ['preview', 'processing', 'results'].includes(currentStep)) ||
                (step === 'preview' && ['processing', 'results'].includes(currentStep));
              
              return (
                <div
                  key={step}
                  className={`flex items-center ${index < 2 ? 'flex-1' : ''}`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-gold-500 text-black'
                          : isCompleted
                          ? 'bg-success-500/20 text-success-500'
                          : 'bg-sage-500/20 text-sage-500'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="text-xs text-mist-500 mt-1">{stepLabels[index]}</span>
                  </div>
                  {index < 2 && (
                    <div
                      className={`h-0.5 mx-4 flex-1 transition-all duration-200 ${
                        isCompleted ? 'bg-success-500/50' : 'bg-sage-500/20'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {currentStep === 'discovery' && (
            <LanguageDiscoveryStep
              showId={showId}
              analysis={analysis}
              onAnalysisLoad={setAnalysis}
              onLanguageSelect={handleLanguageSelect}
              selectedPrimary={primaryLanguage}
              selectedSecondary={secondaryLanguage}
            />
          )}

          {currentStep === 'preview' && analysis && (
            <EpisodePreviewStep
              analysis={analysis}
              primaryLanguage={primaryLanguage}
              secondaryLanguage={secondaryLanguage}
              stylingConfig={stylingConfig}
              onStylingConfigChange={setStylingConfig}
              onEpisodeConfigChange={handleEpisodeConfigChange}
              episodeConfigs={episodeConfigs}
              onStartProcessing={handleStartProcessing}
            />
          )}

          {currentStep === 'processing' && (
            <ProcessingStep
              showId={showId}
              showTitle={showTitle}
              primaryLanguage={primaryLanguage}
              secondaryLanguage={secondaryLanguage}
              stylingConfig={stylingConfig}
              episodeConfigs={episodeConfigs}
              onComplete={handleProcessingComplete}
              onJobIdReceived={handleJobStarted}
            />
          )}

          {currentStep === 'results' && jobId && (
            <JobStartedStep
              jobId={jobId}
              showTitle={showTitle}
              primaryLanguage={primaryLanguage}
              secondaryLanguage={secondaryLanguage}
              onClose={() => {
                onComplete?.();
                onClose();
              }}
            />
          )}

          {currentStep === 'results' && !jobId && results && (
            <ResultsStep
              results={results}
              onClose={() => {
                onComplete?.();
                onClose();
              }}
              onViewEpisode={(episodeId) => {
                // TODO: Navigate to episode detail
                console.log('View episode:', episodeId);
              }}
              onRetryFailed={(episodeIds) => {
                // TODO: Implement retry logic
                console.log('Retry episodes:', episodeIds);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface JobStartedStepProps {
  jobId: string;
  showTitle: string;
  primaryLanguage: string;
  secondaryLanguage: string;
  onClose: () => void;
}

const JobStartedStep: React.FC<JobStartedStepProps> = ({ 
  jobId, 
  showTitle, 
  primaryLanguage, 
  secondaryLanguage, 
  onClose 
}) => {
  return (
    <div className="p-8 text-center">
      <div className="max-w-2xl mx-auto">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-success-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-serif font-bold text-success-500 mb-4">
          Background Job Started Successfully!
        </h3>

        {/* Details */}
        <div className="bg-charcoal-400/30 rounded-xl p-6 mb-6">
          <div className="space-y-3 text-left">
            <div className="flex justify-between">
              <span className="text-mist-500">Show:</span>
              <span className="text-cream-500 font-medium">{showTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mist-500">Languages:</span>
              <span className="text-cream-500 font-medium">{primaryLanguage} + {secondaryLanguage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mist-500">Job ID:</span>
              <span className="text-cream-500 font-mono text-sm">{jobId.substring(0, 8)}...</span>
            </div>
          </div>
        </div>

        {/* Information */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-8">
          <p className="text-blue-400 text-sm leading-relaxed">
            <strong>Your job is now running in the background!</strong><br />
            You can safely close this window and monitor progress from the dashboard. 
            The background job will continue processing your dual subtitles.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={onClose}
            className="btn-primary px-8 py-3"
          >
            Close & Return to Show
          </button>
          <button
            onClick={() => {
              // TODO: Open job detail modal
              console.log('View job details:', jobId);
            }}
            className="btn-secondary px-8 py-3"
          >
            Monitor Progress
          </button>
        </div>
      </div>
    </div>
  );
};