"""
FastAPI backend for Plex Dual Subtitle Manager - Refactored Version
Uses the new architecture with improved error handling, async support, and plugin system
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import List, Optional
import os
import sys
from pathlib import Path
import logging
import shutil

# Add backend to path
sys.path.append(str(Path(__file__).parent))

# Import new architecture components
try:
    # Try absolute imports first (when run as module)
    from backend.config import settings
    from backend.exceptions import (
        DualSubError,
        PlexConnectionError,
        PlexAuthenticationError,
        SubtitleError,
        SubtitleSyncError,
        FFSubSyncNotFoundError,
        FileOperationError
    )
    from backend.services.async_wrapper import AsyncSubtitleProcessor, cleanup_async_resources
    from backend.services.subtitle_creator import DualSubtitleConfig, SubtitlePosition, SubtitleFormat
    from backend.services.sync_plugins import SyncMethod
    from backend.services.language_detector import Language
    from backend.services.plex_service import plex_service
except ImportError:
    # Fallback to relative imports (when run directly from backend dir)
    from config import settings
    from exceptions import (
        DualSubError,
        PlexConnectionError,
        PlexAuthenticationError,
        SubtitleError,
        SubtitleSyncError,
        FFSubSyncNotFoundError,
        FileOperationError
    )
    from services.async_wrapper import AsyncSubtitleProcessor, cleanup_async_resources
    from services.subtitle_creator import DualSubtitleConfig, SubtitlePosition, SubtitleFormat
    from services.sync_plugins import SyncMethod
    from services.language_detector import Language
    # Import existing Plex service (we'll keep this for now)
    from services.plex_service import plex_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources"""
    try:
        # Initialize Plex connection
        plex = plex_service.connect()
        logger.info(f"✅ Connected to Plex: {plex.friendlyName}")
    except Exception as e:
        logger.error(f"❌ Failed to connect to Plex: {e}")
        logger.warning("Please check your Plex configuration")
    
    yield
    
    # Cleanup resources
    await cleanup_async_resources()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="Plex Dual Subtitle Manager",
    description="Manage subtitles for your Plex TV shows - Refactored Version",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.app.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize async processor
async_processor = AsyncSubtitleProcessor()


# ============= Exception Handlers =============

@app.exception_handler(DualSubError)
async def dual_sub_error_handler(request, exc: DualSubError):
    """Handle custom application errors"""
    return JSONResponse(
        status_code=400,
        content={
            "error": exc.message,
            "details": exc.details,
            "type": exc.__class__.__name__
        }
    )


@app.exception_handler(PlexConnectionError)
async def plex_connection_error_handler(request, exc: PlexConnectionError):
    """Handle Plex connection errors"""
    return JSONResponse(
        status_code=503,
        content={
            "error": exc.message,
            "details": exc.details,
            "help": "Check your Plex server URL and ensure it's running"
        }
    )


# ============= Health & Status Endpoints =============

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Plex Dual Subtitle Manager",
        "version": "2.0.0",
        "status": "running",
        "features": {
            "language_detection": settings.app.enable_language_detection,
            "auto_backup": settings.app.enable_auto_backup,
            "sync_methods": async_processor.synchronizer.get_method_descriptions()
        },
        "endpoints": {
            "docs": "/docs",
            "health": "/api/health",
            "status": "/api/status",
            "shows": "/api/shows",
            "libraries": "/api/libraries"
        }
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "config": {
            "plex_configured": bool(settings.plex.token),
            "temp_dir_exists": settings.app.temp_dir.exists(),
            "max_workers": settings.app.max_workers
        }
    }


@app.get("/api/status")
async def get_status():
    """Check Plex connection status"""
    try:
        plex = plex_service.connect()
        return {
            "connected": True,
            "server_name": plex.friendlyName,
            "version": plex.version,
            "machine_identifier": plex.machineIdentifier
        }
    except PlexConnectionError as e:
        raise e
    except Exception as e:
        raise PlexConnectionError(settings.plex.url, str(e))


# ============= Plex Library Endpoints =============

