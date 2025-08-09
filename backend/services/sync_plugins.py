"""
Plugin architecture for subtitle synchronization methods
"""

import subprocess
import shutil
import tempfile
import sys
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import pysubs2
# Add backend directory to path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from exceptions import (
    SubtitleSyncError,
    FFSubSyncNotFoundError,
    SubtitleFormatError
)
from config import settings


class SyncMethod(Enum):
    """Available synchronization methods"""
    FFSUBSYNC = "ffsubsync"
    MANUAL_OFFSET = "manual_offset"
    AUTO_ALIGN = "auto_align"
    NONE = "none"


@dataclass
class SyncResult:
    """Result of a synchronization operation"""
    success: bool
    method: SyncMethod
    output_path: str
    offset_ms: Optional[int] = None
    confidence: Optional[float] = None
    error: Optional[str] = None
    details: Optional[Dict] = None


class SyncPlugin(ABC):
    """Abstract base class for synchronization plugins"""
    
    @abstractmethod
    def get_method(self) -> SyncMethod:
        """Return the sync method this plugin implements"""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if this sync method is available on the system"""
        pass
    
    @abstractmethod
    def sync(self, reference_path: str, target_path: str, output_path: str, **kwargs) -> SyncResult:
        """
        Synchronize target subtitle to reference
        
        Args:
            reference_path: Path to reference subtitle (or video for some methods)
            target_path: Path to subtitle to be synchronized
            output_path: Path where synchronized subtitle should be saved
            **kwargs: Additional method-specific parameters
            
        Returns:
            SyncResult with details of the synchronization
        """
        pass
    
    @abstractmethod
    def get_description(self) -> str:
        """Return a human-readable description of this sync method"""
        pass


class FFSubSyncPlugin(SyncPlugin):
    """Plugin for ffsubsync-based synchronization"""
    
    def get_method(self) -> SyncMethod:
        return SyncMethod.FFSUBSYNC
    
    def is_available(self) -> bool:
        """Check if ffsubsync is installed"""
        return shutil.which('ffsubsync') is not None
    
    def get_description(self) -> str:
        return "Audio-based synchronization using ffsubsync (most accurate)"
    
    def sync(self, reference_path: str, target_path: str, output_path: str, **kwargs) -> SyncResult:
        """Synchronize using ffsubsync"""
        
        if not self.is_available():
            raise FFSubSyncNotFoundError()
        
        max_offset = kwargs.get('max_offset_seconds', settings.subtitle.max_sync_offset_seconds)
        timeout = kwargs.get('timeout', settings.subtitle.sync_timeout_seconds)
        
        try:
            # Build ffsubsync command
            cmd = [
                'ffsubsync',
                str(reference_path),
                '-i', str(target_path),
                '-o', str(output_path),
                '--max-offset-seconds', str(max_offset),
                '--no-fix-framerate'
            ]
            
            # Run ffsubsync with timeout
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            if result.returncode == 0 and Path(output_path).exists():
                # Try to extract offset from output
                offset_ms = self._extract_offset_from_output(result.stdout)
                
                return SyncResult(
                    success=True,
                    method=SyncMethod.FFSUBSYNC,
                    output_path=output_path,
                    offset_ms=offset_ms,
                    confidence=0.95,  # ffsubsync is generally very accurate
                    details={'stdout': result.stdout}
                )
            else:
                error_msg = result.stderr.strip() if result.stderr else 'Unknown ffsubsync error'
                return SyncResult(
                    success=False,
                    method=SyncMethod.FFSUBSYNC,
                    output_path=output_path,
                    error=f"ffsubsync failed: {error_msg}",
                    details={'stderr': result.stderr, 'returncode': result.returncode}
                )
                
        except subprocess.TimeoutExpired:
            return SyncResult(
                success=False,
                method=SyncMethod.FFSUBSYNC,
                output_path=output_path,
                error=f"ffsubsync timed out after {timeout} seconds"
            )
        except Exception as e:
            return SyncResult(
                success=False,
                method=SyncMethod.FFSUBSYNC,
                output_path=output_path,
                error=f"Unexpected error: {str(e)}"
            )
    
    def _extract_offset_from_output(self, output: str) -> Optional[int]:
        """Try to extract the applied offset from ffsubsync output"""
        # ffsubsync usually reports offset in its output
        # This is a simplified parser - adjust based on actual output format
        import re
        match = re.search(r'offset:\s*([-\d.]+)\s*seconds', output, re.IGNORECASE)
        if match:
            return int(float(match.group(1)) * 1000)
        return None


class ManualOffsetPlugin(SyncPlugin):
    """Plugin for manual offset-based synchronization"""
    
    def get_method(self) -> SyncMethod:
        return SyncMethod.MANUAL_OFFSET
    
    def is_available(self) -> bool:
        """Manual offset is always available"""
        return True
    
    def get_description(self) -> str:
        return "Manual time offset adjustment (simple but requires known offset)"
    
    def sync(self, reference_path: str, target_path: str, output_path: str, **kwargs) -> SyncResult:
        """Apply manual offset to subtitle timing"""
        
        offset_ms = kwargs.get('offset_ms', 0)
        
        if offset_ms == 0:
            # No offset to apply, just copy the file
            shutil.copy2(target_path, output_path)
            return SyncResult(
                success=True,
                method=SyncMethod.MANUAL_OFFSET,
                output_path=output_path,
                offset_ms=0,
                confidence=1.0
            )
        
        try:
            # Load subtitle file
            subs = pysubs2.load(target_path)
            
            # Apply offset to all subtitle entries
            for line in subs:
                line.start += offset_ms
                line.end += offset_ms
                
                # Ensure no negative timestamps
                if line.start < 0:
                    line.start = 0
                if line.end < 0:
                    line.end = 0
            
            # Save adjusted subtitle
            subs.save(output_path)
            
            return SyncResult(
                success=True,
                method=SyncMethod.MANUAL_OFFSET,
                output_path=output_path,
                offset_ms=offset_ms,
                confidence=1.0,  # Manual offset is exact
                details={'lines_adjusted': len(subs)}
            )
            
        except Exception as e:
            return SyncResult(
                success=False,
                method=SyncMethod.MANUAL_OFFSET,
                output_path=output_path,
                error=f"Failed to apply offset: {str(e)}"
            )


class AutoAlignPlugin(SyncPlugin):
    """Plugin for automatic alignment based on subtitle overlap analysis"""
    
    def get_method(self) -> SyncMethod:
        return SyncMethod.AUTO_ALIGN
    
    def is_available(self) -> bool:
        """Auto-align is always available as it's pure Python"""
        return True
    
    def get_description(self) -> str:
        return "Automatic alignment based on subtitle timing patterns (fallback method)"
    
    def sync(self, reference_path: str, target_path: str, output_path: str, **kwargs) -> SyncResult:
        """
        Attempt to align subtitles based on timing patterns.
        This is a simplified version - could be enhanced with more sophisticated algorithms.
        """
        
        try:
            ref_subs = pysubs2.load(reference_path)
            target_subs = pysubs2.load(target_path)
            
            if not ref_subs or not target_subs:
                raise SubtitleFormatError(target_path, "Empty subtitle file")
            
            # Calculate average offset based on first few subtitles
            offset_samples = []
            sample_size = min(10, len(ref_subs), len(target_subs))
            
            for i in range(sample_size):
                if i < len(ref_subs) and i < len(target_subs):
                    offset = ref_subs[i].start - target_subs[i].start
                    offset_samples.append(offset)
            
            if not offset_samples:
                # No samples available, can't align
                shutil.copy2(target_path, output_path)
                return SyncResult(
                    success=True,
                    method=SyncMethod.AUTO_ALIGN,
                    output_path=output_path,
                    offset_ms=0,
                    confidence=0.1,
                    details={'reason': 'No alignment samples available'}
                )
            
            # Use median offset to reduce impact of outliers
            offset_samples.sort()
            median_offset = offset_samples[len(offset_samples) // 2]
            
            # Apply the calculated offset
            for line in target_subs:
                line.start += median_offset
                line.end += median_offset
                
                # Ensure no negative timestamps
                if line.start < 0:
                    line.start = 0
                if line.end < 0:
                    line.end = 0
            
            # Save aligned subtitle
            target_subs.save(output_path)
            
            # Calculate confidence based on offset consistency
            offset_variance = sum((o - median_offset) ** 2 for o in offset_samples) / len(offset_samples)
            confidence = max(0.3, min(0.8, 1.0 - (offset_variance / 1000000)))  # Normalize variance
            
            return SyncResult(
                success=True,
                method=SyncMethod.AUTO_ALIGN,
                output_path=output_path,
                offset_ms=median_offset,
                confidence=confidence,
                details={
                    'samples_used': len(offset_samples),
                    'offset_variance': offset_variance
                }
            )
            
        except Exception as e:
            return SyncResult(
                success=False,
                method=SyncMethod.AUTO_ALIGN,
                output_path=output_path,
                error=f"Auto-alignment failed: {str(e)}"
            )


class SubtitleSynchronizer:
    """Main synchronizer that manages all sync plugins"""
    
    def __init__(self):
        self.plugins: List[SyncPlugin] = [
            FFSubSyncPlugin(),
            AutoAlignPlugin(),
            ManualOffsetPlugin()
        ]
        self._available_methods = None
    
    @property
    def available_methods(self) -> List[SyncMethod]:
        """Get list of available sync methods"""
        if self._available_methods is None:
            self._available_methods = [
                plugin.get_method() 
                for plugin in self.plugins 
                if plugin.is_available()
            ]
        return self._available_methods
    
    def get_plugin(self, method: SyncMethod) -> Optional[SyncPlugin]:
        """Get plugin for specific sync method"""
        for plugin in self.plugins:
            if plugin.get_method() == method and plugin.is_available():
                return plugin
        return None
    
    def sync_subtitles(
        self,
        reference_path: str,
        target_path: str,
        output_path: str,
        method: Optional[SyncMethod] = None,
        fallback: bool = True,
        **kwargs
    ) -> SyncResult:
        """
        Synchronize subtitles using specified or best available method
        
        Args:
            reference_path: Reference subtitle or video file
            target_path: Subtitle file to synchronize
            output_path: Output path for synchronized subtitle
            method: Specific sync method to use (None for auto-select)
            fallback: Whether to try fallback methods if primary fails
            **kwargs: Additional method-specific parameters
            
        Returns:
            SyncResult with synchronization details
        """
        
        # Determine methods to try
        methods_to_try = []
        
        if method:
            if method in self.available_methods:
                methods_to_try = [method]
            else:
                raise SubtitleSyncError(
                    f"Sync method {method.value} is not available",
                    fallback_available=len(self.available_methods) > 0
                )
        else:
            # Try methods in order of preference
            preferred_order = [SyncMethod.FFSUBSYNC, SyncMethod.AUTO_ALIGN, SyncMethod.MANUAL_OFFSET]
            methods_to_try = [m for m in preferred_order if m in self.available_methods]
        
        if not methods_to_try:
            raise SubtitleSyncError("No synchronization methods available")
        
        # Try each method
        last_error = None
        for sync_method in methods_to_try:
            plugin = self.get_plugin(sync_method)
            if not plugin:
                continue
            
            try:
                print(f"Attempting sync with {sync_method.value}...")
                result = plugin.sync(reference_path, target_path, output_path, **kwargs)
                
                if result.success:
                    print(f"Successfully synchronized using {sync_method.value}")
                    return result
                else:
                    last_error = result.error
                    print(f"Sync failed with {sync_method.value}: {result.error}")
                    
                    if not fallback:
                        return result
                        
            except Exception as e:
                last_error = str(e)
                print(f"Error with {sync_method.value}: {e}")
                
                if not fallback:
                    raise
        
        # All methods failed
        return SyncResult(
            success=False,
            method=methods_to_try[0] if methods_to_try else SyncMethod.NONE,
            output_path=output_path,
            error=f"All sync methods failed. Last error: {last_error}"
        )
    
    def get_method_descriptions(self) -> Dict[SyncMethod, str]:
        """Get descriptions of all available methods"""
        descriptions = {}
        for plugin in self.plugins:
            if plugin.is_available():
                descriptions[plugin.get_method()] = plugin.get_description()
        return descriptions