import React from 'react';
import { HardDrive, Check, X } from 'lucide-react';

interface Subtitles {
  file_path?: string;
  naming_pattern?: string;
}

interface FileInfoBarProps {
  subtitles?: Subtitles;
}

export const FileInfoBar: React.FC<FileInfoBarProps> = ({ subtitles }) => {
  return (
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
  );
};