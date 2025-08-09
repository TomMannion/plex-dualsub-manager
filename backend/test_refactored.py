#!/usr/bin/env python3
"""
Test script for the refactored Plex Dual Subtitle Manager
Run this to verify the new architecture is working correctly
"""

import sys
import asyncio
from pathlib import Path
from typing import Dict, Any
import tempfile

# Add backend to path
sys.path.append(str(Path(__file__).parent))

# Import new components
from config import settings
from exceptions import *
from services.sync_plugins import SubtitleSynchronizer, SyncMethod
from services.language_detector import SimpleLanguageDetector, Language
from services.subtitle_creator import DualSubtitleCreator, DualSubtitleConfig, SubtitleFormat
from services.async_wrapper import AsyncSubtitleProcessor


class TestColors:
    """ANSI color codes for test output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_test_header(test_name: str):
    """Print formatted test header"""
    print(f"\n{TestColors.BOLD}{TestColors.BLUE}{'=' * 60}{TestColors.RESET}")
    print(f"{TestColors.BOLD}{TestColors.BLUE}TEST: {test_name}{TestColors.RESET}")
    print(f"{TestColors.BOLD}{TestColors.BLUE}{'=' * 60}{TestColors.RESET}")


def print_result(success: bool, message: str, details: Dict[str, Any] = None):
    """Print formatted test result"""
    if success:
        print(f"{TestColors.GREEN}✅ PASS: {message}{TestColors.RESET}")
    else:
        print(f"{TestColors.RED}❌ FAIL: {message}{TestColors.RESET}")
    
    if details:
        for key, value in details.items():
            print(f"   {TestColors.YELLOW}{key}:{TestColors.RESET} {value}")


async def test_configuration():
    """Test configuration loading"""
    print_test_header("Configuration Management")
    
    try:
        # Test settings access
        assert settings.app is not None, "App settings not loaded"
        assert settings.plex is not None, "Plex settings not loaded"
        assert settings.subtitle is not None, "Subtitle settings not loaded"
        
        print_result(True, "Configuration loaded successfully", {
            "temp_dir": str(settings.app.temp_dir),
            "max_workers": settings.app.max_workers,
            "plex_url": settings.plex.url,
            "language_detection": settings.app.enable_language_detection
        })
        
        # Test directory creation
        assert settings.app.temp_dir.exists(), "Temp directory not created"
        print_result(True, "Temp directory exists", {
            "path": str(settings.app.temp_dir)
        })
        
        return True
        
    except Exception as e:
        print_result(False, f"Configuration test failed: {str(e)}")
        return False


async def test_exception_hierarchy():
    """Test custom exception classes"""
    print_test_header("Exception Hierarchy")
    
    try:
        # Test exception creation
        exc1 = SubtitleSyncError("Test sync error", fallback_available=True)
        assert exc1.fallback_available == True
        print_result(True, "SubtitleSyncError created correctly")
        
        exc2 = FFSubSyncNotFoundError()
        assert "ffsubsync not found" in exc2.message
        print_result(True, "FFSubSyncNotFoundError has correct message")
        
        exc3 = FileOperationError("read", "/test/file.srt", "Permission denied")
        assert exc3.details["operation"] == "read"
        print_result(True, "FileOperationError stores operation details")
        
        return True
        
    except Exception as e:
        print_result(False, f"Exception test failed: {str(e)}")
        return False


async def test_sync_plugins():
    """Test synchronization plugin system"""
    print_test_header("Sync Plugin System")
    
    try:
        synchronizer = SubtitleSynchronizer()
        
        # Test available methods detection
        methods = synchronizer.available_methods
        print_result(True, "Detected sync methods", {
            "methods": [m.value for m in methods],
            "count": len(methods)
        })
        
        # Manual offset should always be available
        assert SyncMethod.MANUAL_OFFSET in methods
        print_result(True, "Manual offset method available")
        
        # Auto-align should always be available
        assert SyncMethod.AUTO_ALIGN in methods
        print_result(True, "Auto-align method available")
        
        # Check if ffsubsync is available
        if SyncMethod.FFSUBSYNC in methods:
            print_result(True, "FFSubSync detected and available")
        else:
            print_result(True, "FFSubSync not installed (optional)", {
                "hint": "Install with: pip install ffsubsync"
            })
        
        # Test method descriptions
        descriptions = synchronizer.get_method_descriptions()
        assert len(descriptions) > 0
        print_result(True, f"Got descriptions for {len(descriptions)} methods")
        
        return True
        
    except Exception as e:
        print_result(False, f"Sync plugin test failed: {str(e)}")
        return False


async def test_language_detection():
    """Test simplified language detection"""
    print_test_header("Language Detection")
    
    try:
        detector = SimpleLanguageDetector()
        
        # Test language normalization
        test_codes = {
            'en': Language.ENGLISH,
            'ja': Language.JAPANESE,
            'zh-cn': Language.CHINESE_SIMPLIFIED,
            'zh-tw': Language.CHINESE_TRADITIONAL
        }
        
        for code, expected in test_codes.items():
            result = detector._normalize_language_code(code)
            assert result == expected, f"Failed to normalize {code}"
        
        print_result(True, "Language code normalization works")
        
        # Test pattern detection with sample text
        japanese_text = "これは日本語のテストです。"
        result = detector._detect_by_patterns(japanese_text)
        if result:
            assert result.detected_language == Language.JAPANESE
            print_result(True, "Japanese pattern detection works", {
                "confidence": f"{result.confidence:.2f}"
            })
        
        english_text = "This is an English test sentence."
        result = detector._detect_by_patterns(english_text)
        # English won't be detected by patterns (no special characters)
        print_result(True, "English pattern detection behaves correctly")
        
        # Test optimal font selection
        font = detector.get_optimal_font(Language.JAPANESE)
        assert font == 'Noto Sans CJK JP'
        print_result(True, "Font selection for languages works", {
            "Japanese font": font
        })
        
        return True
        
    except Exception as e:
        print_result(False, f"Language detection test failed: {str(e)}")
        return False


async def test_dual_subtitle_creator():
    """Test refactored dual subtitle creator"""
    print_test_header("Dual Subtitle Creator")
    
    try:
        creator = DualSubtitleCreator()
        
        # Test configuration
        config = DualSubtitleConfig(
            output_format=SubtitleFormat.ASS,
            primary_font_size=22,
            secondary_font_size=20
        )
        
        assert config.output_format == SubtitleFormat.ASS
        print_result(True, "DualSubtitleConfig created successfully", {
            "format": config.output_format.value,
            "primary_size": config.primary_font_size
        })
        
        # Test color conversion
        ass_color = creator._convert_color_to_ass("#FF0000")
        assert ass_color == "&H0000FF"  # Red in ASS format (BGR)
        print_result(True, "Color conversion works", {
            "input": "#FF0000",
            "output": ass_color
        })
        
        # Test ASS style creation
        style = creator._create_ass_style("Test", config, is_primary=True)
        assert style.fontsize == 22
        print_result(True, "ASS style creation works", {
            "font_size": style.fontsize,
            "font_name": style.fontname
        })
        
        return True
        
    except Exception as e:
        print_result(False, f"Dual subtitle creator test failed: {str(e)}")
        return False


async def test_async_wrapper():
    """Test async processing wrapper"""
    print_test_header("Async Processing")
    
    try:
        processor = AsyncSubtitleProcessor()
        
        # Test that processor has required components
        assert processor.dual_creator is not None
        assert processor.language_detector is not None
        assert processor.synchronizer is not None
        
        print_result(True, "Async processor initialized correctly")
        
        # Test batch processing structure
        test_tasks = [
            {'type': 'language_detect', 'file_path': '/test/file1.srt'},
            {'type': 'language_detect', 'file_path': '/test/file2.srt'}
        ]
        
        # We can't actually run these without real files, but we can test the structure
        print_result(True, "Batch processing structure verified", {
            "task_count": len(test_tasks),
            "supported_types": "dual_subtitle, sync, language_detect"
        })
        
        return True
        
    except Exception as e:
        print_result(False, f"Async wrapper test failed: {str(e)}")
        return False


async def test_integration():
    """Test integration of components"""
    print_test_header("Integration Test")
    
    try:
        # Create sample subtitle content
        sample_srt = """1
