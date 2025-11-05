import { type ZodSchema } from 'zod';

export async function fetchAndValidate<T>(
  url: string,
  schema: ZodSchema<T>,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as unknown;
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    console.error('Validation failed for:', url);
    console.error('Error details:', JSON.stringify(parsed.error.format(), null, 2));
    console.error('Received data:', raw);
    throw new Error('Response validation failed');
  }

  return parsed.data;
}

/**
 * Parse stored data with lenient validation for schema evolution.
 * 
 * Strategy:
 * - If data is valid: return it
 * - If data is invalid but parseable: return it anyway (let mergeStates handle migration)
 * - If data is completely broken: return null
 * 
 * This allows old localStorage data to survive schema changes.
 */
export function parseStoredData<T>(
  rawJson: string | null,
  schema: ZodSchema<T>
): T | null {
  if (!rawJson) return null;

  try {
    const raw = JSON.parse(rawJson) as unknown;
    const parsed = schema.safeParse(raw);

    if (!parsed.success) {
      console.warn('[Schema Migration] Stored data does not match current schema');
      console.warn('[Schema Migration] Validation errors:', parsed.error.issues.length, 'issues');
      
      // Log the first few errors for debugging
      const topErrors = parsed.error.issues.slice(0, 3);
      topErrors.forEach(issue => {
        console.warn(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      
      if (parsed.error.issues.length > 3) {
        console.warn(`  ... and ${parsed.error.issues.length - 3} more issues`);
      }
      
      // CRITICAL CHANGE: Return the raw data anyway
      // The controller's mergeStates() will fill in missing fields from defaults
      console.warn('[Schema Migration] Returning partial data for migration');
      console.warn('[Schema Migration] mergeStates() will fill missing fields with defaults');
      
      // Type assertion is safe here because we're intentionally being lenient
      // The controller will merge this with fresh defaults to fill gaps
      return raw as T;
    }

    // Data is valid, return it normally
    return parsed.data;
    
  } catch (error: unknown) {
    // JSON parsing failed - data is completely corrupted
    if (error instanceof Error) {
      console.error('[Restore] Failed to parse stored data:', error.message);
      console.error('[Restore] Data is corrupted, clearing localStorage');
    }
    
    // Only remove localStorage if JSON parsing failed (truly corrupted)
    localStorage.removeItem('wavedesigner_session');
    return null;
  }
}