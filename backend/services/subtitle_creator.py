"""
Refactored dual subtitle creation service
"""

import tempfile
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, Optional, Tuple, List
import pysubs2
import ffmpeg
# Add backend directory to path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from config import settings
from exceptions import (
    SubtitleError,
    SubtitleFormatError,
    VideoProcessingError,
    FileOperationError
)
from services.sync_plugins import SubtitleSynchronizer, SyncMethod
from services.language_detector import SimpleLanguageDetector, Language


class SubtitlePosition(Enum):
    """Position for subtitle display"""
    TOP = "top"
    BOTTOM = "bottom"


class SubtitleFormat(Enum):
    """Output subtitle format"""
    SRT = "srt"
    ASS = "ass"
    SSA = "ssa"


@dataclass
class DualSubtitleConfig:
    """Configuration for dual subtitle creation"""
    
    # Format
    output_format: SubtitleFormat = SubtitleFormat.ASS
    
    # Positioning
    primary_position: SubtitlePosition = SubtitlePosition.BOTTOM
    secondary_position: SubtitlePosition = SubtitlePosition.TOP
    
    # Styling (for ASS format)
    primary_color: str = "#FFFFFF"
    secondary_color: str = "#FFFF00"
    primary_font_size: int = 20
    secondary_font_size: int = 18
    primary_margin_v: int = 20
    secondary_margin_v: int = 60
    font_name: str = "Arial"
    bold: bool = False
    italic: bool = False
    border_style: int = 1
    outline_width: int = 2
    shadow_depth: int = 1
    
    # SRT format options
    srt_primary_prefix: str = ""
    srt_secondary_prefix: str = ""
    
    # Processing options
    enable_sync: bool = True
    enable_language_detection: bool = True
    sync_method: Optional[SyncMethod] = None
    
    # Language hints
    primary_language: Optional[str] = None
    secondary_language: Optional[str] = None


@dataclass
class DualSubtitleResult:
    """Result of dual subtitle creation"""
    success: bool
    output_path: str
    primary_lines: int = 0
    secondary_lines: int = 0
    total_lines: int = 0
    format: str = ""
    sync_performed: bool = False
    sync_method: Optional[str] = None
    languages_detected: Optional[Dict] = None
    warnings: List[str] = field(default_factory=list)
    error: Optional[str] = None


