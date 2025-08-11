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
        # Fallback to .env for backward compatibility, but prefer dynamic tokens
        self.fallback_server_url = os.getenv('PLEX_URL')
        self.fallback_token = os.getenv('PLEX_TOKEN')
        self.tv_library_name = os.getenv('PLEX_TV_LIBRARY', 'TV Shows')
        self._connection_cache = {}  # Cache connections per token
        
    def connect(self, token: Optional[str] = None, server_url: Optional[str] = None) -> PlexServer:
        """Connect to Plex server using provided or fallback credentials"""
        # Use provided token or fallback
        auth_token = token or self.fallback_token
        plex_url = server_url or self.fallback_server_url
        
        if not auth_token:
            raise Exception("No Plex authentication token provided")
        
        # Use cached connection if available
        cache_key = f"{plex_url}:{auth_token[:10]}"  # Partial token for cache key
        if cache_key in self._connection_cache:
            return self._connection_cache[cache_key]
        
        # Discover server URL from token if not provided
        if not plex_url and auth_token:
            plex_url = self._discover_server_url(auth_token)
        
        if not plex_url:
            raise Exception("No Plex server URL available. Please configure PLEX_URL in .env")
            
        # Create new connection
        plex = PlexServer(plex_url, auth_token)
        
        # Cache the connection
        self._connection_cache[cache_key] = plex
        
        return plex
    
    def _discover_server_url(self, token: str) -> Optional[str]:
        """Discover server URL from MyPlex account using token"""
        try:
            from plexapi.myplex import MyPlexAccount
            account = MyPlexAccount(token=token)
            
            # Get servers
            servers = account.resources()
            plex_servers = [s for s in servers if s.product == 'Plex Media Server' and s.presence]
            
            if plex_servers:
                # Prefer local connections
                for server in plex_servers:
                    for conn in server.connections:
                        if conn.local:
                            return conn.uri
                
                # Fall back to any connection
                if plex_servers[0].connections:
                    return plex_servers[0].connections[0].uri
        except Exception as e:
            print(f"Failed to discover server URL: {e}")
        
        return None
    
    def get_tv_libraries(self, token: Optional[str] = None) -> List[ShowSection]:
        """Get all TV show libraries"""
        plex = self.connect(token)
        libraries = plex.library.sections()
        return [lib for lib in libraries if lib.type == 'show']
    
    def get_tv_library(self, library_name: Optional[str] = None, token: Optional[str] = None) -> ShowSection:
        """Get specific TV library by name"""
        plex = self.connect(token)
        
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
        tv_libraries = self.get_tv_libraries(token)
        if not tv_libraries:
            raise Exception("No TV libraries found")
        
        return tv_libraries[0]
    
    def get_all_shows(self, library_name: Optional[str] = None, token: Optional[str] = None) -> List[Show]:
        """Get all TV shows from a library"""
        library = self.get_tv_library(library_name, token)
        return library.all()
    
    def get_full_image_url(self, relative_url: str, token: Optional[str] = None, server_url: Optional[str] = None) -> str:
        """Convert relative Plex image URL to full URL with auth"""
        if not relative_url:
            return ""
        if relative_url.startswith('http'):
            return relative_url
        
        # Use provided values or fallbacks
        auth_token = token or self.fallback_token
        plex_url = server_url or self.fallback_server_url
        
        return f"{plex_url}{relative_url}?X-Plex-Token={auth_token}"
    
    def get_show(self, show_id: str, token: Optional[str] = None) -> Show:
        """Get specific show by ID"""
        plex = self.connect(token)
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
                        # Format: ShowName.S01E01.en.srt, ShowName.S01E01.zh.hi.srt, or ShowName.S01E01.srt
                        parts = file.stem.split('.')
                        language_code = None
                        
                        # Try to find language code (usually 2-3 letters after episode number)
                        # Look through parts to find a valid language code, prioritizing known codes
                        known_language_codes = {
                            'en', 'eng', 'ja', 'jpn', 'es', 'spa', 'fr', 'fra', 'de', 'ger', 'deu',
                            'it', 'ita', 'pt', 'por', 'ru', 'rus', 'ko', 'kor', 'zh', 'zho', 'chi',
                            'ar', 'ara', 'nl', 'dut', 'sv', 'swe', 'no', 'nor', 'da', 'dan',
                            'fi', 'fin', 'pl', 'pol', 'tr', 'tur', 'th', 'tha', 'vi', 'vie'
                        }
                        
                        # Chinese variant detection patterns
                        chinese_variants = {
                            'zh-tw': 'zh-TW',    # Traditional Chinese (Taiwan)
                            'zh-hk': 'zh-HK',    # Traditional Chinese (Hong Kong) 
                            'zh-cn': 'zh-CN',    # Simplified Chinese (China)
                            'zh-sg': 'zh-SG',    # Simplified Chinese (Singapore)
                            'zht': 'zh-TW',      # Traditional Chinese shorthand
                            'zhs': 'zh-CN',      # Simplified Chinese shorthand
                            'cht': 'zh-TW',      # Traditional Chinese alternative
                            'chs': 'zh-CN'       # Simplified Chinese alternative
                        }
                        
                        if len(parts) > 1:
                            # First check for Chinese variants (more specific)
                            for i in range(len(parts) - 1):
                                # Check for patterns like "zh-TW", "zh.TW", or combined "zh-tw"
                                current_part = parts[i].lower()
                                next_part = parts[i + 1].lower() if i + 1 < len(parts) else ""
                                
                                # Pattern: "zh-tw", "zht", etc.
                                if current_part in chinese_variants:
                                    language_code = chinese_variants[current_part]
                                    break
                                # Pattern: "zh" + "tw" as separate parts
                                elif current_part == 'zh' and next_part in ['tw', 'hk', 'cn', 'sg']:
                                    language_code = f'zh-{next_part.upper()}'
                                    break
                            
                            # If no Chinese variant found, look for standard language codes
                            if not language_code:
                                for part in reversed(parts[1:]):  # Skip the base filename part
                                    if len(part) in [2, 3] and part.lower() in known_language_codes:
                                        language_code = part.lower()
                                        break
                            
                            # If no known language code found, fall back to the old logic
                            if not language_code:
                                possible_lang = parts[-1]
                                if (len(possible_lang) in [2, 3] and 
                                    possible_lang.isalpha() and 
                                    possible_lang.lower() not in ['hi', 'cc', 'sdh', 'forced']):  # Exclude subtitle variant indicators
                                    language_code = possible_lang.lower()
                        
                        # Check if this is a dual subtitle file
                        is_dual_subtitle = '.dual.' in file.stem.lower()
                        dual_languages = None
                        
                        if is_dual_subtitle:
                            # Extract language codes from dual subtitle: base.dual.lang1.lang2.ext
                            dual_parts = file.stem.split('.')
                            if len(dual_parts) >= 4:
                                # Find the .dual. part and extract languages after it
                                try:
                                    dual_index = [p.lower() for p in dual_parts].index('dual')
                                    if dual_index + 2 < len(dual_parts):
                                        lang1 = dual_parts[dual_index + 1]
                                        lang2 = dual_parts[dual_index + 2]
                                        dual_languages = [lang1, lang2]
                                        # For dual subtitles, we don't set a single language_code
                                        language_code = None
                                except (ValueError, IndexError):
                                    pass
                        
                        external_subs.append({
                            'file_path': str(file),
                            'file_name': file.name,
                            'language_code': language_code,
                            'format': file.suffix[1:].upper(),
                            'is_dual_subtitle': is_dual_subtitle,
                            'dual_languages': dual_languages
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
    
    def format_episode_info(self, episode: Episode, token: Optional[str] = None) -> Dict:
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
            'thumb': self.get_full_image_url(episode.thumb, token),
            'duration': episode.duration,
            'viewed': episode.isWatched
        }


# Singleton instance
plex_service = PlexService()