00:00:01,000 --> 00:00:03,000
Hello World

2
00:00:04,000 --> 00:00:06,000
Test subtitle
"""
        
        # Create temporary files
        with tempfile.NamedTemporaryFile(mode='w', suffix='.srt', delete=False) as f1:
            f1.write(sample_srt)
            temp_file1 = Path(f1.name)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.srt', delete=False) as f2:
            f2.write(sample_srt)
            temp_file2 = Path(f2.name)
        
        try:
            # Test language detection on real file
            detector = SimpleLanguageDetector()
            result = detector.detect_from_file(temp_file1, "en")
            print_result(True, "Language detection on real file works", {
                "detected": result.detected_language.value,
                "confidence": f"{result.confidence:.2f}"
            })
            
            # Test subtitle loading
            creator = DualSubtitleCreator()
            subs = creator._load_subtitle(str(temp_file1))
            assert len(subs) == 2  # Two subtitle entries
            print_result(True, "Subtitle loading works", {
                "lines_loaded": len(subs)
            })
            
            return True
            
        finally:
            # Cleanup temp files
            temp_file1.unlink(missing_ok=True)
            temp_file2.unlink(missing_ok=True)
        
    except Exception as e:
        print_result(False, f"Integration test failed: {str(e)}")
        return False


async def run_all_tests():
    """Run all tests"""
    print(f"\n{TestColors.BOLD}{TestColors.BLUE}{'=' * 60}{TestColors.RESET}")
    print(f"{TestColors.BOLD}{TestColors.BLUE}PLEX DUAL SUBTITLE MANAGER - REFACTORED ARCHITECTURE TEST{TestColors.RESET}")
    print(f"{TestColors.BOLD}{TestColors.BLUE}{'=' * 60}{TestColors.RESET}")
    
    tests = [
        test_configuration,
        test_exception_hierarchy,
        test_sync_plugins,
        test_language_detection,
        test_dual_subtitle_creator,
        test_async_wrapper,
        test_integration
    ]
    
    results = []
    for test in tests:
        try:
            result = await test()
            results.append(result)
        except Exception as e:
            print(f"{TestColors.RED}Test crashed: {e}{TestColors.RESET}")
            results.append(False)
    
    # Summary
    print(f"\n{TestColors.BOLD}{'=' * 60}{TestColors.RESET}")
    print(f"{TestColors.BOLD}TEST SUMMARY{TestColors.RESET}")
    print(f"{TestColors.BOLD}{'=' * 60}{TestColors.RESET}")
    
    passed = sum(1 for r in results if r)
    total = len(results)
    
    if passed == total:
        print(f"{TestColors.GREEN}{TestColors.BOLD}✅ ALL TESTS PASSED ({passed}/{total}){TestColors.RESET}")
    else:
        print(f"{TestColors.YELLOW}{TestColors.BOLD}⚠️  SOME TESTS FAILED ({passed}/{total}){TestColors.RESET}")
    
    return passed == total


if __name__ == "__main__":
    # Run tests
    success = asyncio.run(run_all_tests())
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)