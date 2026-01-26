/**
 * Resolves asset paths to full URLs.
 */
export function resolveAssetUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_ASSET_BASE_URL;
  
  if (baseUrl && path.startsWith('/assets')) {
    return path.replace('/assets', baseUrl);
  }
  
  return path;
}

/**
 * Get API base URL from environment or default to localhost
 */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:8000';
}