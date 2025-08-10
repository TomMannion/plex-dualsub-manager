import React, { useState } from 'react';
import { ChevronDown, X, Languages as LanguagesIcon } from 'lucide-react';
import { LANGUAGES, getLanguageDisplayName } from '../utils/languages';

interface Language {
  code: string;
  name: string;
  nativeName?: string;
  commonCodes: string[];
}

interface LanguageFilterProps {
  selectedLanguages: Language[];
  onLanguagesChange: (languages: Language[]) => void;
  maxSelections?: number;
}

export const LanguageFilter: React.FC<LanguageFilterProps> = ({
  selectedLanguages,
  onLanguagesChange,
  maxSelections = 2
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter languages based on search term
  const filteredLanguages = LANGUAGES.filter(lang =>
    lang.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (lang.nativeName && lang.nativeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    lang.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lang.commonCodes.some(code => code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleLanguageToggle = (language: Language) => {
    const isSelected = selectedLanguages.some(l => l.code === language.code);
    
    if (isSelected) {
      // Remove language
      onLanguagesChange(selectedLanguages.filter(l => l.code !== language.code));
    } else if (selectedLanguages.length < maxSelections) {
      // Add language
      onLanguagesChange([...selectedLanguages, language]);
    }
  };

  const handleRemoveLanguage = (languageCode: string) => {
    onLanguagesChange(selectedLanguages.filter(l => l.code !== languageCode));
  };

  const clearAll = () => {
    onLanguagesChange([]);
    setSearchTerm('');
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-charcoal-500 border border-sage-500/30 text-cream-500 rounded-xl px-4 py-4 
                 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50
                 font-light transition-all duration-200 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <LanguagesIcon className="w-5 h-5 text-mist-500" />
          <div className="text-left">
            {selectedLanguages.length === 0 ? (
              <span className="text-mist-500">Filter by languages</span>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {selectedLanguages.map(lang => (
                  <span
                    key={lang.code}
                    className="inline-flex items-center gap-1 bg-gold-500/20 text-gold-500 px-2 py-1 rounded-lg text-sm"
                  >
                    {lang.name}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLanguage(lang.code);
                      }}
                      className="hover:bg-gold-500/30 rounded transition-colors p-0.5 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveLanguage(lang.code);
                        }
                      }}
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-mist-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-charcoal-500 border border-sage-500/30 rounded-xl shadow-xl z-50 max-h-80 overflow-hidden">
          {/* Search Box */}
          <div className="p-4 border-b border-sage-500/20">
            <input
              type="text"
              placeholder="Search languages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-500 border border-sage-500/30 text-cream-500 rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50
                       placeholder:text-mist-500 text-sm"
            />
          </div>

          {/* Header */}
          <div className="p-3 border-b border-sage-500/20 bg-slate-500/50">
            <div className="flex items-center justify-between">
              <span className="text-cream-500 text-sm font-medium">
                Select up to {maxSelections} languages
              </span>
              {selectedLanguages.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-gold-500 hover:text-cream-500 text-sm transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Language List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredLanguages.length === 0 ? (
              <div className="p-4 text-center text-mist-500">
                No languages found
              </div>
            ) : (
              <div className="p-2">
                {filteredLanguages.map(language => {
                  const isSelected = selectedLanguages.some(l => l.code === language.code);
                  const isDisabled = !isSelected && selectedLanguages.length >= maxSelections;
                  
                  return (
                    <button
                      key={language.code}
                      onClick={() => handleLanguageToggle(language)}
                      disabled={isDisabled}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-150 flex items-center justify-between group ${
                        isSelected
                          ? 'bg-gold-500/20 text-gold-500 border border-gold-500/30'
                          : isDisabled
                            ? 'text-mist-500/50 cursor-not-allowed'
                            : 'text-cream-500 hover:bg-sage-500/20'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {language.name}
                        </span>
                        {language.nativeName && (
                          <span className="text-xs opacity-70">
                            {language.nativeName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs opacity-60 font-mono">
                          {language.code}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 bg-gold-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-charcoal-500 rounded-full" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};