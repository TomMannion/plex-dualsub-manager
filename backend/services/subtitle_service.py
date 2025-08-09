"""
Subtitle Service - handles subtitle file operations and dual subtitle creation
"""

import pysubs2
import chardet
import ffmpeg
from pathlib import Path
from typing import Dict, Optional, Tuple, List
import re
from dataclasses import dataclass
from enum import Enum
import unicodedata
import subprocess
import tempfile
import shutil

class SubtitlePosition(Enum):
    TOP = "top"
    BOTTOM = "bottom"
    
class SubtitleFormat(Enum):
    SRT = "srt"
    ASS = "ass"
    SSA = "ssa"

@dataclass
class DualSubtitleConfig:
    """Configuration for dual subtitle creation"""
    # Primary subtitle (usually native language)
    primary_position: SubtitlePosition = SubtitlePosition.BOTTOM
    primary_color: str = "&HFFFFFF"  # White in ASS format
    primary_font_size: int = 20
    primary_margin_v: int = 20  # Vertical margin from edge
    
    # Secondary subtitle (usually translation)
    secondary_position: SubtitlePosition = SubtitlePosition.TOP
    secondary_color: str = "&HFFFF00"  # Yellow in ASS format
    secondary_font_size: int = 18
    secondary_margin_v: int = 20
    
    # General settings
    output_format: SubtitleFormat = SubtitleFormat.ASS
    font_name: str = "Arial"
    bold: bool = False
    italic: bool = False
    border_style: int = 1  # 1 = outline + drop shadow, 3 = opaque box
    outline_width: int = 2
    shadow_depth: int = 1
    
    # For SRT format (simpler)
    srt_primary_prefix: str = ""  # e.g., "[JA] "
    srt_secondary_prefix: str = ""  # e.g., "[EN] "

