import PlexAuthService from '../services/plexAuth';

/**
 * Fix Plex image URLs that come from the backend with "None/" prefix
 * by proxying them through our backend API
 */
export function fixPlexImageUrl(thumbUrl: string | null | undefined): string | null {
  // If no thumb URL provided, return null
  if (!thumbUrl) return null;
  
  // If the URL starts with "None/", it means the backend couldn't determine
  // the proper Plex server URL. We can proxy these through our backend instead.
  if (thumbUrl.startsWith('None/')) {
    // Extract the path part after "None/" and construct a backend proxy URL
    const pathPart = thumbUrl.replace('None/', '');
    const backendBase = 'http://localhost:8000';
    
    // Get the auth token from storage to include in the proxy request
    const token = PlexAuthService.getStoredToken();
    if (!token) {
      console.warn('No auth token available for image proxy');
      return null;
    }
    
    return `${backendBase}/api/plex-proxy/${encodeURIComponent(pathPart)}?token=${encodeURIComponent(token)}`;
  }
  
  // If it's already a proper URL, return as-is
  return thumbUrl;
}

/**
 * Check if an image URL is valid/loadable
 */
export function isValidImageUrl(url: string | null): boolean {
  return url !== null && url !== undefined && url !== 'None' && !url.startsWith('None/');
}