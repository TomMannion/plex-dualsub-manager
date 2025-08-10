/**
 * Plex Authentication Service using plex-oauth package
 * Handles OAuth authentication flow for Plex users
 */

import { PlexOauth } from 'plex-oauth';
import type { IPlexClientDetails } from 'plex-oauth';

interface PlexUser {
  id: number;
  uuid: string;
  username: string;
  title: string;
  email: string;
  friendlyName: string;
  thumb: string;
}

interface PlexAuthToken {
  authToken: string;
  user: PlexUser;
}

export class PlexAuthService {
  private static readonly CLIENT_IDENTIFIER = 'plex-dualsub-manager-' + Math.random().toString(36).substring(2);
  private static readonly PRODUCT_NAME = 'Plex DualSub Manager';
  private static readonly VERSION = '1.0.0';
  private static readonly PLATFORM = 'Web';
  private static readonly DEVICE = 'Browser';
  
  private static readonly AUTH_TOKEN_KEY = 'plexAuthToken';
  private static readonly USER_DATA_KEY = 'plexUserData';

  private static getClientDetails(): IPlexClientDetails {
    return {
      clientIdentifier: this.CLIENT_IDENTIFIER,
      product: this.PRODUCT_NAME,
      device: this.DEVICE,
      version: this.VERSION,
      forwardUrl: window.location.origin,
      platform: this.PLATFORM,
      urlencode: true
    };
  }

  /**
   * Start the OAuth authentication flow using plex-oauth package
   */
  static async startAuthFlow(): Promise<{ loginUrl: string; pinId: number }> {
    try {
      const plexOauth = new PlexOauth(this.getClientDetails());
      const [loginUrl, pinId] = await plexOauth.requestHostedLoginURL();
      
      console.log('Auth flow started:', { loginUrl, pinId });
      
      return {
        loginUrl,
        pinId: parseInt(pinId.toString(), 10), // Ensure it's a number
      };
    } catch (error) {
      console.error('Failed to start auth flow:', error);
      throw new Error('Failed to initialize Plex authentication');
    }
  }

  /**
   * Poll for authentication completion using plex-oauth package
   */
  static async pollForAuth(
    pinId: number,
    onSuccess: (authToken: string, userData: PlexAuthToken) => void,
    onError: (error: Error) => void,
    maxAttempts: number = 60,
    intervalMs: number = 2000
  ): Promise<void> {
    let attempts = 0;
    const plexOauth = new PlexOauth(this.getClientDetails());

    const poll = async () => {
      try {
        attempts++;
        console.log(`Polling for auth completion, attempt ${attempts}/${maxAttempts}`);
        
        const authToken = await plexOauth.checkForAuthToken(pinId);
        
        if (authToken) {
          console.log('Auth token received!');
          
          try {
            // Try to get user data from token
            const userData = await this.getUserInfoFromToken(authToken);
            
            // Store in localStorage
            localStorage.setItem(this.AUTH_TOKEN_KEY, authToken);
            localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userData));
            
            onSuccess(authToken, userData);
            return;
          } catch (userInfoError) {
            console.warn('Failed to get user info, but token is valid. Creating minimal user data:', userInfoError);
            
            // Create minimal user data if user info fetch fails
            const minimalUserData: PlexAuthToken = {
              authToken,
              user: {
                id: 0,
                uuid: '',
                username: 'Plex User',
                title: 'Plex User',
                email: '',
                friendlyName: 'Plex User',
                thumb: '',
              },
            };
            
            // Store in localStorage
            localStorage.setItem(this.AUTH_TOKEN_KEY, authToken);
            localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(minimalUserData));
            
            onSuccess(authToken, minimalUserData);
            return;
          }
        }

        if (attempts >= maxAttempts) {
          onError(new Error('Authentication timeout'));
          return;
        }

        // Continue polling
        setTimeout(poll, intervalMs);
      } catch (error) {
        console.error('Polling error:', error);
        onError(error instanceof Error ? error : new Error('Authentication failed'));
      }
    };

    poll();
  }

  /**
   * Get user info from auth token
   */
  private static async getUserInfoFromToken(authToken: string): Promise<PlexAuthToken> {
    try {
      // Use Plex API to get user info
      const response = await fetch('https://plex.tv/api/v2/user', {
        headers: {
          'Accept': 'application/json',
          'X-Plex-Token': authToken,
          'X-Plex-Client-Identifier': this.CLIENT_IDENTIFIER,
          'X-Plex-Product': this.PRODUCT_NAME,
          'X-Plex-Version': this.VERSION,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status}`);
      }

      const data = await response.json();
      
      // The user data is at the root level of the response
      return {
        authToken,
        user: {
          id: data.id,
          uuid: data.uuid,
          username: data.username,
          title: data.title,
          email: data.email,
          friendlyName: data.friendlyName || data.title || data.username,
          thumb: data.thumb,
        },
      };
    } catch (error) {
      console.error('Failed to get user info:', error);
      console.error('Auth token:', authToken);
      throw error;
    }
  }

  /**
   * Get stored auth token
   */
  static getStoredToken(): string | null {
    return localStorage.getItem(this.AUTH_TOKEN_KEY);
  }

  /**
   * Get stored user data
   */
  static getStoredUserData(): PlexAuthToken | null {
    const data = localStorage.getItem(this.USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    const token = this.getStoredToken();
    const userData = this.getStoredUserData();
    return !!(token && userData);
  }

  /**
   * Validate stored auth token
   */
  static async validateStoredAuth(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token) return false;

    try {
      await this.getUserInfoFromToken(token);
      return true;
    } catch (error) {
      // Token is invalid, clear storage
      this.logout();
      return false;
    }
  }

  /**
   * Logout and clear stored auth
   */
  static logout(): void {
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
    localStorage.removeItem(this.USER_DATA_KEY);
  }

  /**
   * Get auth headers for API requests
   */
  static getAuthHeaders(): Record<string, string> {
    const token = this.getStoredToken();
    if (!token) {
      throw new Error('No auth token available');
    }

    return {
      'X-Plex-Token': token,
    };
  }
}

export default PlexAuthService;