import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Play, Subtitles, Plus, Upload, Download, Trash2, Film, FileText, Languages, Sparkles, Check, X, Info, FileUp, HardDrive } from 'lucide-react';
import { apiClient } from '../lib/api';
import { DualSubtitleCreator } from '../components/DualSubtitleCreator';
import { useToast } from '../components/ui/Toaster';
import { COMPREHENSIVE_LANGUAGES, getLanguageByCode, searchLanguages } from '../data/languages';
import { extractLanguageFromFilename } from '../utils/languageDetection';


export const EpisodeDetail: React.FC = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const { showToast } = useToast();
  const [showDualCreator, setShowDualCreator] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLanguage, setUploadLanguage] = useState('en');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [languageSearchTerm, setLanguageSearchTerm] = useState('');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [extractingStreams, setExtractingStreams] = useState<Set<number>>(new Set());
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [dragActive, setDragActive] = useState(false);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.match(/\.(srt|ass|vtt|sub)$/i)) {
        setUploadFile(file);
        
        // Try to detect language from filename
        const detectedLang = extractLanguageFromFilename(file.name);
        if (detectedLang && getLanguageByCode(detectedLang)) {
          setDetectedLanguage(detectedLang);
          setUploadLanguage(detectedLang);
        } else {
          setDetectedLanguage(null);
        }
      } else {
        showToast({
          title: "Invalid file type",
          description: "Please upload a subtitle file (.srt, .ass, .vtt, .sub)",
          variant: "error"
        });
      }
    }
  };

  // Handle subtitle upload
  const handleUpload = async () => {
    if (!uploadFile || !episodeId) return;
    
    try {
      setIsUploading(true);
      await apiClient.uploadSubtitle(episodeId, uploadFile, uploadLanguage);
      
      // Reset form and refetch data
      setUploadFile(null);
      setUploadLanguage('en');
      setDetectedLanguage(null);
      refetchSubtitles();
      
      showToast({
        title: "Success",
        description: `Subtitle uploaded successfully as ${uploadLanguage}`,
        variant: "success"
      });
    } catch (error) {
      showToast({
        title: "Upload failed",
        description: "There was an error uploading the subtitle file",
        variant: "error"
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle embedded subtitle extraction
  const handleExtract = async (streamIndex: number, languageCode: string) => {
    if (!episodeId) return;
    
    setExtractingStreams(prev => new Set(prev).add(streamIndex));
    
    try {
      await apiClient.extractEmbeddedSubtitle(
        episodeId, 
        streamIndex, 
        languageCode || 'unknown', 
        'normal'
      );
      
      await refetchSubtitles();
      
      showToast({
        title: "Success",
        description: `Embedded subtitle extracted as ${languageCode || 'unknown'}`,
        variant: "success"
      });
    } catch (error) {
      showToast({
        title: "Extraction failed",
        description: "There was an error extracting the embedded subtitle",
        variant: "error"
      });
    } finally {
      setExtractingStreams(prev => {
        const newSet = new Set(prev);
        newSet.delete(streamIndex);
        return newSet;
      });
    }
  };

  // Handle subtitle deletion
  const handleDelete = async (filePath: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?\n\nA backup will be created.`)) {
      return;
    }
    
    setDeletingFiles(prev => new Set(prev).add(filePath));
    
    try {
      const result = await apiClient.deleteSubtitle(filePath);
      await refetchSubtitles();
      
      showToast({
        title: "Subtitle deleted",
        description: `Backup saved to ${result.backup.split('/').pop()}`,
        variant: "success"
      });
    } catch (error) {
      showToast({
        title: "Delete failed",
        description: "There was an error deleting the subtitle file",
        variant: "error"
      });
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="px-4 md:px-6 lg:px-8 max-w-full mx-auto py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-charcoal-500 rounded-xl w-1/3"></div>
            <div className="h-6 bg-charcoal-500 rounded-xl w-2/3"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-charcoal-500 rounded-xl"></div>
              <div className="h-64 bg-charcoal-500 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Film className="w-16 h-16 text-sage-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-cream-500 mb-4">Episode not found</h2>
          <Link to="/shows" className="inline-flex items-center gap-2 px-6 py-3 bg-gold-500 text-black rounded-xl font-medium hover:bg-gold-400 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Shows
          </Link>
        </div>
      </div>
    );
  }

  const hasSubtitles = subtitles && (
    (subtitles.embedded_subtitles && subtitles.embedded_subtitles.length > 0) ||
    (subtitles.external_subtitles && subtitles.external_subtitles.length > 0)
  );

  const canCreateDual = subtitles?.external_subtitles && subtitles.external_subtitles.length >= 2;

  return (
    <div className="min-h-screen">
      {/* ELEGANT HEADER */}
      <section className="py-8 border-b border-sage-500/20">
        <div className="px-4 md:px-6 lg:px-8 max-w-full mx-auto">
          <div className="flex items-start gap-4">
            <Link 
              to={`/shows/${episode.show}`} 
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-charcoal-500 border border-gold-500/20 text-gold-500 hover:bg-gold-500 hover:text-black transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-mist-500 mb-2">
                <Link to="/shows" className="hover:text-cream-500 transition-colors">Shows</Link>
                <span>/</span>
                <Link to={`/shows/${episode.show}`} className="hover:text-cream-500 transition-colors">{episode.show}</Link>
                <span>/</span>
                <span className="text-cream-500">{episode.season_episode}</span>
              </div>
              
              <h1 className="font-serif font-bold text-3xl md:text-4xl text-cream-500 mb-2">
                {episode.title}
              </h1>
              
              <div className="flex items-center gap-6 text-sm text-mist-500">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  <span>{episode.season_episode}</span>
                </div>
                {episode.duration && (
                  <div className="flex items-center gap-2">
                    <span>{Math.round(episode.duration / 60000)} min</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Subtitles className="w-4 h-4" />
                  <span>
                    {subtitles?.external_subtitles?.length || 0} external, {subtitles?.embedded_subtitles?.length || 0} embedded
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section className="py-8">
        <div className="px-4 md:px-6 lg:px-8 max-w-full mx-auto">
          {/* Compact File Info Bar */}
          <div className="mb-6 bg-charcoal-500/50 rounded-lg border border-sage-500/20 px-4 py-3">
            <div className="flex items-center gap-3">
              <HardDrive className="w-4 h-4 text-mist-500" />
              {subtitles?.file_path ? (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-success-500" />
                    <span className="text-cream-500">Video file found</span>
                  </div>
                  <span className="text-mist-500">•</span>
                  <code className="text-xs text-mist-500 font-mono bg-charcoal-400/50 px-2 py-1 rounded">
                    {subtitles.naming_pattern}.LANG.srt
                  </code>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <X className="w-3 h-3 text-error-500" />
                  <span className="text-mist-500">No video file found</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* LEFT COLUMN - Current Subtitles (Narrower) */}
            <div>
              <div className="bg-charcoal-500 rounded-xl border border-gold-500/20 shadow-md shadow-black/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-sage-500/20">
                  <h2 className="font-serif font-bold text-xl text-cream-500 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
                      <Subtitles className="w-5 h-5 text-gold-500" />
                    </div>
                    Current Subtitles
                  </h2>
                </div>

                <div className="p-6 max-h-[600px] overflow-y-auto">
                  {!hasSubtitles ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-sage-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-10 h-10 text-sage-500" />
                      </div>
                      <h3 className="font-serif font-bold text-lg text-cream-500 mb-2">No subtitles yet</h3>
                      <p className="text-mist-500 text-sm max-w-sm mx-auto">
                        Upload subtitle files or extract embedded subtitles to get started
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Embedded Subtitles */}
                      {subtitles?.embedded_subtitles && subtitles.embedded_subtitles.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Download className="w-4 h-4 text-mist-500" />
                            <h3 className="font-medium text-cream-500">Embedded</h3>
                            <span className="text-xs px-2 py-1 bg-sage-500/20 text-sage-500 rounded-full">
                              {subtitles.embedded_subtitles.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {subtitles.embedded_subtitles.map((sub, index) => {
                              const isExtracting = extractingStreams.has(sub.stream_index);
                              return (
                                <div key={index} className="flex items-center justify-between p-3 bg-charcoal-400/50 rounded-lg border border-sage-500/10 hover:border-gold-500/20 transition-all duration-200">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 bg-sage-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <FileText className="w-4 h-4 text-sage-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-cream-500 font-medium text-sm truncate">{sub.display_name}</p>
                                      <p className="text-xs text-mist-500">Stream #{sub.stream_index}</p>
                                    </div>
                                  </div>
                                  <button 
                                    className="px-3 py-1.5 bg-gold-500 text-black rounded-lg font-medium text-sm hover:bg-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                    onClick={() => handleExtract(sub.stream_index, sub.languageCode)}
                                    disabled={isExtracting}
                                  >
                                    {isExtracting ? '...' : 'Extract'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* External Subtitles */}
                      {subtitles?.external_subtitles && subtitles.external_subtitles.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4 text-mist-500" />
                            <h3 className="font-medium text-cream-500">External Files</h3>
                            <span className="text-xs px-2 py-1 bg-gold-500/20 text-gold-500 rounded-full">
                              {subtitles.external_subtitles.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {subtitles.external_subtitles.map((sub, index) => {
                              const isDeleting = deletingFiles.has(sub.file_path);
                              const isDual = sub.file_name.includes('.dual.');
                              return (
                                <div key={index} className="flex items-center justify-between p-3 bg-charcoal-400/50 rounded-lg border border-sage-500/10 hover:border-gold-500/20 transition-all duration-200">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDual ? 'bg-gold-500/20' : 'bg-sage-500/20'}`}>
                                      {isDual ? (
                                        <Languages className="w-4 h-4 text-gold-500" />
                                      ) : (
                                        <FileText className="w-4 h-4 text-sage-500" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-cream-500 font-medium text-sm truncate">{sub.file_name}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-mist-500">
                                          {sub.language_code || 'unknown'}
                                        </span>
                                        {isDual && (
                                          <>
                                            <span className="text-xs text-mist-500">•</span>
                                            <span className="text-xs text-gold-500 font-medium">Dual</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <button 
                                    className="p-1.5 text-error-500 hover:bg-error-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                    onClick={() => handleDelete(sub.file_path, sub.file_name)}
                                    disabled={isDeleting}
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - Upload & Dual Subtitle */}
            <div className="space-y-6">
              
              {/* Upload Card (Compact) */}
              <div className="bg-charcoal-500 rounded-xl border border-gold-500/20 shadow-md shadow-black/10 overflow-visible">
                <div className="px-6 py-4 border-b border-sage-500/20">
                  <h2 className="font-serif font-bold text-xl text-cream-500 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
                      <Upload className="w-5 h-5 text-gold-500" />
                    </div>
                    Upload Subtitle
                  </h2>
                </div>

                <div className="p-6 relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Drag and Drop Zone */}
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
                        dragActive 
                          ? 'border-gold-500 bg-gold-500/10' 
                          : 'border-sage-500/30 hover:border-gold-500/50 hover:bg-charcoal-400/30'
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <FileUp className="w-10 h-10 text-sage-500 mx-auto mb-2" />
                      
                      {uploadFile ? (
                        <div>
                          <p className="text-cream-500 font-medium text-sm truncate px-2">{uploadFile.name}</p>
                          <button
                            onClick={() => setUploadFile(null)}
                            className="text-xs text-mist-500 hover:text-error-500 transition-colors mt-1"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-cream-500 font-medium text-sm mb-1">
                            Drop file here
                          </p>
                          <p className="text-xs text-mist-500">
                            or click to browse
                          </p>
                          <input
                            type="file"
                            accept=".srt,.ass,.vtt,.sub"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setUploadFile(file);
                              
                              if (file) {
                                // Try to detect language from filename
                                const detectedLang = extractLanguageFromFilename(file.name);
                                if (detectedLang && getLanguageByCode(detectedLang)) {
                                  setDetectedLanguage(detectedLang);
                                  setUploadLanguage(detectedLang);
                                } else {
                                  setDetectedLanguage(null);
                                }
                              }
                            }}
                          />
                        </>
                      )}
                    </div>

                    {/* Language & Upload Button */}
                    <div className="space-y-3">
                      {/* Language Detection Result */}
                      {detectedLanguage && (
                        <div className="flex items-center gap-2 text-xs">
                          <Check className="w-3 h-3 text-success-500" />
                          <span className="text-success-500">Detected:</span>
                          <span className="text-cream-500">
                            {getLanguageByCode(detectedLanguage)?.name} ({detectedLanguage})
                          </span>
                        </div>
                      )}
                      
                      {/* Language Dropdown with Search */}
                      <div className="relative" ref={languageDropdownRef}>
                        <input
                          type="text"
                          placeholder="Search languages..."
                          value={showLanguageDropdown ? languageSearchTerm : (uploadLanguage ? `${getLanguageByCode(uploadLanguage)?.name} (${uploadLanguage})` : '')}
                          onChange={(e) => {
                            setLanguageSearchTerm(e.target.value);
                            setShowLanguageDropdown(true);
                          }}
                          onFocus={() => {
                            setLanguageSearchTerm('');
                            setShowLanguageDropdown(true);
                          }}
                          className="w-full bg-charcoal-400 border border-sage-500/30 text-cream-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50 transition-all duration-200"
                        />
                        
                        {showLanguageDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-charcoal-500 border border-gold-500/30 rounded-lg shadow-xl shadow-black/20 max-h-48 overflow-y-auto">
                            {(languageSearchTerm ? searchLanguages(languageSearchTerm) : COMPREHENSIVE_LANGUAGES)
                              .map(lang => (
                                <button
                                  key={lang.code}
                                  className="w-full text-left px-4 py-3 text-sm text-cream-500 hover:bg-gold-500/20 hover:text-cream-300 transition-colors border-b border-sage-500/10 last:border-b-0"
                                  onClick={() => {
                                    setUploadLanguage(lang.code);
                                    setLanguageSearchTerm('');
                                    setShowLanguageDropdown(false);
                                  }}
                                >
                                  {lang.name} ({lang.code})
                                </button>
                              ))
                            }
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleUpload}
                        disabled={!uploadFile || isUploading}
                        className="w-full px-4 py-2 bg-gold-500 text-black rounded-lg font-medium text-sm hover:bg-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        {isUploading ? 'Uploading...' : 'Upload'}
                      </button>

                      <p className="text-xs text-mist-500 text-center">
                        SRT, ASS, VTT, SUB
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Create Dual Subtitle Card */}
              {canCreateDual && (
                <div className="bg-charcoal-500 rounded-xl border border-gold-500/20 shadow-md shadow-black/10 overflow-hidden">
                  <div className="px-6 py-4 border-b border-sage-500/20">
                    <div className="flex items-center justify-between">
                      <h2 className="font-serif font-bold text-xl text-cream-500 flex items-center gap-3">
                        <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-gold-500" />
                        </div>
                        Create Dual Subtitle
                      </h2>
                      <button
                        onClick={() => setShowDualCreator(!showDualCreator)}
                        className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                          showDualCreator 
                            ? 'bg-charcoal-400 text-mist-500 hover:bg-charcoal-400/80' 
                            : 'bg-gold-500 text-black hover:bg-gold-400'
                        }`}
                      >
                        {showDualCreator ? (
                          <>
                            <X className="w-4 h-4" />
                            Close
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Create
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-6">
                    {!showDualCreator ? (
                      <div className="bg-gold-500/10 border border-gold-500/20 rounded-xl p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gold-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Languages className="w-6 h-6 text-gold-500" />
                          </div>
                          <div>
                            <h3 className="font-medium text-cream-500 mb-2">
                              {subtitles.external_subtitles.length} files available
                            </h3>
                            <p className="text-sm text-mist-500 mb-3">
                              Combine any two subtitles with custom styling
                            </p>
                            <ul className="space-y-1 text-sm text-mist-500">
                              <li className="flex items-center gap-2">
                                <Check className="w-3 h-3 text-success-500" />
                                <span>Custom positioning</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="w-3 h-3 text-success-500" />
                                <span>Color & size control</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="w-3 h-3 text-success-500" />
                                <span>Auto-sync support</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <DualSubtitleCreator
                        episodeId={episodeId!}
                        subtitles={subtitles.external_subtitles}
                        onCreated={() => {
                          refetchSubtitles();
                          setShowDualCreator(false);
                          showToast({
                            title: "Success",
                            description: "Dual subtitle created successfully",
                            variant: "success"
                          });
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Show prompt to upload more if only 1 subtitle */}
              {subtitles?.external_subtitles && subtitles.external_subtitles.length === 1 && (
                <div className="bg-charcoal-500/50 rounded-xl border border-sage-500/20 p-6">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-mist-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-cream-500 font-medium text-sm mb-1">
                        Need one more subtitle
                      </p>
                      <p className="text-mist-500 text-xs">
                        Upload or extract another subtitle file to enable dual subtitle creation
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};