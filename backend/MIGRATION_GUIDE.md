# Migration Guide: Refactored Architecture

## Overview
This guide helps you transition from the original code to the refactored architecture with improved error handling, async support, and plugin system.

## Key Changes

### 1. Configuration Management
- **Old**: Configuration scattered across multiple files
- **New**: Centralized configuration using Pydantic in `config.py`
- **Migration**: Create a `.env` file with your settings:

```env
# Plex Configuration
PLEX_URL=http://localhost:32400
PLEX_TOKEN=your_token_here

# Subtitle Settings
DUALSUB_DEFAULT_PRIMARY_LANG=ja
DUALSUB_DEFAULT_SECONDARY_LANG=en
DUALSUB_ENABLE_SYNC_BY_DEFAULT=true

# App Settings
APP_MAX_WORKERS=4
APP_ENABLE_LANGUAGE_DETECTION=true
APP_ENABLE_AUTO_BACKUP=true
```

### 2. Error Handling
- **Old**: Generic exceptions and try/catch blocks
- **New**: Custom exception hierarchy in `exceptions.py`
- **Benefits**: 
  - Better error messages for users
  - Automatic HTTP status code mapping
  - Detailed error context

### 3. Subtitle Synchronization
- **Old**: Direct ffsubsync calls with fallback to original
- **New**: Plugin architecture supporting multiple sync methods
- **Available Methods**:
  - `ffsubsync`: Audio-based synchronization (most accurate)
  - `auto_align`: Pattern-based alignment (fallback)
  - `manual_offset`: Manual time adjustment

### 4. Language Detection
- **Old**: 300+ lines of complex Unicode analysis
- **New**: Simplified detector using langdetect + pattern matching
- **Benefits**:
  - Faster detection
  - Better accuracy for mixed-language content
  - Cleaner, maintainable code

### 5. Dual Subtitle Creation
- **Old**: Separate functions for ASS and SRT with duplicated code
- **New**: Unified `DualSubtitleCreator` class
- **Benefits**:
  - No code duplication
  - Consistent behavior across formats
  - Easier to add new formats

### 6. Async Support
- **Old**: Blocking operations in API endpoints
- **New**: Async wrappers for CPU-intensive tasks
- **Benefits**:
  - Better API responsiveness
  - Concurrent subtitle processing
  - Batch operations support

## Running the Refactored Version

### 1. Install New Dependencies
```bash
pip install -r requirements.txt
```

### 2. Create Configuration File
Create `.env` file in the backend directory with your settings (see example above).

### 3. Run the New API
```bash
# From backend directory
python main_refactored.py
```

The refactored API runs on the same port (8000) by default and is backward compatible with existing frontend.

## API Changes

### New Endpoints

1. **Language Detection**
   - `POST /api/subtitles/detect-language`
   - Detect subtitle language with confidence score

2. **Sync Methods**
   - `GET /api/sync-methods`
   - Get available synchronization methods

3. **Batch Processing**
   - `POST /api/subtitles/batch-process`
   - Process multiple subtitle operations concurrently

4. **Configuration**
   - `GET /api/config`
   - Get current configuration
   - `POST /api/config/reload`
   - Reload configuration without restart

### Enhanced Endpoints

1. **Dual Subtitle Creation**
   - Now supports `sync_method` parameter
   - Returns language detection results
   - Provides sync confidence scores

2. **Error Responses**
   - Structured error format with type and details
   - Actionable error messages

## Testing the Refactored System

Run the test script to verify everything works:

```bash
python test_refactored.py
```

## Rollback Plan

If you need to rollback:

1. The original files are preserved:
   - `main.py` (original API)
   - `services/subtitle_service.py` (original implementation)

2. To use original version:
   ```bash
   python main.py  # Instead of main_refactored.py
   ```

## Benefits Summary

1. **Performance**: 
   - Async operations improve API responsiveness
   - Batch processing for multiple files
   - Thread pool for CPU-intensive tasks

2. **Reliability**:
   - Better error handling and recovery
   - Multiple sync method fallbacks
   - Automatic backups before modifications

3. **Maintainability**:
   - Clean separation of concerns
   - Plugin architecture for extensibility
   - Centralized configuration

4. **User Experience**:
   - Better error messages
   - Progress tracking for batch operations
   - Configuration without code changes

## Support

If you encounter issues:

1. Check the logs for detailed error messages
2. Verify your `.env` configuration
3. Run the test script to identify problems
4. The original code remains available as fallback