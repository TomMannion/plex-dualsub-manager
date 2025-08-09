"""
Custom exceptions for Plex Dual Subtitle Manager
"""

from typing import Optional, Dict, Any


class DualSubError(Exception):
    """Base exception for all dual subtitle errors"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class SubtitleError(DualSubError):
    """Base exception for subtitle-related errors"""
    pass


class SubtitleSyncError(SubtitleError):
    """Exception raised when subtitle synchronization fails"""
    
    def __init__(self, message: str, fallback_available: bool = False, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, details)
        self.fallback_available = fallback_available


class FFSubSyncNotFoundError(SubtitleSyncError):
    """Exception raised when ffsubsync is not available"""
    
    def __init__(self):
        super().__init__(
            "ffsubsync not found. Please install with: pip install ffsubsync",
            fallback_available=True,
            details={"install_command": "pip install ffsubsync"}
        )


class SubtitleFormatError(SubtitleError):
    """Exception raised for invalid subtitle formats"""
    
    def __init__(self, file_path: str, expected_format: Optional[str] = None):
        message = f"Invalid subtitle format: {file_path}"
        if expected_format:
            message += f" (expected: {expected_format})"
        super().__init__(message, {"file_path": file_path, "expected_format": expected_format})


class SubtitleEncodingError(SubtitleError):
    """Exception raised when subtitle encoding cannot be detected or decoded"""
    
    def __init__(self, file_path: str, encoding: Optional[str] = None):
        message = f"Cannot decode subtitle file: {file_path}"
        if encoding:
            message += f" (tried encoding: {encoding})"
        super().__init__(message, {"file_path": file_path, "encoding": encoding})


class LanguageDetectionError(SubtitleError):
    """Exception raised when language detection fails"""
    
    def __init__(self, file_path: str, reason: str):
        super().__init__(
            f"Failed to detect language for {file_path}: {reason}",
            {"file_path": file_path, "reason": reason}
        )


class PlexError(DualSubError):
    """Base exception for Plex-related errors"""
    pass


class PlexConnectionError(PlexError):
    """Exception raised when connection to Plex server fails"""
    
    def __init__(self, url: str, reason: str):
        super().__init__(
            f"Failed to connect to Plex server at {url}: {reason}",
            {"url": url, "reason": reason}
        )


class PlexAuthenticationError(PlexError):
    """Exception raised when Plex authentication fails"""
    
    def __init__(self):
        super().__init__(
            "Plex authentication failed. Please check your token.",
            {"help": "Set PLEX_TOKEN environment variable or update .env file"}
        )


class FileOperationError(DualSubError):
    """Exception raised for file operation errors"""
    
    def __init__(self, operation: str, file_path: str, reason: str):
        super().__init__(
            f"File operation '{operation}' failed for {file_path}: {reason}",
            {"operation": operation, "file_path": file_path, "reason": reason}
        )


class VideoProcessingError(DualSubError):
    """Exception raised when video processing fails"""
    
    def __init__(self, video_path: str, operation: str, reason: str):
        super().__init__(
            f"Video processing failed for {video_path} during {operation}: {reason}",
            {"video_path": video_path, "operation": operation, "reason": reason}
        )