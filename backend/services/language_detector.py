"""
Simplified language detection for subtitle files
"""

import re
from pathlib import Path
from typing import Dict, Optional, List
from dataclasses import dataclass
from enum import Enum

import pysubs2
from langdetect import detect, LangDetectException
import chardet

import sys
from pathlib import Path
# Add backend directory to path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from exceptions import LanguageDetectionError, SubtitleEncodingError
from config import settings


class Language(Enum):
    """Supported languages with ISO 639-1 codes"""
    ENGLISH = "en"
    JAPANESE = "ja"
    CHINESE_SIMPLIFIED = "zh-CN"
    CHINESE_TRADITIONAL = "zh-TW"
    KOREAN = "ko"
    FRENCH = "fr"
    SPANISH = "es"
    GERMAN = "de"
    RUSSIAN = "ru"
    ITALIAN = "it"
    PORTUGUESE = "pt"
    UNKNOWN = "unknown"


@dataclass
class LanguageDetectionResult:
    """Result of language detection"""
    detected_language: Language
    confidence: float
    alternative_language: Optional[Language] = None
    sample_size: int = 0
    method_used: str = "unknown"
    details: Optional[Dict] = None


class SimpleLanguageDetector:
    """Simplified language detector using multiple strategies"""
    
    # Regex patterns for quick language identification
    PATTERNS = {
        Language.JAPANESE: re.compile(r'[\u3040-\u309f\u30a0-\u30ff]'),  # Hiragana & Katakana
        Language.KOREAN: re.compile(r'[\uac00-\ud7af\u1100-\u11ff]'),     # Hangul
        Language.CHINESE_SIMPLIFIED: re.compile(r'[\u4e00-\u9fff]'),      # CJK (needs further analysis)
        Language.CHINESE_TRADITIONAL: re.compile(r'[\u4e00-\u9fff]'),     # CJK (needs further analysis)
        Language.RUSSIAN: re.compile(r'[\u0400-\u04ff]'),                 # Cyrillic
    }
    
    # Characters more common in Traditional Chinese
    TRADITIONAL_INDICATORS = set('繁體國際電腦網絡軟體記憶體處理器圖畫機器學習訓練測試數據庫連線')
    # Characters more common in Simplified Chinese
    SIMPLIFIED_INDICATORS = set('简体国际电脑网络软体记忆体处理器图画机器学习训练测试数据库连线')
    
    def __init__(self):
        self.min_sample_size = 100  # Minimum characters for reliable detection
        self.max_sample_lines = 50  # Maximum subtitle lines to sample
    
    def detect_encoding(self, file_path: Path) -> str:
        """Detect file encoding"""
        try:
            with open(file_path, 'rb') as f:
                raw_data = f.read()
                result = chardet.detect(raw_data)
                return result['encoding'] or 'utf-8'
        except Exception as e:
            raise SubtitleEncodingError(str(file_path))
    
    def detect_from_file(self, file_path: Path, declared_lang: Optional[str] = None) -> LanguageDetectionResult:
        """
        Detect language from subtitle file
        
        Args:
            file_path: Path to subtitle file
            declared_lang: User-declared language (given higher weight)
            
        Returns:
            LanguageDetectionResult with detection details
        """
        
        if not settings.app.enable_language_detection:
            # Language detection disabled, use declared or default
            lang = self._normalize_language_code(declared_lang) if declared_lang else Language.ENGLISH
            return LanguageDetectionResult(
                detected_language=lang,
                confidence=1.0 if declared_lang else 0.5,
                method_used="config_disabled"
            )
        
        try:
            # Load subtitle file
            encoding = self.detect_encoding(file_path)
            subs = pysubs2.load(str(file_path), encoding=encoding)
            
            if not subs:
                raise LanguageDetectionError(str(file_path), "Empty subtitle file")
            
            # Extract sample text
            sample_text = self._extract_sample_text(subs)
            
            if len(sample_text) < self.min_sample_size:
                # Not enough text for reliable detection
                lang = self._normalize_language_code(declared_lang) if declared_lang else Language.UNKNOWN
                return LanguageDetectionResult(
                    detected_language=lang,
                    confidence=0.3,
                    sample_size=len(sample_text),
                    method_used="insufficient_sample"
                )
            
            # Try multiple detection strategies
            result = self._detect_with_multiple_strategies(sample_text, declared_lang)
            result.sample_size = len(sample_text)
            
            return result
            
        except Exception as e:
            if declared_lang:
                # Fall back to declared language
                return LanguageDetectionResult(
                    detected_language=self._normalize_language_code(declared_lang),
                    confidence=0.5,
                    method_used="fallback_to_declared",
                    details={"error": str(e)}
                )
            raise LanguageDetectionError(str(file_path), str(e))
    
    def _extract_sample_text(self, subs: pysubs2.SSAFile) -> str:
        """Extract representative sample text from subtitles"""
        
        # Sample from different parts of the file for better representation
        total_lines = len(subs)
        sample_indices = []
        
        if total_lines <= self.max_sample_lines:
            # Use all lines if file is small
            sample_indices = list(range(total_lines))
        else:
            # Sample evenly across the file
            step = total_lines // self.max_sample_lines
            sample_indices = list(range(0, total_lines, step))[:self.max_sample_lines]
        
        # Extract and clean text
        sample_lines = []
        for idx in sample_indices:
            if idx < total_lines:
                text = subs[idx].text
                # Remove formatting tags
                text = re.sub(r'\{[^}]*\}', '', text)  # ASS tags
                text = re.sub(r'<[^>]*>', '', text)    # HTML tags
                text = re.sub(r'\\N', ' ', text)       # Line breaks
                sample_lines.append(text)
        
        return ' '.join(sample_lines)
    
    def _detect_with_multiple_strategies(self, text: str, declared_lang: Optional[str]) -> LanguageDetectionResult:
        """Use multiple strategies to detect language"""
        
        # Strategy 1: Pattern-based detection for CJK and special scripts
        pattern_result = self._detect_by_patterns(text)
        
        # Strategy 2: Library-based detection (langdetect)
        library_result = self._detect_with_library(text)
        
        # Strategy 3: Consider declared language
        declared_normalized = self._normalize_language_code(declared_lang) if declared_lang else None
        
        # Combine results with weighted scoring
        if pattern_result and pattern_result.confidence > 0.7:
            # High confidence pattern match (especially for CJK)
            result = pattern_result
            
            # Boost confidence if it matches declaration
            if declared_normalized == result.detected_language:
                result.confidence = min(1.0, result.confidence + 0.1)
                
        elif library_result and library_result.confidence > 0.6:
            # Use library detection
            result = library_result
            
            # Adjust for Chinese variants if needed
            if result.detected_language in [Language.CHINESE_SIMPLIFIED, Language.CHINESE_TRADITIONAL]:
                result = self._refine_chinese_detection(text, result)
            
            # Consider declared language
            if declared_normalized and declared_normalized != result.detected_language:
                if result.confidence < 0.8:
                    # Low confidence, trust declaration more
                    result.alternative_language = result.detected_language
                    result.detected_language = declared_normalized
                    result.confidence = 0.6
                    
        else:
            # Low confidence from all methods
            if declared_normalized:
                result = LanguageDetectionResult(
                    detected_language=declared_normalized,
                    confidence=0.5,
                    method_used="declared_fallback"
                )
            else:
                result = LanguageDetectionResult(
                    detected_language=Language.UNKNOWN,
                    confidence=0.0,
                    method_used="no_detection"
                )
        
        return result
    
    def _detect_by_patterns(self, text: str) -> Optional[LanguageDetectionResult]:
        """Detect language using regex patterns"""
        
        matches = {}
        total_chars = len(text.replace(' ', ''))
        
        for lang, pattern in self.PATTERNS.items():
            found = pattern.findall(text)
            if found:
                matches[lang] = len(''.join(found))
        
        if not matches:
            return None
        
        # Find dominant language
        dominant_lang = max(matches, key=matches.get)
        dominant_count = matches[dominant_lang]
        confidence = min(0.95, dominant_count / max(total_chars, 1) * 2)  # Scale confidence
        
        # Special handling for Chinese variants
        if dominant_lang in [Language.CHINESE_SIMPLIFIED, Language.CHINESE_TRADITIONAL]:
            trad_count = sum(1 for char in text if char in self.TRADITIONAL_INDICATORS)
            simp_count = sum(1 for char in text if char in self.SIMPLIFIED_INDICATORS)
            
            if trad_count > simp_count:
                dominant_lang = Language.CHINESE_TRADITIONAL
            else:
                dominant_lang = Language.CHINESE_SIMPLIFIED
        
        # Check for Japanese (has both kana and kanji)
        if Language.JAPANESE in matches and dominant_lang in [Language.CHINESE_SIMPLIFIED, Language.CHINESE_TRADITIONAL]:
            # If we have kana, it's likely Japanese even with kanji present
            if matches[Language.JAPANESE] > 10:  # More than 10 kana characters
                dominant_lang = Language.JAPANESE
                confidence = 0.9
        
        return LanguageDetectionResult(
            detected_language=dominant_lang,
            confidence=confidence,
            method_used="pattern_matching",
            details={"matches": {lang.value: count for lang, count in matches.items()}}
        )
    
    def _detect_with_library(self, text: str) -> Optional[LanguageDetectionResult]:
        """Detect language using langdetect library"""
        
        try:
            detected = detect(text)
            
            # Map langdetect codes to our Language enum
            lang_map = {
                'en': Language.ENGLISH,
                'ja': Language.JAPANESE,
                'zh-cn': Language.CHINESE_SIMPLIFIED,
                'zh-tw': Language.CHINESE_TRADITIONAL,
                'ko': Language.KOREAN,
                'fr': Language.FRENCH,
                'es': Language.SPANISH,
                'de': Language.GERMAN,
                'ru': Language.RUSSIAN,
                'it': Language.ITALIAN,
                'pt': Language.PORTUGUESE,
            }
            
            # Handle Chinese detection (langdetect returns 'zh-cn' or 'zh-tw' sometimes, 'zh' others)
            if detected == 'zh':
                # Need to determine variant
                return LanguageDetectionResult(
                    detected_language=Language.CHINESE_SIMPLIFIED,  # Default to simplified
                    confidence=0.7,
                    method_used="langdetect",
                    details={"raw_detection": detected}
                )
            
            language = lang_map.get(detected, Language.UNKNOWN)
            
            return LanguageDetectionResult(
                detected_language=language,
                confidence=0.8 if language != Language.UNKNOWN else 0.3,
                method_used="langdetect",
                details={"raw_detection": detected}
            )
            
        except LangDetectException:
            return None
    
    def _refine_chinese_detection(self, text: str, initial_result: LanguageDetectionResult) -> LanguageDetectionResult:
        """Refine detection between Simplified and Traditional Chinese"""
        
        trad_count = sum(1 for char in text if char in self.TRADITIONAL_INDICATORS)
        simp_count = sum(1 for char in text if char in self.SIMPLIFIED_INDICATORS)
        
        if trad_count > simp_count * 1.5:  # Strong Traditional indicator
            initial_result.detected_language = Language.CHINESE_TRADITIONAL
            initial_result.confidence = min(0.9, initial_result.confidence + 0.1)
        elif simp_count > trad_count * 1.5:  # Strong Simplified indicator
            initial_result.detected_language = Language.CHINESE_SIMPLIFIED
            initial_result.confidence = min(0.9, initial_result.confidence + 0.1)
        else:
            # Ambiguous, reduce confidence
            initial_result.confidence *= 0.8
        
        initial_result.details = initial_result.details or {}
        initial_result.details.update({
            "traditional_indicators": trad_count,
            "simplified_indicators": simp_count
        })
        
        return initial_result
    
    def _normalize_language_code(self, lang_code: str) -> Language:
        """Normalize various language code formats to Language enum"""
        
        if not lang_code:
            return Language.UNKNOWN
        
        lang_code = lang_code.lower().strip()
        
        # Direct mapping
        direct_map = {
            'en': Language.ENGLISH,
            'eng': Language.ENGLISH,
            'english': Language.ENGLISH,
            'ja': Language.JAPANESE,
            'jpn': Language.JAPANESE,
            'japanese': Language.JAPANESE,
            'zh': Language.CHINESE_SIMPLIFIED,
            'zh-cn': Language.CHINESE_SIMPLIFIED,
            'chi': Language.CHINESE_SIMPLIFIED,
            'chinese': Language.CHINESE_SIMPLIFIED,
            'simplified': Language.CHINESE_SIMPLIFIED,
            'zh-tw': Language.CHINESE_TRADITIONAL,
            'zh-hk': Language.CHINESE_TRADITIONAL,
            'traditional': Language.CHINESE_TRADITIONAL,
            'ko': Language.KOREAN,
            'kor': Language.KOREAN,
            'korean': Language.KOREAN,
            'fr': Language.FRENCH,
            'fra': Language.FRENCH,
            'french': Language.FRENCH,
            'es': Language.SPANISH,
            'spa': Language.SPANISH,
            'spanish': Language.SPANISH,
            'de': Language.GERMAN,
            'ger': Language.GERMAN,
            'deu': Language.GERMAN,
            'german': Language.GERMAN,
            'ru': Language.RUSSIAN,
            'rus': Language.RUSSIAN,
            'russian': Language.RUSSIAN,
            'it': Language.ITALIAN,
            'ita': Language.ITALIAN,
            'italian': Language.ITALIAN,
            'pt': Language.PORTUGUESE,
            'por': Language.PORTUGUESE,
            'portuguese': Language.PORTUGUESE,
        }
        
        return direct_map.get(lang_code, Language.UNKNOWN)
    
    def get_optimal_font(self, language: Language) -> str:
        """Get recommended font for a language"""
        
        font_map = {
            Language.JAPANESE: 'Noto Sans CJK JP',
            Language.CHINESE_SIMPLIFIED: 'Noto Sans CJK SC',
            Language.CHINESE_TRADITIONAL: 'Noto Sans CJK TC',
            Language.KOREAN: 'Noto Sans CJK KR',
            Language.RUSSIAN: 'Noto Sans',
        }
        
        return font_map.get(language, 'Arial')