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

export function parseStoredData<T>(
  rawJson: string | null,
  schema: ZodSchema<T>
): T | null {
  if (!rawJson) return null;

  try {
    const raw = JSON.parse(rawJson) as unknown;
    const parsed = schema.safeParse(raw);

    if (!parsed.success) {
      console.warn('Invalid stored data:', parsed.error.format());
      localStorage.removeItem('wavedesigner_session'); // Clean up invalid data
      return null;
    }

    return parsed.data;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.warn('Failed to parse stored data:', error.message);
    }
    localStorage.removeItem('wavedesigner_session'); // Clean up invalid data
    return null;
  }
}