class DualSubtitleCreator:
    """Unified dual subtitle creator with improved architecture"""
    
    def __init__(self):
        self.synchronizer = SubtitleSynchronizer()
        self.language_detector = SimpleLanguageDetector()
        self.temp_files: List[Path] = []
    
    def create_dual_subtitle(
        self,
        primary_path: str,
        secondary_path: str,
        output_path: str,
        config: Optional[DualSubtitleConfig] = None,
        video_path: Optional[str] = None
    ) -> DualSubtitleResult:
        """
        Create dual subtitle file from two source files
        
        Args:
            primary_path: Path to primary subtitle file
            secondary_path: Path to secondary subtitle file
            output_path: Output path for dual subtitle
            config: Configuration for dual subtitle creation
            video_path: Optional video file for sync validation
            
        Returns:
            DualSubtitleResult with creation details
        """
        
        if config is None:
            config = DualSubtitleConfig()
        
        try:
            # Step 1: Detect languages if enabled
            languages_detected = None
            if config.enable_language_detection and settings.app.enable_language_detection:
                languages_detected = self._detect_languages(
                    primary_path, secondary_path,
                    config.primary_language, config.secondary_language
                )
                # Enhance config based on detected languages
                config = self._enhance_config_for_languages(config, languages_detected)
            
            # Step 2: Load and potentially synchronize subtitles
            primary_subs, secondary_subs, sync_info = self._load_and_sync_subtitles(
                primary_path, secondary_path, config, video_path
            )
            
            # Step 3: Validate with video if provided
            warnings = []
            if video_path:
                warnings = self._validate_video_sync(
                    primary_subs, secondary_subs, video_path
                )
            
            # Step 4: Merge subtitles based on format
            if config.output_format == SubtitleFormat.ASS:
                dual_subs = self._create_ass_dual(primary_subs, secondary_subs, config)
            else:  # SRT or other text formats
                dual_subs = self._create_srt_dual(primary_subs, secondary_subs, config)
            
            # Step 5: Save output
            self._save_subtitle(dual_subs, output_path, config.output_format)
            
            # Clean up temp files
            self._cleanup_temp_files()
            
            return DualSubtitleResult(
                success=True,
                output_path=output_path,
                primary_lines=len(primary_subs),
                secondary_lines=len(secondary_subs),
                total_lines=len(dual_subs),
                format=config.output_format.value,
                sync_performed=sync_info.get('performed', False),
                sync_method=sync_info.get('method'),
                languages_detected=languages_detected,
                warnings=warnings
            )
            
        except Exception as e:
            self._cleanup_temp_files()
            return DualSubtitleResult(
                success=False,
                output_path=output_path,
                error=str(e)
            )
    
    def _detect_languages(
        self,
        primary_path: str,
        secondary_path: str,
        declared_primary: Optional[str],
        declared_secondary: Optional[str]
    ) -> Dict:
        """Detect languages of subtitle files"""
        
        primary_result = self.language_detector.detect_from_file(
            Path(primary_path), declared_primary
        )
        secondary_result = self.language_detector.detect_from_file(
            Path(secondary_path), declared_secondary
        )
        
        return {
            'primary': {
                'language': primary_result.detected_language.value,
                'confidence': primary_result.confidence,
                'method': primary_result.method_used
            },
            'secondary': {
                'language': secondary_result.detected_language.value,
                'confidence': secondary_result.confidence,
                'method': secondary_result.method_used
            }
        }
    
    def _enhance_config_for_languages(
        self,
        config: DualSubtitleConfig,
        languages: Dict
    ) -> DualSubtitleConfig:
        """Enhance configuration based on detected languages"""
        
        primary_lang = Language(languages['primary']['language'])
        secondary_lang = Language(languages['secondary']['language'])
        
        # Get optimal font for detected languages
        primary_font = self.language_detector.get_optimal_font(primary_lang)
        secondary_font = self.language_detector.get_optimal_font(secondary_lang)
        
        # Use the more specific font if they differ
        if primary_font != 'Arial' or secondary_font != 'Arial':
            config.font_name = primary_font if primary_font != 'Arial' else secondary_font
        
        # Adjust font sizes for CJK languages
        cjk_languages = [
            Language.JAPANESE,
            Language.CHINESE_SIMPLIFIED,
            Language.CHINESE_TRADITIONAL,
            Language.KOREAN
        ]
        
        if primary_lang in cjk_languages:
            config.primary_font_size = max(22, config.primary_font_size)
            config.primary_margin_v = max(25, config.primary_margin_v)
        
        if secondary_lang in cjk_languages:
            config.secondary_font_size = max(20, config.secondary_font_size)
            config.secondary_margin_v = max(25, config.secondary_margin_v)
        
        # Set SRT prefixes if using SRT format
        if config.output_format == SubtitleFormat.SRT:
            if not config.srt_primary_prefix:
                config.srt_primary_prefix = f"[{primary_lang.value.upper()}] "
            if not config.srt_secondary_prefix:
                config.srt_secondary_prefix = f"[{secondary_lang.value.upper()}] "
        
        return config
    
    def _load_and_sync_subtitles(
        self,
        primary_path: str,
        secondary_path: str,
        config: DualSubtitleConfig
    ) -> Tuple[pysubs2.SSAFile, pysubs2.SSAFile, Dict]:
        """Load subtitle files and optionally synchronize them"""
        
        # Load primary subtitle
        primary_subs = self._load_subtitle(primary_path)
        
        sync_info = {'performed': False}
        
        # Synchronize secondary if enabled
        if config.enable_sync and settings.subtitle.enable_sync_by_default:
            try:
                # Create temp file for synchronized subtitle
                with tempfile.NamedTemporaryFile(suffix='.srt', delete=False) as tmp:
                    temp_sync_path = tmp.name
                    self.temp_files.append(Path(temp_sync_path))
                
                # Attempt synchronization
                sync_result = self.synchronizer.sync_subtitles(
                    reference_path=primary_path,
                    target_path=secondary_path,
                    output_path=temp_sync_path,
                    method=config.sync_method,
                    fallback=True
                )
                
                if sync_result.success:
                    secondary_subs = self._load_subtitle(temp_sync_path)
                    sync_info = {
                        'performed': True,
                        'method': sync_result.method.value,
                        'confidence': sync_result.confidence
                    }
                else:
                    # Sync failed, use original
                    secondary_subs = self._load_subtitle(secondary_path)
                    sync_info['error'] = sync_result.error
                    
            except Exception as e:
                # Sync failed, use original
                secondary_subs = self._load_subtitle(secondary_path)
                sync_info['error'] = str(e)
        else:
            # Sync disabled, load original
            secondary_subs = self._load_subtitle(secondary_path)
        
        return primary_subs, secondary_subs, sync_info
    
    def _load_subtitle(self, file_path: str) -> pysubs2.SSAFile:
        """Load subtitle file with encoding detection"""
        
        try:
            # Detect encoding
            encoding = self.language_detector.detect_encoding(Path(file_path))
            
            # Load subtitle
            subs = pysubs2.load(file_path, encoding=encoding)
            
            if not subs:
                raise SubtitleFormatError(file_path, "Empty subtitle file")
            
            return subs
            
        except Exception as e:
            raise SubtitleError(f"Failed to load subtitle {file_path}: {str(e)}")
    
    def _validate_video_sync(
        self,
        primary_subs: pysubs2.SSAFile,
        secondary_subs: pysubs2.SSAFile,
        video_path: str
    ) -> List[str]:
        """Validate subtitle timing against video duration"""
        
        warnings = []
        
        try:
            # Get video duration
            probe = ffmpeg.probe(video_path)
            video_duration_ms = int(float(probe['streams'][0]['duration']) * 1000)
            
            # Check primary subtitle
            if primary_subs:
                primary_end = max(line.end for line in primary_subs)
                if primary_end > video_duration_ms + settings.subtitle.video_sync_tolerance_ms:
                    warnings.append(
                        f"Primary subtitle extends {(primary_end - video_duration_ms) / 1000:.1f}s beyond video"
                    )
                elif primary_end < video_duration_ms - settings.subtitle.video_sync_warning_threshold_ms:
                    warnings.append(
                        f"Primary subtitle ends {(video_duration_ms - primary_end) / 1000:.1f}s before video"
                    )
            
            # Check secondary subtitle
            if secondary_subs:
                secondary_end = max(line.end for line in secondary_subs)
                if secondary_end > video_duration_ms + settings.subtitle.video_sync_tolerance_ms:
                    warnings.append(
                        f"Secondary subtitle extends {(secondary_end - video_duration_ms) / 1000:.1f}s beyond video"
                    )
                elif secondary_end < video_duration_ms - settings.subtitle.video_sync_warning_threshold_ms:
                    warnings.append(
                        f"Secondary subtitle ends {(video_duration_ms - secondary_end) / 1000:.1f}s before video"
                    )
                    
        except Exception as e:
            warnings.append(f"Could not validate video sync: {str(e)}")
        
        return warnings
    
    def _create_ass_dual(
        self,
        primary_subs: pysubs2.SSAFile,
        secondary_subs: pysubs2.SSAFile,
        config: DualSubtitleConfig
    ) -> pysubs2.SSAFile:
        """Create dual subtitle in ASS format"""
        
        dual_subs = pysubs2.SSAFile()
        
        # Create styles
        dual_subs.styles["Primary"] = self._create_ass_style("Primary", config, True)
        dual_subs.styles["Secondary"] = self._create_ass_style("Secondary", config, False)
        
        # Add primary subtitles
        for line in primary_subs:
            dual_subs.append(pysubs2.SSAEvent(
                start=line.start,
                end=line.end,
                text=line.text,
                style="Primary"
            ))
        
        # Add secondary subtitles
        for line in secondary_subs:
            dual_subs.append(pysubs2.SSAEvent(
                start=line.start,
                end=line.end,
                text=line.text,
                style="Secondary"
            ))
        
        # Sort by timestamp
        dual_subs.sort()
        
        return dual_subs
    
    def _create_srt_dual(
        self,
        primary_subs: pysubs2.SSAFile,
        secondary_subs: pysubs2.SSAFile,
        config: DualSubtitleConfig
    ) -> pysubs2.SSAFile:
        """Create dual subtitle in SRT format"""
        
        dual_subs = pysubs2.SSAFile()
        
        # Create a timeline of all subtitle events
        events = []
        
        # Add primary events
        for line in primary_subs:
            text = config.srt_primary_prefix + line.text if config.srt_primary_prefix else line.text
            events.append({
                'start': line.start,
                'end': line.end,
                'text': text,
                'type': 'primary'
            })
        
        # Add secondary events
        for line in secondary_subs:
            text = config.srt_secondary_prefix + line.text if config.srt_secondary_prefix else line.text
            events.append({
                'start': line.start,
                'end': line.end,
                'text': text,
                'type': 'secondary'
            })
        
        # Sort events by start time
        events.sort(key=lambda x: x['start'])
        
        # Merge overlapping events
        merged_events = []
        for event in events:
            # Check if this event overlaps with the last merged event
            if merged_events and event['start'] < merged_events[-1]['end']:
                last_event = merged_events[-1]
                # Combine the texts
                if event['type'] != last_event.get('type'):
                    # Different types, combine with line break
                    if config.primary_position == SubtitlePosition.TOP:
                        last_event['text'] = f"{event['text']}\\N{last_event['text']}"
                    else:
                        last_event['text'] = f"{last_event['text']}\\N{event['text']}"
                # Extend the end time if necessary
                last_event['end'] = max(last_event['end'], event['end'])
            else:
                merged_events.append(event.copy())
        
        # Create subtitle events
        for event in merged_events:
            dual_subs.append(pysubs2.SSAEvent(
                start=event['start'],
                end=event['end'],
                text=event['text']
            ))
        
        return dual_subs
    
    def _create_ass_style(
        self,
        name: str,
        config: DualSubtitleConfig,
        is_primary: bool
    ) -> pysubs2.SSAStyle:
        """Create ASS style for subtitle track"""
        
        if is_primary:
            color = self._convert_color_to_ass(config.primary_color)
            font_size = config.primary_font_size
            margin_v = config.primary_margin_v
        else:
            color = self._convert_color_to_ass(config.secondary_color)
            font_size = config.secondary_font_size
            margin_v = config.secondary_margin_v
        
        return pysubs2.SSAStyle(
            fontname=config.font_name,
            fontsize=font_size,
            primarycolor=color,
            secondarycolor=color,
            outlinecolor="&H00000000",  # Black outline
            backcolor="&H80000000",     # Semi-transparent shadow
            bold=-1 if config.bold else 0,
            italic=-1 if config.italic else 0,
            borderstyle=config.border_style,
            outline=config.outline_width,
            shadow=config.shadow_depth,
            alignment=2,  # Bottom-center
            marginl=10,
            marginr=10,
            marginv=margin_v,
            encoding=1
        )
    
    def _convert_color_to_ass(self, hex_color: str) -> str:
        """Convert hex color (#RRGGBB) to ASS format (&HBBGGRR)"""
        
        if hex_color.startswith('&H'):
            return hex_color
        
        if hex_color.startswith('#'):
            hex_color = hex_color[1:]
        
        if len(hex_color) == 6:
            r = hex_color[0:2]
            g = hex_color[2:4]
            b = hex_color[4:6]
            return f"&H{b}{g}{r}"
        
        return "&HFFFFFF"  # Default to white
    
    def _save_subtitle(
        self,
        subs: pysubs2.SSAFile,
        output_path: str,
        format: SubtitleFormat
    ):
        """Save subtitle file in specified format"""
        
        try:
            if format == SubtitleFormat.ASS:
                subs.save(output_path, format_='ass')
            elif format == SubtitleFormat.SSA:
                subs.save(output_path, format_='ssa')
            else:  # SRT
                subs.save(output_path, format_='srt')
        except Exception as e:
            raise FileOperationError("save", output_path, str(e))
    
    def _cleanup_temp_files(self):
        """Clean up temporary files created during processing"""
        
        for temp_file in self.temp_files:
            try:
                if temp_file.exists():
                    temp_file.unlink()
            except:
                pass  # Ignore cleanup errors
        
        self.temp_files.clear()