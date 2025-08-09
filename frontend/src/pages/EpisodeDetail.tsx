import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Play, Subtitles, Plus, Upload } from 'lucide-react';
import { apiClient } from '../lib/api';
import { DualSubtitleCreator } from '../components/DualSubtitleCreator';

export const EpisodeDetail: React.FC = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [showDualCreator, setShowDualCreator] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLanguage, setUploadLanguage] = useState('en');
  const [isUploading, setIsUploading] = useState(false);
  const [extractingStreams, setExtractingStreams] = useState<Set<number>>(new Set());
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());

  // Fetch episode details
  const { data: episode, isLoading } = useQuery({
    queryKey: ['episode', episodeId],
    queryFn: () => apiClient.getEpisodeDetail(episodeId!),
    enabled: !!episodeId,
  });

  // Fetch episode subtitles
  const { data: subtitles, refetch: refetchSubtitles } = useQuery({
    queryKey: ['episode-subtitles', episodeId],
    queryFn: () => apiClient.getEpisodeSubtitles(episodeId!),
    enabled: !!episodeId,
  });

  // Handle subtitle upload
  const handleUpload = async () => {
    if (!uploadFile || !episodeId) return;
    
    try {
      setIsUploading(true);
      await apiClient.uploadSubtitle(episodeId, uploadFile, uploadLanguage);
      
      // Reset form and refetch data
      setUploadFile(null);
      setUploadLanguage('en');
      refetchSubtitles();
      
      // Show success message (you can add toast notification here)
      console.log('Subtitle uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      // You can add error toast notification here
    } finally {
      setIsUploading(false);
    }
  };

  // Handle embedded subtitle extraction
  const handleExtract = async (streamIndex: number, languageCode: string) => {
    if (!episodeId) return;
    
    // Add to extracting set
    setExtractingStreams(prev => new Set(prev).add(streamIndex));
    
    try {
      await apiClient.extractEmbeddedSubtitle(
        episodeId, 
        streamIndex, 
        languageCode || 'unknown', 
        'normal'
      );
      
      // Refetch subtitles to show the new extracted file
      await refetchSubtitles();
      
      console.log('Subtitle extracted successfully!');
    } catch (error) {
      console.error('Extract failed:', error);
    } finally {
      // Remove from extracting set
      setExtractingStreams(prev => {
        const newSet = new Set(prev);
        newSet.delete(streamIndex);
        return newSet;
      });
    }
  };

  // Handle subtitle deletion
  const handleDelete = async (filePath: string) => {
    if (!confirm('Are you sure you want to delete this subtitle? A backup will be created.')) {
      return;
    }
    
    // Add to deleting set
    setDeletingFiles(prev => new Set(prev).add(filePath));
    
    try {
      const result = await apiClient.deleteSubtitle(filePath);
      
      // Refetch subtitles to update the list
      await refetchSubtitles();
      
      console.log(`Subtitle deleted. Backup saved at: ${result.backup}`);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      // Remove from deleting set
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-plex-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-plex-gray-700 rounded w-2/3 mb-8"></div>
          <div className="card">
            <div className="h-32 bg-plex-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-plex-gray-100 mb-2">Episode not found</h2>
        <Link to="/shows" className="btn-primary">
          ← Back to Shows
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/shows/${episode.show}`} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-plex-gray-100 mb-2">
            {episode.show} - {episode.season_episode}
          </h1>
          <h2 className="text-xl text-plex-gray-300 mb-2">{episode.title}</h2>
          <div className="flex items-center gap-4 text-plex-gray-400">
            <div className="flex items-center gap-1">
              <Play className="w-4 h-4" />
              <span>Season {episode.season}, Episode {episode.episode}</span>
            </div>
            {episode.duration && (
              <span>{Math.round(episode.duration / 60000)} min</span>
            )}
          </div>
        </div>
      </div>

      {/* Subtitle Management */}
      <div className="card">
        <h3 className="text-xl font-bold text-plex-gray-100 mb-4 flex items-center gap-2">
          <Subtitles className="w-5 h-5 text-plex-orange" />
          Subtitle Management
        </h3>
        
        {subtitles ? (
          <div className="space-y-4">
            {/* File Info */}
            <div className="bg-plex-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-plex-gray-100 mb-2">Episode File</h4>
              {subtitles.file_path ? (
                <div className="text-sm text-plex-gray-300">
                  <p>✅ File found</p>
                  <p className="text-xs text-plex-gray-400 mt-1">
                    Naming pattern: {subtitles.naming_pattern}.LANG.srt
                  </p>
                </div>
              ) : (
                <p className="text-sm text-red-400">❌ No file found</p>
              )}
            </div>

            {/* Embedded Subtitles */}
            {subtitles.embedded_subtitles && subtitles.embedded_subtitles.length > 0 && (
              <div>
                <h4 className="font-semibold text-plex-gray-100 mb-2">
                  Embedded Subtitles ({subtitles.embedded_subtitles.length})
                </h4>
                <div className="space-y-2">
                  {subtitles.embedded_subtitles.map((sub, index) => {
                    const isExtracting = extractingStreams.has(sub.stream_index);
                    return (
                      <div key={index} className="flex items-center justify-between bg-plex-gray-700 rounded-lg p-3">
                        <span className="text-plex-gray-200">{sub.display_name}</span>
                        <button 
                          className="btn-primary text-xs py-1 px-2"
                          onClick={() => handleExtract(sub.stream_index, sub.languageCode)}
                          disabled={isExtracting}
                        >
                          {isExtracting ? 'Extracting...' : 'Extract'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* External Subtitles */}
            {subtitles.external_subtitles && subtitles.external_subtitles.length > 0 && (
              <div>
                <h4 className="font-semibold text-plex-gray-100 mb-2">
                  External Subtitles ({subtitles.external_subtitles.length})
                </h4>
                <div className="space-y-2">
                  {subtitles.external_subtitles.map((sub, index) => {
                    const isDeleting = deletingFiles.has(sub.file_path);
                    return (
                      <div key={index} className="flex items-center justify-between bg-plex-gray-700 rounded-lg p-3">
                        <div>
                          <p className="text-plex-gray-200">{sub.file_name}</p>
                          <p className="text-xs text-plex-gray-400">
                            {sub.language_code || 'unknown'} · {sub.format}
                          </p>
                        </div>
                        <button 
                          className="btn-secondary text-xs py-1 px-2"
                          onClick={() => handleDelete(sub.file_path)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upload Section */}
            <div className="border-t border-plex-gray-600 pt-4">
              <h4 className="font-semibold text-plex-gray-100 mb-3">Upload New Subtitle</h4>
              <div className="flex gap-4">
                <input
                  type="file"
                  accept=".srt,.ass,.vtt,.sub"
                  className="input-field flex-1"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <input
                  type="text"
                  placeholder="Language (e.g., en, ja)"
                  className="input-field w-32"
                  value={uploadLanguage}
                  onChange={(e) => setUploadLanguage(e.target.value)}
                />
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleUpload}
                  disabled={!uploadFile || isUploading}
                >
                  <Upload className="w-4 h-4" />
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>

            {/* Dual Subtitle Section */}
            {subtitles.external_subtitles && subtitles.external_subtitles.length >= 2 && (
              <div className="border-t border-plex-gray-600 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-plex-gray-100">Create Dual Subtitle</h4>
                  <button
                    onClick={() => setShowDualCreator(!showDualCreator)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className={`w-4 h-4 transition-transform ${showDualCreator ? 'rotate-45' : ''}`} />
                    {showDualCreator ? 'Close' : 'Create'}
                  </button>
                </div>

                {!showDualCreator ? (
                  <div className="bg-plex-orange/10 border border-plex-orange/20 rounded-lg p-4">
                    <p className="text-plex-gray-200 mb-2">
                      You have {subtitles.external_subtitles.length} external subtitles available.
                    </p>
                    <p className="text-sm text-plex-gray-400">
                      Create a dual subtitle with custom positioning, colors, and font sizes.
                    </p>
                  </div>
                ) : (
                  <div className="bg-plex-gray-700/50 border border-plex-gray-600 rounded-lg p-6">
                    <DualSubtitleCreator
                      episodeId={episodeId!}
                      subtitles={subtitles.external_subtitles}
                      onCreated={() => {
                        refetchSubtitles();
                        setShowDualCreator(false);
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Subtitles className="w-12 h-12 text-plex-gray-600 mx-auto mb-4" />
            <p className="text-plex-gray-400">Loading subtitle information...</p>
          </div>
        )}
      </div>
    </div>
  );
};