class LanguageDetector:
    """Advanced language detection for CJK and English subtitle text"""
    
    # Unicode ranges for different writing systems
    HIRAGANA_RANGE = (0x3040, 0x309F)
    KATAKANA_RANGE = (0x30A0, 0x30FF)
    CJK_UNIFIED_RANGE = (0x4E00, 0x9FFF)  # Main CJK characters
    CJK_EXT_A_RANGE = (0x3400, 0x4DBF)   # CJK Extension A
    
    # Common characters that help distinguish Traditional vs Simplified
    TRADITIONAL_INDICATORS = {
        '這', '個', '來', '對', '時', '會', '學', '說', '國', '們', '現', '開',
        '關', '進', '過', '還', '應', '經', '長', '實', '發', '點', '間', '問',
        '題', '機', '車', '電', '話', '見', '聽', '買', '賣', '錢', '業', '東',
        '風', '雲', '龍', '鳳', '馬', '魚', '鳥', '書', '學', '醫', '藥'
    }
    
    SIMPLIFIED_INDICATORS = {
        '这', '个', '来', '对', '时', '会', '学', '说', '国', '们', '现', '开',
        '关', '进', '过', '还', '应', '经', '长', '实', '发', '点', '间', '问',
        '题', '机', '车', '电', '话', '见', '听', '买', '卖', '钱', '业', '东',
        '风', '云', '龙', '凤', '马', '鱼', '鸟', '书', '学', '医', '药'
    }
    
    # Common Japanese-specific characters (beyond hiragana/katakana)
    JAPANESE_PARTICLES = {'は', 'が', 'を', 'に', 'へ', 'で', 'と', 'も', 'の', 'か'}
    JAPANESE_COMMON = {'です', 'ます', 'った', 'いる', 'ある', 'する', 'なる', 'いう', 'れる', 'られる'}
    
    @staticmethod
    def detect_language(text: str, declared_lang: Optional[str] = None) -> Dict:
        """
        Detect language from subtitle text with high accuracy for CJK languages
        Returns: {
            'detected': 'ja'|'zh-CN'|'zh-TW'|'en'|'unknown',
            'confidence': float (0-1),
            'script_analysis': dict,
            'declared_lang': str,
            'recommendation': str
        }
        """
        if not text or len(text.strip()) < 3:
            return {
                'detected': 'unknown',
                'confidence': 0.0,
                'script_analysis': {},
                'declared_lang': declared_lang,
                'recommendation': declared_lang or 'en'
            }
        
        # Clean text for analysis
        clean_text = re.sub(r'[^\w\s\u3000-\u9FFF]', '', text)
        total_chars = len(clean_text.replace(' ', ''))
        
        if total_chars == 0:
            return {
                'detected': 'en',
                'confidence': 0.5,
                'script_analysis': {'ascii_only': True},
                'declared_lang': declared_lang,
                'recommendation': declared_lang or 'en'
            }
        
        # Count different character types
        hiragana_count = sum(1 for char in clean_text if LanguageDetector.HIRAGANA_RANGE[0] <= ord(char) <= LanguageDetector.HIRAGANA_RANGE[1])
        katakana_count = sum(1 for char in clean_text if LanguageDetector.KATAKANA_RANGE[0] <= ord(char) <= LanguageDetector.KATAKANA_RANGE[1])
        cjk_count = sum(1 for char in clean_text if LanguageDetector.CJK_UNIFIED_RANGE[0] <= ord(char) <= LanguageDetector.CJK_UNIFIED_RANGE[1])
        ascii_count = sum(1 for char in clean_text if ord(char) < 128)
        
        # Count Traditional vs Simplified indicators
        traditional_score = sum(1 for char in clean_text if char in LanguageDetector.TRADITIONAL_INDICATORS)
        simplified_score = sum(1 for char in clean_text if char in LanguageDetector.SIMPLIFIED_INDICATORS)
        
        # Japanese-specific markers
        japanese_particle_count = sum(1 for word in LanguageDetector.JAPANESE_PARTICLES if word in text)
        japanese_common_count = sum(1 for word in LanguageDetector.JAPANESE_COMMON if word in text)
        
        # Calculate percentages
        hiragana_pct = hiragana_count / total_chars if total_chars > 0 else 0
        katakana_pct = katakana_count / total_chars if total_chars > 0 else 0
        cjk_pct = cjk_count / total_chars if total_chars > 0 else 0
        ascii_pct = ascii_count / total_chars if total_chars > 0 else 0
        
        script_analysis = {
            'total_chars': total_chars,
            'hiragana_count': hiragana_count,
            'katakana_count': katakana_count,
            'cjk_count': cjk_count,
            'ascii_count': ascii_count,
            'hiragana_pct': hiragana_pct,
            'katakana_pct': katakana_pct,
            'cjk_pct': cjk_pct,
            'ascii_pct': ascii_pct,
            'traditional_score': traditional_score,
            'simplified_score': simplified_score,
            'japanese_markers': japanese_particle_count + japanese_common_count
        }
        
        # Detection logic
        confidence = 0.0
        detected = 'unknown'
        
        # If mostly ASCII, likely English
        if ascii_pct > 0.8:
            detected = 'en'
            confidence = min(0.9, ascii_pct)
        
        # If has significant CJK content, analyze Chinese vs Japanese
        elif cjk_pct > 0.3:
            # Check for Chinese indicators first (more reliable)
            if traditional_score > 5 or simplified_score > 5:
                # Strong Chinese indicators found
                if traditional_score > simplified_score:
                    detected = 'zh-TW'
                    confidence = 0.8 + min(0.2, traditional_score / max(1, cjk_count) * 20)
                else:
                    detected = 'zh-CN' 
                    confidence = 0.8 + min(0.2, simplified_score / max(1, cjk_count) * 20)
            
            # Only classify as Japanese if we have strong Japanese indicators AND low Chinese indicators
            elif (hiragana_pct > 0.05 or japanese_particle_count > 2) and traditional_score < 3 and simplified_score < 3:
                detected = 'ja'
                confidence = 0.9 + min(0.1, hiragana_pct * 2)
            
            # Fallback Chinese detection for CJK heavy content
            elif traditional_score > simplified_score and traditional_score > 0:
                detected = 'zh-TW'
                confidence = 0.7 + min(0.3, traditional_score / max(1, cjk_count) * 10)
            elif simplified_score > 0:
                detected = 'zh-CN'
                confidence = 0.7 + min(0.3, simplified_score / max(1, cjk_count) * 10)
            else:
                # Has CJK but no clear indicators - default to Chinese (more common)
                detected = 'zh-CN'
                confidence = 0.6
        
        # Light hiragana with some Japanese particles - likely Japanese
        elif hiragana_pct > 0.05 or japanese_particle_count > 0:
            detected = 'ja'
            confidence = 0.9 + min(0.1, hiragana_pct * 2)
        
        # Mixed scripts might be Japanese with kanji (but only if low Chinese indicators)
        elif cjk_pct > 0.1 and (hiragana_pct > 0.01 or katakana_pct > 0.01) and traditional_score < 3 and simplified_score < 3:
            detected = 'ja'
            confidence = 0.8
        
        # Fallback for edge cases
        else:
            detected = 'en'
            confidence = 0.4
        
        # Adjust confidence based on declared language agreement
        recommendation = detected
        if declared_lang:
            # Normalize declared language codes
            declared_normalized = LanguageDetector.normalize_lang_code(declared_lang)
            if declared_normalized == detected:
                confidence = min(1.0, confidence + 0.1)  # Boost confidence
            elif confidence < 0.7:
                # If detection confidence is low, trust declaration more
                recommendation = declared_normalized
                confidence = 0.6
        
        return {
            'detected': detected,
            'confidence': confidence,
            'script_analysis': script_analysis,
            'declared_lang': declared_lang,
            'recommendation': recommendation
        }
    
    @staticmethod
    def normalize_lang_code(lang_code: str) -> str:
        """Normalize language codes to our standard format"""
        if not lang_code:
            return 'en'
        
        lang_code = lang_code.lower().strip()
        
        # Handle common variations
        mapping = {
            'chinese': 'zh-CN',
            'mandarin': 'zh-CN',
            'simplified': 'zh-CN',
            'traditional': 'zh-TW',
            'cantonese': 'zh-TW',
            'japanese': 'ja',
            'english': 'en',
            'zh': 'zh-CN',  # Default Chinese to Simplified
            'cn': 'zh-CN',
            'tw': 'zh-TW',
            'hk': 'zh-TW',
            'jp': 'ja',
        }
        
        return mapping.get(lang_code, lang_code)
    
    @staticmethod
    def analyze_subtitle_file(subtitle_path: str, declared_lang: Optional[str] = None) -> Dict:
        """Analyze entire subtitle file for language detection"""
        try:
            subs = pysubs2.load(subtitle_path)
            
            # Sample up to 50 lines for analysis (performance)
            sample_lines = subs[:50] if len(subs) > 50 else subs
            
            # Combine text from multiple lines
            combined_text = ' '.join([line.text for line in sample_lines if line.text.strip()])
            
            # Remove common subtitle formatting
            clean_text = re.sub(r'<[^>]+>', '', combined_text)  # Remove HTML tags
            clean_text = re.sub(r'\{[^}]+\}', '', clean_text)   # Remove ASS formatting
            clean_text = re.sub(r'\\N', ' ', clean_text)        # Remove ASS line breaks
            
            result = LanguageDetector.detect_language(clean_text, declared_lang)
            result['sample_lines'] = len(sample_lines)
            result['total_lines'] = len(subs)
            
            return result
            
        except Exception as e:
            return {
                'detected': 'unknown',
                'confidence': 0.0,
                'error': str(e),
                'declared_lang': declared_lang,
                'recommendation': declared_lang or 'en'
            }

