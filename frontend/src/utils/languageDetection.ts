// Helper to extract language from filename patterns
export const extractLanguageFromFilename = (filename: string): string | null => {
  const patterns = [
    /\.([a-z]{2})\.(srt|ass|vtt|sub)$/i,           // file.en.srt
    /\.([a-z]{2}-[a-z]{2})\.(srt|ass|vtt|sub)$/i, // file.en-US.srt
    /\.([a-z]{3})\.(srt|ass|vtt|sub)$/i,          // file.eng.srt
    /_([a-z]{2})\.(srt|ass|vtt|sub)$/i,           // file_en.srt
    /-([a-z]{2})\.(srt|ass|vtt|sub)$/i,           // file-en.srt
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  return null;
};