@app.get("/api/libraries")
async def get_libraries():
    """Get all TV show libraries"""
    try:
        libraries = plex_service.get_tv_libraries()
        return {
            "libraries": [
                {
                    "key": lib.key,
                    "title": lib.title,
                    "uuid": lib.uuid,
                    "show_count": len(lib.all())
                }
                for lib in libraries
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/shows")
async def get_shows(library: Optional[str] = None, limit: Optional[int] = None):
    """Get all TV shows from a library"""
    try:
        # If no library specified, get first available TV library
        if not library:
            libraries = plex_service.get_tv_libraries()
            if not libraries:
                raise HTTPException(status_code=404, detail="No TV libraries found")
            library = libraries[0].title
        
        shows = plex_service.get_all_shows(library)
        
        if limit:
            shows = shows[:limit]
        
        return {
            "library_used": library,
            "count": len(shows),
            "shows": [
                {
                    "id": show.ratingKey,
                    "title": show.title,
                    "year": show.year,
                    "thumb": plex_service.get_full_image_url(show.thumb),
                    "episode_count": len(show.episodes()),
                    "season_count": len(show.seasons())
                }
                for show in shows
            ]
        }
    except Exception as e:
        logger.error(f"Error getting shows: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get shows: {str(e)}")


@app.get("/api/shows/{show_id}")
async def get_show_detail(show_id: str):
    """Get detailed information about a specific show"""
    try:
        show = plex_service.get_show(show_id)
        episodes = show.episodes()
        
        episodes_with_subs = 0
        total_external_subs = 0
        total_embedded_subs = 0
        
        episode_list = []
        for episode in episodes:
            file_info = plex_service.get_episode_file_info(episode)
            if file_info:
                if file_info['has_subtitles']:
                    episodes_with_subs += 1
                total_external_subs += len(file_info.get('external_subtitles', []))
                total_embedded_subs += len(file_info.get('embedded_subtitles', []))
            
            episode_list.append(plex_service.format_episode_info(episode))
        
        return {
            "id": show.ratingKey,
            "title": show.title,
            "year": show.year,
            "summary": show.summary,
            "thumb": plex_service.get_full_image_url(show.thumb),
            "art": plex_service.get_full_image_url(show.art),
            "episode_count": len(episodes),
            "season_count": len(show.seasons()),
            "episodes_with_subtitles": episodes_with_subs,
            "subtitle_coverage": f"{(episodes_with_subs/len(episodes)*100):.1f}%" if episodes else "0%",
            "total_external_subtitles": total_external_subs,
            "total_embedded_subtitles": total_embedded_subs,
            "seasons": [
                {
                    "id": season.ratingKey,
                    "index": season.index,
                    "title": season.title,
                    "episode_count": len(season.episodes())
                }
                for season in show.seasons()
            ],
            "episodes": episode_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/episodes/{episode_id}")
async def get_episode_detail(episode_id: str):
    """Get detailed information about a specific episode"""
    try:
        plex = plex_service.connect()
        episode = plex.fetchItem(int(episode_id))
        return plex_service.format_episode_info(episode)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/episodes/{episode_id}/subtitles")
async def get_episode_subtitles(episode_id: str):
    """Get all subtitles for an episode"""
    try:
        plex = plex_service.connect()
        episode = plex.fetchItem(int(episode_id))
        file_info = plex_service.get_episode_file_info(episode)
        
        if not file_info:
            return {
                "episode": f"S{episode.parentIndex:02d}E{episode.index:02d}: {episode.title}",
                "has_file": False,
                "subtitles": []
            }
        
        return {
            "episode": f"S{episode.parentIndex:02d}E{episode.index:02d}: {episode.title}",
            "file_path": file_info['file_path'],
            "has_subtitles": file_info['has_subtitles'],
            "embedded_subtitles": file_info['embedded_subtitles'],
            "external_subtitles": file_info['external_subtitles'],
            "naming_pattern": plex_service.get_episode_naming_pattern(episode)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= Subtitle Operations =============

@app.post("/api/subtitles/detect-language")
async def detect_subtitle_language(
    subtitle_file: str = Form(...),
    declared_language: Optional[str] = Form(None)
):
    """Detect language of a subtitle file"""
    try:
        result = await async_processor.detect_language(subtitle_file, declared_language)
        
        return {
            "detected_language": result.detected_language.value,
            "confidence": result.confidence,
            "alternative_language": result.alternative_language.value if result.alternative_language else None,
            "method_used": result.method_used,
            "sample_size": result.sample_size
        }
    except Exception as e:
        raise SubtitleError(f"Language detection failed: {str(e)}")


@app.post("/api/subtitles/sync")
async def sync_subtitles(
    reference_file: str = Form(...),
    target_file: str = Form(...),
    output_file: str = Form(...),
    method: Optional[str] = Form(None),
    max_offset_seconds: Optional[int] = Form(60)
):
    """Synchronize subtitle files"""
    try:
        sync_method = SyncMethod(method) if method else None
        
        result = await async_processor.sync_subtitles(
            reference_file,
            target_file,
            output_file,
            method=sync_method,
            max_offset_seconds=max_offset_seconds
        )
        
        return {
            "success": result.success,
            "method": result.method.value,
            "output_path": result.output_path,
            "offset_ms": result.offset_ms,
            "confidence": result.confidence,
            "error": result.error,
            "details": result.details
        }
    except FFSubSyncNotFoundError as e:
        raise e
    except Exception as e:
        raise SubtitleSyncError(str(e))


@app.get("/api/sync-methods")
async def get_sync_methods():
    """Get available synchronization methods"""
    return {
        "available_methods": [
            {
                "method": method.value,
                "description": desc,
                "available": True
            }
            for method, desc in async_processor.synchronizer.get_method_descriptions().items()
        ]
    }


@app.post("/api/episodes/{episode_id}/subtitles/dual")
async def create_dual_subtitle(
    episode_id: str,
    primary_subtitle: str = Form(...),
    secondary_subtitle: str = Form(...),
    primary_language: Optional[str] = Form(None),
    secondary_language: Optional[str] = Form(None),
    primary_position: str = Form("bottom"),
    secondary_position: str = Form("top"),
    primary_color: str = Form("#FFFFFF"),
    secondary_color: str = Form("#FFFF00"),
    primary_font_size: int = Form(20),
    secondary_font_size: int = Form(18),
    output_format: str = Form("ass"),
    enable_sync: bool = Form(True),
    sync_method: Optional[str] = Form(None)
):
    """Create a dual subtitle file from two existing subtitles"""
    try:
        # Get episode information
        plex = plex_service.connect()
        episode = plex.fetchItem(int(episode_id))
        
        # Validate subtitle files exist
        primary_path = Path(primary_subtitle)
        secondary_path = Path(secondary_subtitle)
        
        if not primary_path.exists():
            raise FileOperationError("read", primary_subtitle, "File not found")
        if not secondary_path.exists():
            raise FileOperationError("read", secondary_subtitle, "File not found")
        
        # Get output path
        file_info = plex_service.get_episode_file_info(episode)
        if not file_info:
            raise HTTPException(404, "Episode file not found")
        
        base_name = plex_service.get_episode_naming_pattern(episode)
        output_ext = '.ass' if output_format == 'ass' else '.srt'
        
        # Create output filename
        primary_lang_short = primary_language[:2] if primary_language else "un"
        secondary_lang_short = secondary_language[:2] if secondary_language else "un"
        output_filename = f"{base_name}.{primary_lang_short}.{secondary_lang_short}.dual{output_ext}"
        output_path = Path(file_info['file_dir']) / output_filename
        
        # Create configuration
        config = DualSubtitleConfig(
            output_format=SubtitleFormat(output_format),
            primary_position=SubtitlePosition(primary_position),
            secondary_position=SubtitlePosition(secondary_position),
            primary_color=primary_color,
            secondary_color=secondary_color,
            primary_font_size=primary_font_size,
            secondary_font_size=secondary_font_size,
            enable_sync=enable_sync,
            sync_method=SyncMethod(sync_method) if sync_method else None,
            primary_language=primary_language,
            secondary_language=secondary_language
        )
        
        # Create dual subtitle asynchronously
        video_file_path = file_info.get('file_path')
        result = await async_processor.create_dual_subtitle(
            str(primary_path),
            str(secondary_path),
            str(output_path),
            config,
            video_file_path
        )
        
        if result.success:
            return {
                "success": True,
                "message": "Dual subtitle created successfully",
                "output_file": output_filename,
                "output_path": str(output_path),
                "details": {
                    "primary_lines": result.primary_lines,
                    "secondary_lines": result.secondary_lines,
                    "total_lines": result.total_lines,
                    "sync_performed": result.sync_performed,
                    "sync_method": result.sync_method,
                    "languages_detected": result.languages_detected,
                    "warnings": result.warnings
                }
            }
        else:
            raise SubtitleError(result.error or "Failed to create dual subtitle")
            
    except DualSubError as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/subtitles/batch-process")
async def batch_process_subtitles(
    tasks: List[dict],
    max_concurrent: int = 3
):
    """Process multiple subtitle operations in batch"""
    try:
        results = await async_processor.batch_process_subtitles(tasks, max_concurrent)
        
        successful = sum(1 for r in results if r.get('success', False))
        failed = len(results) - successful
        
        return {
            "total_tasks": len(tasks),
            "successful": successful,
            "failed": failed,
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/episodes/{episode_id}/subtitles/extract-embedded")
async def extract_embedded_subtitle(
    episode_id: str,
    stream_index: int = Form(...),
    language_code: str = Form("en"),
    subtitle_type: str = Form("normal")
):
    """Extract an embedded subtitle stream to external file"""
    try:
        # Get episode information
        plex = plex_service.connect()
        episode = plex.fetchItem(int(episode_id))
        
        file_info = plex_service.get_episode_file_info(episode)
        if not file_info:
            raise HTTPException(404, "Episode file not found")
        
        # Create output filename
        base_name = plex_service.get_episode_naming_pattern(episode)
        suffix = ".forced" if subtitle_type == "forced" else ""
        output_filename = f"{base_name}.{language_code}{suffix}.srt"
        output_path = Path(file_info['file_dir']) / output_filename
        
        # Backup existing file if it exists
        if output_path.exists() and settings.app.enable_auto_backup:
            backup_path = output_path.with_suffix(output_path.suffix + '.backup')
            shutil.copy2(output_path, backup_path)
            logger.info(f"Created backup: {backup_path}")
        
        # Extract the embedded subtitle asynchronously
        result = await async_processor.extract_embedded_subtitle(
            file_info['file_path'],
            stream_index,
            str(output_path)
        )
        
        if result['success']:
            return {
                "success": True,
                "message": "Embedded subtitle extracted successfully",
                "output_file": output_filename,
                "output_path": str(output_path),
                "stream_index": stream_index
            }
        else:
            raise SubtitleError(f"Extraction failed: {result.get('error')}")
            
    except DualSubError as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/subtitles")
async def delete_subtitle(file_path: str):
    """Delete a subtitle file"""
    try:
        path = Path(file_path)
        
        # Security check - ensure it's a subtitle file
        if path.suffix.lower() not in settings.subtitle.supported_subtitle_formats:
            raise FileOperationError("delete", file_path, "Can only delete subtitle files")
        
        if not path.exists():
            raise FileOperationError("delete", file_path, "File not found")
        
        # Create backup before deleting
        if settings.app.enable_auto_backup:
            backup_dir = settings.app.backup_dir or path.parent
            backup_path = backup_dir / f"{path.name}.deleted.backup"
            shutil.copy2(path, backup_path)
            logger.info(f"Created backup before deletion: {backup_path}")
        else:
            backup_path = None
        
        # Delete the file
        path.unlink()
        
        return {
            "success": True,
            "message": "Subtitle deleted",
            "backup": str(backup_path) if backup_path else None
        }
        
    except DualSubError as e:
        raise e
    except Exception as e:
        raise FileOperationError("delete", file_path, str(e))


# ============= Configuration Endpoints =============

@app.get("/api/config")
async def get_configuration():
    """Get current configuration (non-sensitive values only)"""
    return {
        "app": {
            "temp_dir": str(settings.app.temp_dir),
            "max_workers": settings.app.max_workers,
            "enable_language_detection": settings.app.enable_language_detection,
            "enable_auto_backup": settings.app.enable_auto_backup
        },
        "subtitle": {
            "default_primary_lang": settings.subtitle.default_primary_lang,
            "default_secondary_lang": settings.subtitle.default_secondary_lang,
            "enable_sync_by_default": settings.subtitle.enable_sync_by_default,
            "sync_timeout_seconds": settings.subtitle.sync_timeout_seconds,
            "supported_formats": settings.subtitle.supported_subtitle_formats
        },
        "plex": {
            "url": settings.plex.url,
            "configured": bool(settings.plex.token)
        }
    }


@app.post("/api/config/reload")
async def reload_configuration():
    """Reload configuration from environment and files"""
    try:
        settings.reload()
        return {
            "success": True,
            "message": "Configuration reloaded successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reload configuration: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting Plex Dual Subtitle Manager API (Refactored)...")
    logger.info(f"API Documentation: http://{settings.app.api_host}:{settings.app.api_port}/docs")
    logger.info(f"Configuration: Language Detection={settings.app.enable_language_detection}, Auto Backup={settings.app.enable_auto_backup}")
    
    uvicorn.run(
        "main_refactored:app",
        host=settings.app.api_host,
        port=settings.app.api_port,
        reload=True,
        log_level="info"
    )