class SubtitleService:
    
    # Language-specific font mapping for better CJK support
    LANGUAGE_FONTS = {
        'ja': ['NotoSansCJK-Regular', 'Hiragino Sans', 'MS Gothic', 'Arial Unicode MS', 'Arial'],
        'zh-CN': ['NotoSansCJK-Regular', 'Microsoft YaHei', 'SimSun', 'Arial Unicode MS', 'Arial'],
        'zh-TW': ['NotoSansCJK-Regular', 'Microsoft JhengHei', 'PMingLiU', 'Arial Unicode MS', 'Arial'],
        'en': ['Arial', 'Helvetica', 'sans-serif'],
        'default': ['Arial', 'sans-serif']
    }
    
    @staticmethod
    def get_optimal_font(language: str) -> str:
        """Get the best font for a given language"""
        return SubtitleService.LANGUAGE_FONTS.get(language, SubtitleService.LANGUAGE_FONTS['default'])[0]
    
    @staticmethod
    def detect_and_enhance_config(primary_path: str, secondary_path: str, config: DualSubtitleConfig, 
                                 declared_primary_lang: Optional[str] = None, 
                                 declared_secondary_lang: Optional[str] = None) -> Tuple[DualSubtitleConfig, Dict]:
        """
        Detect languages and enhance configuration with language-specific optimizations
        Returns: (enhanced_config, detection_report)
        """
        # Detect languages
        primary_analysis = LanguageDetector.analyze_subtitle_file(primary_path, declared_primary_lang)
        secondary_analysis = LanguageDetector.analyze_subtitle_file(secondary_path, declared_secondary_lang)
        
        # Create enhanced config copy
        enhanced_config = DualSubtitleConfig(
            primary_position=config.primary_position,
            secondary_position=config.secondary_position,
            primary_color=config.primary_color,
            secondary_color=config.secondary_color,
            primary_font_size=config.primary_font_size,
            secondary_font_size=config.secondary_font_size,
            primary_margin_v=config.primary_margin_v,
            secondary_margin_v=config.secondary_margin_v,
            output_format=config.output_format,
            bold=config.bold,
            italic=config.italic,
            border_style=config.border_style,
            outline_width=config.outline_width,
            shadow_depth=config.shadow_depth,
            srt_primary_prefix=config.srt_primary_prefix,
            srt_secondary_prefix=config.srt_secondary_prefix,
        )
        
        # Apply language-specific enhancements
        primary_lang = primary_analysis['recommendation']
        secondary_lang = secondary_analysis['recommendation']
        
        # Optimize font selection
        enhanced_config.font_name = SubtitleService.get_optimal_font(primary_lang)
        
        # Adjust font sizes for CJK languages (they often need to be larger)
        if primary_lang in ['ja', 'zh-CN', 'zh-TW'] and config.primary_font_size <= 20:
            enhanced_config.primary_font_size = max(22, config.primary_font_size + 2)
        
        if secondary_lang in ['ja', 'zh-CN', 'zh-TW'] and config.secondary_font_size <= 18:
            enhanced_config.secondary_font_size = max(20, config.secondary_font_size + 2)
        
        # Adjust margins for better CJK display
        if primary_lang in ['ja', 'zh-CN', 'zh-TW']:
            enhanced_config.primary_margin_v = max(25, config.primary_margin_v + 5)
        if secondary_lang in ['ja', 'zh-CN', 'zh-TW']:
            enhanced_config.secondary_margin_v = max(25, config.secondary_margin_v + 5)
        
        # Set up SRT prefixes based on detected languages
        if config.output_format == SubtitleFormat.SRT:
            enhanced_config.srt_primary_prefix = SubtitleService.get_language_prefix(primary_lang)
            enhanced_config.srt_secondary_prefix = SubtitleService.get_language_prefix(secondary_lang)
        
        detection_report = {
            'primary_analysis': primary_analysis,
            'secondary_analysis': secondary_analysis,
            'enhancements_applied': {
                'font_optimized': True,
                'font_name': enhanced_config.font_name,
                'font_size_adjusted': {
                    'primary': enhanced_config.primary_font_size != config.primary_font_size,
                    'secondary': enhanced_config.secondary_font_size != config.secondary_font_size,
                },
                'margins_adjusted': {
                    'primary': enhanced_config.primary_margin_v != config.primary_margin_v,
                    'secondary': enhanced_config.secondary_margin_v != config.secondary_margin_v,
                },
                'srt_prefixes_set': config.output_format == SubtitleFormat.SRT
            }
        }
        
        return enhanced_config, detection_report
    
    @staticmethod
    def get_language_prefix(lang_code: str) -> str:
        """Get appropriate SRT prefix for language"""
        prefixes = {
            'en': '[EN] ',
            'ja': '[JA] ',
            'zh-CN': '[CN] ',
            'zh-TW': '[TW] ',
            'ko': '[KO] ',
            'fr': '[FR] ',
            'es': '[ES] ',
            'de': '[DE] ',
        }
        return prefixes.get(lang_code, f'[{lang_code.upper()}] ')
    
    @staticmethod
    def extract_embedded_subtitle(video_path: str, stream_index: int, output_path: str) -> Dict:
        """Extract an embedded subtitle stream from video file"""
        try:
            print(f"Extracting subtitle: video_path={video_path}, stream_index={stream_index}, output_path={output_path}")
            
            # Use ffmpeg to extract subtitle
            # Use absolute stream index (Plex stream index corresponds to ffmpeg stream index)
            # ffmpeg expects format like "0:11" for stream selection
            input_stream = ffmpeg.input(video_path)
            output = ffmpeg.output(
                input_stream, 
                output_path,
                **{'map': f'0:{stream_index}', 'f': 'srt'}  # Force SRT format for compatibility
            )
            
            # Run with verbose output for debugging
            print(f"Running ffmpeg command: {ffmpeg.compile(output)}")
            ffmpeg.run(output, overwrite_output=True, quiet=False)
            
            return {
                'success': True,
                'output_path': output_path,
                'stream_index': stream_index
            }
        except ffmpeg.Error as e:
            error_msg = f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}"
            print(f"FFmpeg extraction failed: {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }
        except Exception as e:
            error_msg = f"General error: {str(e)}"
            print(f"Extraction failed: {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }
    
    @staticmethod
    def get_video_duration_ms(video_path: str) -> Optional[int]:
        """Get video duration in milliseconds using ffmpeg"""
        try:
            probe = ffmpeg.probe(video_path)
            duration = float(probe['streams'][0]['duration'])
            return int(duration * 1000)
        except Exception as e:
            print(f"Warning: Could not get video duration: {e}")
            return None
    
    @staticmethod
    def validate_subtitle_sync(subtitle_path: str, video_path: str) -> Dict:
        """Check if subtitle timing matches video duration"""
        video_duration_ms = SubtitleService.get_video_duration_ms(video_path)
        if not video_duration_ms:
            return {
                'valid': None,
                'warning': 'Could not determine video duration'
            }
        
        try:
            subs = SubtitleService.load_subtitle(subtitle_path)
            if not subs:
                return {'valid': False, 'error': 'No subtitles found'}
            
            # Get last subtitle end time
            last_subtitle_end = max(line.end for line in subs)
            
            # Check if subtitles extend beyond video
            if last_subtitle_end > video_duration_ms + 5000:  # 5 second tolerance
                return {
                    'valid': False,
                    'warning': f'Subtitles end {(last_subtitle_end - video_duration_ms) / 1000:.1f}s after video ends',
                    'subtitle_duration_ms': last_subtitle_end,
                    'video_duration_ms': video_duration_ms,
                    'suggested_offset_ms': video_duration_ms - last_subtitle_end
                }
            
            # Check if subtitles are too short
            if last_subtitle_end < video_duration_ms - 30000:  # 30 second tolerance  
                return {
                    'valid': False,
                    'warning': f'Subtitles end {(video_duration_ms - last_subtitle_end) / 1000:.1f}s before video ends',
                    'subtitle_duration_ms': last_subtitle_end,
                    'video_duration_ms': video_duration_ms,
                    'suggested_offset_ms': video_duration_ms - last_subtitle_end
                }
            
            return {
                'valid': True,
                'subtitle_duration_ms': last_subtitle_end,
                'video_duration_ms': video_duration_ms
            }
            
        except Exception as e:
            return {'valid': False, 'error': str(e)}
    
    @staticmethod
    def sync_subtitles_with_ffsubsync(reference_path: str, target_path: str, output_path: str) -> Dict:
        """Synchronize target subtitle file to reference using ffsubsync"""
        try:
            print(f"Synchronizing {Path(target_path).name} to {Path(reference_path).name}...")
            
            # Check if ffsubsync is available
            try:
                result = subprocess.run(['ffsubsync', '--version'], 
                                      capture_output=True, text=True, timeout=10)
                if result.returncode != 0:
                    return {
                        'success': False,
                        'error': 'ffsubsync not found. Please install with: pip install ffsubsync',
                        'fallback_available': True
                    }
            except (subprocess.TimeoutExpired, FileNotFoundError):
                return {
                    'success': False,
                    'error': 'ffsubsync not available or not responding',
                    'fallback_available': True
                }
            
            # Run ffsubsync
            cmd = [
                'ffsubsync',
                str(reference_path),
                '-i', str(target_path),
                '-o', str(output_path),
                '--max-offset-seconds', '60',  # Allow up to 60 seconds offset
                '--no-fix-framerate'  # Don't change framerate
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            
            if result.returncode == 0:
                # Verify output file was created and has content
                if Path(output_path).exists() and Path(output_path).stat().st_size > 0:
                    print(f"Successfully synchronized {Path(target_path).name}!")
                    return {
                        'success': True,
                        'synchronized': True,
                        'output_path': output_path,
                        'method': 'ffsubsync'
                    }
                else:
                    return {
                        'success': False,
                        'error': 'ffsubsync completed but no output file created',
                        'fallback_available': True
                    }
            else:
                error_msg = result.stderr.strip() if result.stderr else 'Unknown ffsubsync error'
                print(f"ffsubsync failed: {error_msg}")
                return {
                    'success': False,
                    'error': f'ffsubsync failed: {error_msg}',
                    'fallback_available': True
                }
                
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'ffsubsync timed out (>120s)',
                'fallback_available': True
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Synchronization error: {str(e)}',
                'fallback_available': True
            }

    @staticmethod
    def adjust_subtitle_timing(subtitle_path: str, offset_ms: int, output_path: str) -> Dict:
        """Adjust subtitle timing by offset (positive = delay, negative = advance)"""
        try:
            subs = SubtitleService.load_subtitle(subtitle_path)
            
            # Apply offset to all subtitles
            for line in subs:
                line.start += offset_ms
                line.end += offset_ms
                
                # Ensure no negative timestamps
                if line.start < 0:
                    line.start = 0
                if line.end < 0:
                    line.end = 0
            
            # Save adjusted subtitles
            subs.save(output_path)
            
            return {
                'success': True,
                'offset_applied_ms': offset_ms,
                'offset_applied_seconds': offset_ms / 1000,
                'output_path': output_path
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def detect_encoding(file_path: str) -> str:
        """Detect the character encoding of a subtitle file"""
        with open(file_path, 'rb') as f:
            raw_data = f.read()
            result = chardet.detect(raw_data)
            return result['encoding'] or 'utf-8'
    
    @staticmethod
    def load_subtitle(file_path: str, encoding: Optional[str] = None) -> pysubs2.SSAFile:
        """Load a subtitle file with automatic encoding detection"""
        if not encoding:
            encoding = SubtitleService.detect_encoding(file_path)
        
        try:
            subs = pysubs2.load(file_path, encoding=encoding)
        except Exception as e:
            # Fallback to UTF-8 with error handling
            subs = pysubs2.load(file_path, encoding='utf-8', errors='replace')
        
        return subs
    
    @staticmethod
    def convert_color_to_ass(hex_color: str) -> str:
        """Convert hex color (#RRGGBB) to ASS format (&HBBGGRR)"""
        if hex_color.startswith('#'):
            hex_color = hex_color[1:]
        
        # Convert RRGGBB to BBGGRR
        if len(hex_color) == 6:
            r = hex_color[0:2]
            g = hex_color[2:4]
            b = hex_color[4:6]
            ass_color = f"&H{b}{g}{r}"
            print(f"Color conversion: {hex_color} -> {ass_color}")
            return ass_color
        
        print(f"Invalid color format: {hex_color}, using white")
        return "&HFFFFFF"  # Default to white
    
    @staticmethod
    def create_ass_style(name: str, config: DualSubtitleConfig, is_primary: bool) -> Dict:
        """Create an ASS style dictionary for pysubs2"""
        if is_primary:
            color = config.primary_color
            font_size = config.primary_font_size
            # For stacked subtitles at bottom:
            # If primary is "bottom" position, it gets lower margin (closer to edge)
            # If primary is "top" position, it gets higher margin (closer to center)
            if config.primary_position == SubtitlePosition.BOTTOM:
                margin_v = 20  # Lower position in the stack
            else:
                margin_v = 60  # Higher position in the stack
            alignment = 2  # Always bottom-center alignment
        else:
            color = config.secondary_color
            font_size = config.secondary_font_size
            # For stacked subtitles at bottom:
            # If secondary is "bottom" position, it gets lower margin (closer to edge)
            # If secondary is "top" position, it gets higher margin (closer to center)
            if config.secondary_position == SubtitlePosition.BOTTOM:
                margin_v = 20  # Lower position in the stack
            else:
                margin_v = 60  # Higher position in the stack
            alignment = 2  # Always bottom-center alignment
        
        # ASS color format - ensure proper conversion
        if color.startswith("&H"):
            primary_color = color
        else:
            primary_color = SubtitleService.convert_color_to_ass(color)
        
        return {
            'fontname': config.font_name,
            'fontsize': font_size,
            'primarycolor': primary_color,  # Main text color
            'secondarycolor': primary_color,  # Same as primary (not used much)
            'outlinecolor': "&H00000000",  # Black outline  
            'backcolor': "&H80000000",  # Semi-transparent black shadow
            'bold': -1 if config.bold else 0,
            'italic': -1 if config.italic else 0,
            'underline': 0,
            'strikeout': 0,
            'scalex': 100,
            'scaley': 100,
            'spacing': 0,
            'angle': 0,
            'borderstyle': 1,  # Outline + drop shadow
            'outline': 2,  # 2px outline
            'shadow': 1,  # 1px shadow
            'alignment': alignment,
            'marginl': 10,
            'marginr': 10,
            'marginv': margin_v,
            'encoding': 1
        }
    
    @staticmethod
    def create_dual_subtitle_ass(
        primary_path: str,
        secondary_path: str,
        output_path: str,
        config: DualSubtitleConfig,
        enable_sync: bool = True
    ) -> Dict:
        """Create a dual subtitle in ASS format with full customization and optional synchronization"""
        
        sync_report = {'attempted': False, 'successful': False}
        actual_secondary_path = secondary_path
        
        # Attempt synchronization if enabled
        if enable_sync:
            try:
                sync_report['attempted'] = True
                
                # Create temporary file for synchronized secondary subtitle
                with tempfile.NamedTemporaryFile(suffix='.srt', delete=False) as tmp_file:
                    temp_sync_path = tmp_file.name
                
                # Try to synchronize secondary subtitle to primary
                sync_result = SubtitleService.sync_subtitles_with_ffsubsync(
                    primary_path, secondary_path, temp_sync_path
                )
                
                if sync_result['success']:
                    actual_secondary_path = temp_sync_path
                    sync_report['successful'] = True
                    sync_report['method'] = 'ffsubsync'
                    print(f"Using synchronized secondary subtitle")
                else:
                    sync_report['error'] = sync_result['error']
                    print(f"Synchronization failed, using original timing: {sync_result['error']}")
                    # Clean up temp file if sync failed
                    try:
                        Path(temp_sync_path).unlink()
                    except:
                        pass
                    
            except Exception as e:
                sync_report['error'] = str(e)
                print(f"Synchronization attempt failed: {e}")
        
        try:
            # Load both subtitle files
            primary_subs = SubtitleService.load_subtitle(primary_path)
            secondary_subs = SubtitleService.load_subtitle(actual_secondary_path)
            
            # Create new ASS file
            dual_subs = pysubs2.SSAFile()
            
            # Define styles
            dual_subs.styles["Primary"] = pysubs2.SSAStyle(**SubtitleService.create_ass_style("Primary", config, True))
            dual_subs.styles["Secondary"] = pysubs2.SSAStyle(**SubtitleService.create_ass_style("Secondary", config, False))
            
            # Add primary subtitles
            for line in primary_subs:
                new_line = pysubs2.SSAEvent(
                    start=line.start,
                    end=line.end,
                    text=line.text,
                    style="Primary"
                )
                dual_subs.append(new_line)
            
            # Add secondary subtitles
            for line in secondary_subs:
                new_line = pysubs2.SSAEvent(
                    start=line.start,
                    end=line.end,
                    text=line.text,
                    style="Secondary"
                )
                dual_subs.append(new_line)
            
            # Sort by timestamp
            dual_subs.sort()
            
            # Save the file
            dual_subs.save(output_path)
            
            # Clean up temporary synchronized file
            if sync_report['successful'] and actual_secondary_path != secondary_path:
                try:
                    Path(actual_secondary_path).unlink()
                except:
                    pass
            
            return {
                'success': True,
                'output_path': output_path,
                'primary_lines': len(primary_subs),
                'secondary_lines': len(secondary_subs),
                'total_lines': len(dual_subs),
                'format': 'ASS',
                'sync_report': sync_report
            }
            
        except Exception as e:
            # Clean up temporary file on error
            if sync_report['successful'] and actual_secondary_path != secondary_path:
                try:
                    Path(actual_secondary_path).unlink()
                except:
                    pass
            raise e
    
    @staticmethod
    def create_dual_subtitle_srt(
        primary_path: str,
        secondary_path: str,
        output_path: str,
        config: DualSubtitleConfig,
        enable_sync: bool = True
    ) -> Dict:
        """Create a dual subtitle in SRT format with prefixes and optional synchronization"""
        
        sync_report = {'attempted': False, 'successful': False}
        actual_secondary_path = secondary_path
        
        # Attempt synchronization if enabled
        if enable_sync:
            try:
                sync_report['attempted'] = True
                
                # Create temporary file for synchronized secondary subtitle
                with tempfile.NamedTemporaryFile(suffix='.srt', delete=False) as tmp_file:
                    temp_sync_path = tmp_file.name
                
                # Try to synchronize secondary subtitle to primary
                sync_result = SubtitleService.sync_subtitles_with_ffsubsync(
                    primary_path, secondary_path, temp_sync_path
                )
                
                if sync_result['success']:
                    actual_secondary_path = temp_sync_path
                    sync_report['successful'] = True
                    sync_report['method'] = 'ffsubsync'
                    print(f"Using synchronized secondary subtitle")
                else:
                    sync_report['error'] = sync_result['error']
                    print(f"Synchronization failed, using original timing: {sync_result['error']}")
                    # Clean up temp file if sync failed
                    try:
                        Path(temp_sync_path).unlink()
                    except:
                        pass
                        
            except Exception as e:
                sync_report['error'] = str(e)
                print(f"Synchronization attempt failed: {e}")
        
        try:
            # Load both subtitle files
            primary_subs = SubtitleService.load_subtitle(primary_path)
            secondary_subs = SubtitleService.load_subtitle(actual_secondary_path)
            
            # Create new SRT file
            dual_subs = pysubs2.SSAFile()
            
            # Add primary subtitles with prefix
            for line in primary_subs:
                text = line.text
                if config.srt_primary_prefix:
                    text = config.srt_primary_prefix + text
                
                new_line = pysubs2.SSAEvent(
                    start=line.start,
                    end=line.end,
                    text=text
                )
                dual_subs.append(new_line)
            
            # Add secondary subtitles with prefix  
            for line in secondary_subs:
                text = line.text
                if config.srt_secondary_prefix:
                    text = config.srt_secondary_prefix + text
                    
                # For SRT, combine with existing subtitle at same time if overlap
                overlapping = False
                for existing in dual_subs:
                    if (existing.start <= line.start <= existing.end or 
                        existing.start <= line.end <= existing.end):
                        # Add secondary as new line in same subtitle
                        existing.text = f"{existing.text}\\N{text}"
                        overlapping = True
                        break
                
                if not overlapping:
                    new_line = pysubs2.SSAEvent(
                        start=line.start,
                        end=line.end,
                        text=text
                    )
                    dual_subs.append(new_line)
            
            # Sort by timestamp
            dual_subs.sort()
            
            # Save as SRT
            dual_subs.save(output_path, format_='srt')
            
            # Clean up temporary synchronized file
            if sync_report['successful'] and actual_secondary_path != secondary_path:
                try:
                    Path(actual_secondary_path).unlink()
                except:
                    pass
            
            return {
                'success': True,
                'output_path': output_path,
                'primary_lines': len(primary_subs),
                'secondary_lines': len(secondary_subs),
                'total_lines': len(dual_subs),
                'format': 'SRT',
                'sync_report': sync_report
            }
            
        except Exception as e:
            # Clean up temporary file on error
            if sync_report['successful'] and actual_secondary_path != secondary_path:
                try:
                    Path(actual_secondary_path).unlink()
                except:
                    pass
            raise e
    
    @staticmethod
    def create_dual_subtitle(
        primary_path: str,
        secondary_path: str,
        output_path: str,
        config: Optional[DualSubtitleConfig] = None,
        video_path: Optional[str] = None,
        declared_primary_lang: Optional[str] = None,
        declared_secondary_lang: Optional[str] = None,
        enable_language_detection: bool = True,
        enable_sync: bool = True
    ) -> Dict:
        """Main method to create dual subtitle with given configuration and automatic language detection"""
        
        if config is None:
            config = DualSubtitleConfig()
        
        # Determine output format from file extension if not specified
        output_ext = Path(output_path).suffix.lower()
        if output_ext == '.srt':
            config.output_format = SubtitleFormat.SRT
        elif output_ext in ['.ass', '.ssa']:
            config.output_format = SubtitleFormat.ASS
        
        # Enhance configuration with language detection
        detection_report = None
        if enable_language_detection:
            try:
                config, detection_report = SubtitleService.detect_and_enhance_config(
                    primary_path, secondary_path, config, declared_primary_lang, declared_secondary_lang
                )
            except Exception as e:
                # If language detection fails, continue with original config
                detection_report = {'error': f'Language detection failed: {str(e)}'}
        
        # Validate sync with video if provided
        sync_warnings = []
        if video_path:
            primary_sync = SubtitleService.validate_subtitle_sync(primary_path, video_path)
            secondary_sync = SubtitleService.validate_subtitle_sync(secondary_path, video_path)
            
            if not primary_sync.get('valid'):
                sync_warnings.append(f"Primary subtitle sync issue: {primary_sync.get('warning', primary_sync.get('error'))}")
            
            if not secondary_sync.get('valid'):
                sync_warnings.append(f"Secondary subtitle sync issue: {secondary_sync.get('warning', secondary_sync.get('error'))}")
        
        
        try:
            if config.output_format == SubtitleFormat.SRT:
                result = SubtitleService.create_dual_subtitle_srt(
                    primary_path, secondary_path, output_path, config, enable_sync=enable_sync
                )
            else:
                result = SubtitleService.create_dual_subtitle_ass(
                    primary_path, secondary_path, output_path, config, enable_sync=enable_sync
                )
            
            # Add additional information to result
            if sync_warnings:
                result['sync_warnings'] = sync_warnings
            
            if detection_report:
                result['language_detection'] = detection_report
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'sync_warnings': sync_warnings if sync_warnings else None
            }
    
    @staticmethod
    def preview_dual_subtitle(
        primary_path: str,
        secondary_path: str,
        config: Optional[DualSubtitleConfig] = None,
        preview_lines: int = 5
    ) -> Dict:
        """Generate a preview of the dual subtitle without saving"""
        
        if config is None:
            config = DualSubtitleConfig()
        
        # Load subtitles
        primary_subs = SubtitleService.load_subtitle(primary_path)
        secondary_subs = SubtitleService.load_subtitle(secondary_path)
        
        # Get first few lines
        primary_preview = []
        for i, line in enumerate(primary_subs):
            if i >= preview_lines:
                break
            primary_preview.append({
                'time': f"{pysubs2.time.ms_to_str(line.start)} --> {pysubs2.time.ms_to_str(line.end)}",
                'text': line.text
            })
        
        secondary_preview = []
        for i, line in enumerate(secondary_subs):
            if i >= preview_lines:
                break
            secondary_preview.append({
                'time': f"{pysubs2.time.ms_to_str(line.start)} --> {pysubs2.time.ms_to_str(line.end)}",
                'text': line.text
            })
        
        return {
            'primary': primary_preview,
            'secondary': secondary_preview,
            'config': {
                'primary_position': config.primary_position.value,
                'primary_color': config.primary_color,
                'primary_font_size': config.primary_font_size,
                'secondary_position': config.secondary_position.value,
                'secondary_color': config.secondary_color,
                'secondary_font_size': config.secondary_font_size,
                'output_format': config.output_format.value
            }
        }

# Singleton instance
subtitle_service = SubtitleService()