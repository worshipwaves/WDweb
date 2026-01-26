/**
 * Resolves asset paths to full URLs.
 * In production: prepends S3 base URL
 * In development: returns path as-is (served by Vite)
 */
export function resolveAssetUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_ASSET_BASE_URL;
  
  if (baseUrl && path.startsWith('/assets')) {
    // Production: replace /assets with S3 URL
    return path.replace('/assets', baseUrl);
  }
  
  // Development: use local path
  return path;
}