"""
Plex API Service - handles all interactions with Plex Media Server
"""

import os
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from plexapi.server import PlexServer
from plexapi.library import ShowSection
from plexapi.video import Show, Episode
from dotenv import load_dotenv

class PlexService:
    def __init__(self):
        load_dotenv()
        self.server_url = os.getenv('PLEX_URL')
        self.token = os.getenv('PLEX_TOKEN')
        self.plex = None
        self.tv_library_name = os.getenv('PLEX_TV_LIBRARY', 'TV Shows')
        
    def connect(self) -> PlexServer:
        """Connect to Plex server using saved credentials"""
        if not self.plex:
            if not self.server_url or not self.token:
                raise Exception("No Plex credentials found. Please run test_plex_connection.py first")
            self.plex = PlexServer(self.server_url, self.token)
        return self.plex
    
    def get_tv_libraries(self) -> List[ShowSection]:
        """Get all TV show libraries"""
        plex = self.connect()
        libraries = plex.library.sections()
        return [lib for lib in libraries if lib.type == 'show']
    
    def get_tv_library(self, library_name: Optional[str] = None) -> ShowSection:
        """Get specific TV library by name"""
        plex = self.connect()
        
        if library_name:
            try:
                return plex.library.section(library_name)
            except Exception as e:
                raise Exception(f"Library '{library_name}' not found or not accessible: {str(e)}")
        
        # If no name specified, try the configured default first
        if self.tv_library_name:
            try:
                return plex.library.section(self.tv_library_name)
            except:
                pass  # Fall through to find first available
        
        # Find first available TV library
        tv_libraries = self.get_tv_libraries()
        if not tv_libraries:
            raise Exception("No TV libraries found")
        
        return tv_libraries[0]
    
    def get_all_shows(self, library_name: Optional[str] = None) -> List[Show]:
        """Get all TV shows from a library"""
        library = self.get_tv_library(library_name)
        return library.all()
    
    def get_full_image_url(self, relative_url: str) -> str:
        """Convert relative Plex image URL to full URL with auth"""
        if not relative_url:
            return ""
        if relative_url.startswith('http'):
            return relative_url
        return f"{self.server_url}{relative_url}?X-Plex-Token={self.token}"
    
    def get_show(self, show_id: str) -> Show:
        """Get specific show by ID"""
        plex = self.connect()
        return plex.fetchItem(int(show_id))
    
    def get_episodes(self, show: Show) -> List[Episode]:
        """Get all episodes for a show"""
        return show.episodes()
    
    def get_episode_file_info(self, episode: Episode) -> Dict:
        """Get file path and subtitle info for an episode"""
        if not episode.media:
            return None
            
        media = episode.media[0]  # Get first media item (highest quality)
        part = media.parts[0]  # Get first part (main file)
        
        file_path = part.file
        file_dir = str(Path(file_path).parent)
        file_name = Path(file_path).stem
        
        # Get subtitle streams (embedded) - only truly embedded ones inside video file
        embedded_subs = []
        for stream in part.streams:
            if stream.streamType == 3:  # Subtitle stream
                stream_index = getattr(stream, 'index', -1)
                stream_key = getattr(stream, 'key', None)
                stream_id = getattr(stream, 'id', None)
                
                # More robust detection of embedded vs external subtitles
                # Truly embedded subtitles typically have:
                # - No key (or key is None)
                # - Positive stream index
                # - No external file reference
                
                # External subtitles added by Plex have:
                # - A key like "/library/streams/xxxxx"
                # - Often negative index or specific patterns
                
                is_truly_embedded = (
                    stream_key is None and 
                    stream_index >= 0 and
                    not (hasattr(stream, 'url') and stream.url)  # No external URL
                )
                
                # Debug info (can be removed later)
                print(f"Stream Debug - Index: {stream_index}, Key: {stream_key}, ID: {stream_id}, "
                      f"Language: {getattr(stream, 'language', 'N/A')}, "
                      f"Embedded: {is_truly_embedded}")
                
                if is_truly_embedded:
                    embedded_subs.append({
                        'language': getattr(stream, 'language', 'Unknown'),
                        'languageCode': getattr(stream, 'languageCode', ''),
                        'codec': getattr(stream, 'codec', ''),
                        'forced': getattr(stream, 'forced', False),
                        'title': getattr(stream, 'title', ''),
                        'stream_index': stream_index,  # Use actual Plex stream index
                        'id': f"embedded_{stream_index}",
                        'display_name': f"{getattr(stream, 'language', 'Unknown')} ({getattr(stream, 'codec', 'SUB')}){' - Forced' if getattr(stream, 'forced', False) else ''}"
                    })
        
        # Check for external subtitles
        external_subs = self.find_external_subtitles(file_dir, file_name)
        
        return {
            'file_path': file_path,
            'file_dir': file_dir,
            'file_name': file_name,
            'embedded_subtitles': embedded_subs,
            'external_subtitles': external_subs,
            'has_subtitles': bool(embedded_subs or external_subs)
        }
    
    def find_external_subtitles(self, directory: str, base_filename: str) -> List[Dict]:
        """Find external subtitle files for a video file"""
        external_subs = []
        subtitle_extensions = ['.srt', '.ass', '.ssa', '.vtt', '.sub']
        
        try:
            dir_path = Path(directory)
            if not dir_path.exists():
                return external_subs
                
            for file in dir_path.iterdir():
                if file.is_file() and file.suffix.lower() in subtitle_extensions:
                    # Check if this subtitle belongs to our video
                    if file.stem.startswith(base_filename):
                        # Extract language code if present
                        # Format: ShowName.S01E01.en.srt or ShowName.S01E01.srt
                        parts = file.stem.split('.')
                        language_code = None
                        
                        # Try to find language code (usually 2-3 letters after episode number)
                        if len(parts) > 1:
                            possible_lang = parts[-1]
                            if len(possible_lang) in [2, 3] and possible_lang.isalpha():
                                language_code = possible_lang.lower()
                        
                        external_subs.append({
                            'file_path': str(file),
                            'file_name': file.name,
                            'language_code': language_code,
                            'format': file.suffix[1:].upper()
                        })
        except Exception as e:
            print(f"Error scanning for subtitles: {e}")
            
        return external_subs
    
    def get_episode_naming_pattern(self, episode: Episode) -> str:
        """Generate Plex-compatible filename base for subtitles"""
        show_title = episode.grandparentTitle
        season_num = str(episode.parentIndex).zfill(2)
        episode_num = str(episode.index).zfill(2)
        
        # Get the actual filename to match its pattern
        if episode.media:
            actual_file = Path(episode.media[0].parts[0].file).stem
            # Use the actual filename pattern (important for matching)
            return actual_file
        else:
            # Fallback to standard pattern
            safe_title = "".join(c for c in show_title if c.isalnum() or c in ' -_').strip()
            safe_title = safe_title.replace(' ', '.')
            return f"{safe_title}.S{season_num}E{episode_num}"
    
    def format_episode_info(self, episode: Episode) -> Dict:
        """Format episode information for API response"""
        file_info = self.get_episode_file_info(episode)
        
        return {
            'id': episode.ratingKey,
            'title': episode.title,
            'show': episode.grandparentTitle,
            'season': episode.parentIndex,
            'episode': episode.index,
            'season_episode': f"S{str(episode.parentIndex).zfill(2)}E{str(episode.index).zfill(2)}",
            'file_info': file_info,
            'naming_pattern': self.get_episode_naming_pattern(episode),
            'thumb': self.get_full_image_url(episode.thumb),
            'duration': episode.duration,
            'viewed': episode.isWatched
        }


# Singleton instance
plex_service = PlexService()