"""
FastAPI backend for Plex Dual Subtitle Manager
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
import os
import sys
from pathlib import Path
from functools import lru_cache
import time

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from services.plex_service import plex_service
from services.subtitle_service import subtitle_service, DualSubtitleConfig, SubtitlePosition

# Simple in-memory cache for show counts
show_counts_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 300  # 5 minutes TTL for cache

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize connection to Plex on startup"""
    try:
        plex = plex_service.connect()
        print(f"✅ Connected to Plex: {plex.friendlyName}")
    except Exception as e:
        print(f"❌ Failed to connect to Plex: {e}")
        print("Please run test_plex_connection.py first")
    yield
    # Cleanup code here (if needed)

app = FastAPI(
    title="Plex Dual Subtitle Manager",
    description="Manage subtitles for your Plex TV shows",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://192.168.0.56:5173",
        "null"  # Allow file:// origins for testing
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Plex Dual Subtitle Manager",
        "status": "running",
        "endpoints": {
            "docs": "/docs",
            "shows": "/api/shows",
            "libraries": "/api/libraries"
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
            "version": plex.version
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }

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
async def get_shows(
    library: Optional[str] = None, 
    limit: Optional[int] = None,
    fast_mode: bool = True,  # New parameter for fast loading
    offset: int = 0  # For pagination
):
    """Get all TV shows from a library
    
    Args:
        library: Optional library name
        limit: Optional limit on number of shows
        fast_mode: If True, skip expensive operations like episode/season counts
        offset: Pagination offset
    """
    try:
        shows = plex_service.get_all_shows(library)
        
        # Apply pagination
        total_count = len(shows)
        if offset:
            shows = shows[offset:]
        if limit:
            shows = shows[:limit]
        
        if fast_mode:
            # Fast mode: Return basic info only, no episode/season counts
            return {
                "count": total_count,
                "offset": offset,
                "shows": [
                    {
                        "id": show.ratingKey,
                        "title": show.title,
                        "year": show.year,
                        "thumb": plex_service.get_full_image_url(show.thumb),
                        "episode_count": 0,  # Placeholder, will be loaded separately
                        "season_count": 0,   # Placeholder, will be loaded separately
                        "summary": getattr(show, 'summary', '')[:200] if hasattr(show, 'summary') else ''
                    }
                    for show in shows
                ]
            }
        else:
            # Full mode: Include episode and season counts (slower)
            return {
                "count": total_count,
                "offset": offset,
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
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/shows/{show_id}/counts")
async def get_show_counts(show_id: str):
    """Get episode and season counts for a specific show (with caching)"""
    try:
        # Check cache first
        cache_key = f"counts_{show_id}"
        if cache_key in show_counts_cache:
            cached_data = show_counts_cache[cache_key]
            # Check if cache is still valid
            if time.time() - cached_data['timestamp'] < CACHE_TTL:
                return cached_data['data']
        
        # Fetch from Plex if not in cache or expired
        show = plex_service.get_show(show_id)
        result = {
            "id": show.ratingKey,
            "episode_count": len(show.episodes()),
            "season_count": len(show.seasons())
        }
        
        # Store in cache
        show_counts_cache[cache_key] = {
            'data': result,
            'timestamp': time.time()
        }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/shows/{show_id}")
async def get_show_detail(show_id: str):
    """Get detailed information about a specific show"""
    try:
        show = plex_service.get_show(show_id)
        
        # Get all episodes and check subtitle status
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

@app.post("/api/episodes/{episode_id}/subtitles/upload")
async def upload_subtitle(
    episode_id: str,
    file: UploadFile = File(...),
    language: str = Form("en")
):
    """Upload a subtitle file for an episode"""
    try:
        # Get episode information
        plex = plex_service.connect()
        episode = plex.fetchItem(int(episode_id))
        
        # Get the naming pattern
        base_name = plex_service.get_episode_naming_pattern(episode)
        
        # Validate file extension
        allowed_extensions = ['.srt', '.ass', '.ssa', '.vtt', '.sub']
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(400, f"Invalid file type. Allowed: {', '.join(allowed_extensions)}")
        
        # Get the directory where the video file is
        file_info = plex_service.get_episode_file_info(episode)
        if not file_info:
            raise HTTPException(404, "Episode file not found")
        
        # Create the subtitle filename following Plex convention
        subtitle_filename = f"{base_name}.{language}{file_ext}"
        subtitle_path = Path(file_info['file_dir']) / subtitle_filename
        
        # Read and save the uploaded file
        content = await file.read()
        
        # TODO: Detect and convert encoding if needed
        
        # Write the subtitle file
        with open(subtitle_path, 'wb') as f:
            f.write(content)
        
        return {
            "success": True,
            "message": f"Subtitle uploaded successfully",
            "filename": subtitle_filename,
            "path": str(subtitle_path),
            "language": language
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/subtitles")
async def delete_subtitle(file_path: str):
    """Delete a subtitle file"""
    try:
        path = Path(file_path)
        
        # Security check - ensure it's a subtitle file
        if path.suffix.lower() not in ['.srt', '.ass', '.ssa', '.vtt', '.sub']:
            raise HTTPException(400, "Can only delete subtitle files")
        
        if not path.exists():
            raise HTTPException(404, "Subtitle file not found")
        
        # Create backup before deleting
        backup_path = path.with_suffix(path.suffix + '.backup')
        import shutil
        shutil.copy2(path, backup_path)
        
        # Delete the file
        path.unlink()
        
        return {
            "success": True,
            "message": "Subtitle deleted",
            "backup": str(backup_path)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/episodes/{episode_id}/subtitles/dual")
async def create_dual_subtitle(
    episode_id: str,
    primary_subtitle: str = Form(...),  # Path to primary subtitle file
    secondary_subtitle: str = Form(...),  # Path to secondary subtitle file
    primary_language: str = Form("ja"),
    secondary_language: str = Form("en"),
    # Customization options
    primary_position: str = Form("bottom"),
    secondary_position: str = Form("top"),
    primary_color: str = Form("#FFFFFF"),
    secondary_color: str = Form("#FFFF00"),
    primary_font_size: int = Form(20),
    secondary_font_size: int = Form(18),
    output_format: str = Form("ass"),
    enable_sync: bool = Form(True)  # Enable automatic synchronization
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
            raise HTTPException(404, f"Primary subtitle not found: {primary_subtitle}")
        if not secondary_path.exists():
            raise HTTPException(404, f"Secondary subtitle not found: {secondary_subtitle}")
        
        # Get output path
        file_info = plex_service.get_episode_file_info(episode)
        if not file_info:
            raise HTTPException(404, "Episode file not found")
        
        base_name = plex_service.get_episode_naming_pattern(episode)
        output_ext = '.ass' if output_format == 'ass' else '.srt'
        
        # Use language detection for filename if available
        detected_primary = primary_language
        detected_secondary = secondary_language
        
        try:
            # Quick language detection for naming
            from services.subtitle_service import LanguageDetector
            primary_detection = LanguageDetector.analyze_subtitle_file(str(primary_path))
            secondary_detection = LanguageDetector.analyze_subtitle_file(str(secondary_path))
            
            if primary_detection['confidence'] > 0.6:
                detected_primary = primary_detection['recommendation']
                
            if secondary_detection['confidence'] > 0.6:
                detected_secondary = secondary_detection['recommendation']
                
        except Exception as e:
            # If detection fails, use declared languages
            print(f"Language detection for naming failed: {e}")
        
        # Convert to short codes for filename
        def get_short_lang_code(lang):
            mapping = {
                'zh-CN': 'cn',
                'zh-TW': 'tw', 
                'ja': 'ja',
                'en': 'en',
                'ko': 'ko',
                'fr': 'fr',
                'es': 'es',
                'de': 'de'
            }
            return mapping.get(lang, lang)
        
        primary_short = get_short_lang_code(detected_primary)
        secondary_short = get_short_lang_code(detected_secondary)
        
        output_filename = f"{base_name}.{primary_short}.{secondary_short}.dual{output_ext}"
        output_path = Path(file_info['file_dir']) / output_filename
        
        # Create configuration
        config = DualSubtitleConfig(
            primary_position=SubtitlePosition.BOTTOM if primary_position == "bottom" else SubtitlePosition.TOP,
            secondary_position=SubtitlePosition.BOTTOM if secondary_position == "bottom" else SubtitlePosition.TOP,
            primary_color=subtitle_service.convert_color_to_ass(primary_color),
            secondary_color=subtitle_service.convert_color_to_ass(secondary_color),
            primary_font_size=primary_font_size,
            secondary_font_size=secondary_font_size,
            srt_primary_prefix=f"[{primary_language.upper()}] " if output_format == "srt" else "",
            srt_secondary_prefix=f"[{secondary_language.upper()}] " if output_format == "srt" else ""
        )
        
        # Create dual subtitle with video sync validation and language detection
        video_file_path = file_info['file_path'] if file_info else None
        result = subtitle_service.create_dual_subtitle(
            str(primary_path),
            str(secondary_path),
            str(output_path),
            config,
            video_path=video_file_path,
            declared_primary_lang=primary_language,
            declared_secondary_lang=secondary_language,
            enable_language_detection=True,
            enable_sync=enable_sync
        )
        
        if result['success']:
            return {
                "success": True,
                "message": "Dual subtitle created successfully",
                "output_file": output_filename,
                "output_path": str(output_path),
                "details": result
            }
        else:
            raise HTTPException(500, result.get('error', 'Failed to create dual subtitle'))
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/subtitles/dual/preview")
async def preview_dual_subtitle(
    primary_subtitle: str = Form(...),
    secondary_subtitle: str = Form(...),
    primary_position: str = Form("bottom"),
    secondary_position: str = Form("top"),
    primary_color: str = Form("#FFFFFF"),
    secondary_color: str = Form("#FFFF00"),
    primary_font_size: int = Form(20),
    secondary_font_size: int = Form(18)
):
    """Preview a dual subtitle combination without creating the file"""
    try:
        # Validate files exist
        primary_path = Path(primary_subtitle)
        secondary_path = Path(secondary_subtitle)
        
        if not primary_path.exists():
            raise HTTPException(404, f"Primary subtitle not found: {primary_subtitle}")
        if not secondary_path.exists():
            raise HTTPException(404, f"Secondary subtitle not found: {secondary_subtitle}")
        
        # Create configuration
        config = DualSubtitleConfig(
            primary_position=SubtitlePosition.BOTTOM if primary_position == "bottom" else SubtitlePosition.TOP,
            secondary_position=SubtitlePosition.BOTTOM if secondary_position == "bottom" else SubtitlePosition.TOP,
            primary_color=subtitle_service.convert_color_to_ass(primary_color),
            secondary_color=subtitle_service.convert_color_to_ass(secondary_color),
            primary_font_size=primary_font_size,
            secondary_font_size=secondary_font_size
        )
        
        # Generate preview
        preview = subtitle_service.preview_dual_subtitle(
            str(primary_path),
            str(secondary_path),
            config,
            preview_lines=5
        )
        
        return preview
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/subtitles/validate-sync")
async def validate_subtitle_sync(
    subtitle_file: str = Form(...),
    video_file: str = Form(...)
):
    """Validate if a subtitle file is synced with a video file"""
    try:
        result = subtitle_service.validate_subtitle_sync(subtitle_file, video_file)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/subtitles/adjust-timing")
async def adjust_subtitle_timing(
    subtitle_file: str = Form(...),
    offset_seconds: float = Form(...),
    output_file: Optional[str] = Form(None)
):
    """Adjust subtitle timing by offset"""
    try:
        if not output_file:
            # Create backup and modify in place
            subtitle_path = Path(subtitle_file)
            backup_path = subtitle_path.with_suffix(subtitle_path.suffix + '.backup')
            import shutil
            shutil.copy2(subtitle_path, backup_path)
            output_file = subtitle_file
        
        offset_ms = int(offset_seconds * 1000)
        result = subtitle_service.adjust_subtitle_timing(subtitle_file, offset_ms, output_file)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/episodes/{episode_id}/subtitles/extract-embedded")
async def extract_embedded_subtitle(
    episode_id: str,
    stream_index: int = Form(...),
    language_code: str = Form("en"),
    subtitle_type: str = Form("normal")  # normal or forced
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
        
        # Extract the embedded subtitle
        result = subtitle_service.extract_embedded_subtitle(
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
            raise HTTPException(500, f"Extraction failed: {result.get('error')}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/episodes/{episode_id}/debug-streams")
async def debug_episode_streams(episode_id: str):
    """Debug endpoint to see all streams for an episode"""
    try:
        plex = plex_service.connect()
        episode = plex.fetchItem(int(episode_id))
        
        if not episode.media:
            return {"error": "No media found"}
        
        media = episode.media[0]
        part = media.parts[0]
        
        streams_info = []
        for stream in part.streams:
            stream_info = {
                'index': getattr(stream, 'index', 'N/A'),
                'streamType': stream.streamType,
                'streamTypeDesc': {1: 'Video', 2: 'Audio', 3: 'Subtitle'}.get(stream.streamType, 'Unknown'),
                'codec': getattr(stream, 'codec', 'N/A'),
                'language': getattr(stream, 'language', 'N/A'),
                'languageCode': getattr(stream, 'languageCode', 'N/A'),
                'title': getattr(stream, 'title', 'N/A'),
                'forced': getattr(stream, 'forced', False),
                'key': getattr(stream, 'key', 'N/A'),
                'selected': getattr(stream, 'selected', False),
                'id': getattr(stream, 'id', 'N/A')
            }
            streams_info.append(stream_info)
        
        return {
            'episode': f"{episode.grandparentTitle} - S{episode.parentIndex:02d}E{episode.index:02d}",
            'file_path': part.file,
            'total_streams': len(streams_info),
            'streams': streams_info
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting Plex Dual Subtitle Manager API...")
    print("API Documentation: http://localhost:8000/docs")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)