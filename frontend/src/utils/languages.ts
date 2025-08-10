/**
 * Language definitions for subtitle filtering
 */

export interface Language {
  code: string;
  name: string;
  nativeName?: string;
  commonCodes: string[];
}

export const LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    commonCodes: ['en', 'eng', 'english']
  },
  {
    code: 'zh',
    name: 'Chinese (Simplified)',
    nativeName: '中文 (简体)',
    commonCodes: ['zh', 'zh-cn', 'zh-hans', 'zhs', 'chi', 'chinese', 'chs']
  },
  {
    code: 'zh-Hant',
    name: 'Chinese (Traditional)',
    nativeName: '中文 (繁體)',
    commonCodes: ['zh-tw', 'zh-hk', 'zh-hant', 'zht', 'cht', 'tc', 'traditional']
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    commonCodes: ['es', 'spa', 'spanish', 'espanol']
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    commonCodes: ['fr', 'fre', 'fra', 'french', 'francais']
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    commonCodes: ['de', 'ger', 'deu', 'german', 'deutsch']
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    commonCodes: ['ja', 'jp', 'jpn', 'japanese']
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    commonCodes: ['ko', 'kr', 'kor', 'korean']
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    commonCodes: ['pt', 'por', 'portuguese']
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    commonCodes: ['it', 'ita', 'italian']
  }
];

/**
 * Get language by code (case insensitive)
 */
export function getLanguageByCode(code: string): Language | undefined {
  const normalizedCode = code.toLowerCase().trim();
  return LANGUAGES.find(lang => 
    lang.code.toLowerCase() === normalizedCode ||
    lang.commonCodes.some(c => c.toLowerCase() === normalizedCode)
  );
}

/**
 * Extract language codes from a filename
 */
export function extractLanguageFromFilename(filename: string): Language[] {
  const foundLanguages: Language[] = [];
  const normalizedFilename = filename.toLowerCase();
  
  const parts = normalizedFilename.split('.');
  
  for (const part of parts) {
    if (part.match(/^(srt|ass|vtt|sub|idx|ssa|txt|s\d+e\d+|\d+x\d+)$/)) {
      continue;
    }
    
    const language = getLanguageByCode(part);
    if (language && !foundLanguages.find(l => l.code === language.code)) {
      foundLanguages.push(language);
    }
  }
  
  return foundLanguages;
}

/**
 * Check if a filename contains specific language codes
 */
export function filenameContainsLanguages(filename: string, languageCodes: string[]): boolean {
  const detectedLanguages = extractLanguageFromFilename(filename);
  const detectedCodes = detectedLanguages.map(l => l.code);
  
  return languageCodes.every(code => 
    detectedCodes.includes(code) ||
    detectedLanguages.some(lang => lang.commonCodes.includes(code.toLowerCase()))
  );
}

/**
 * Get display name for a language
 */
export function getLanguageDisplayName(language: Language): string {
  return language.nativeName ? `${language.name} (${language.nativeName})` : language.name;
}