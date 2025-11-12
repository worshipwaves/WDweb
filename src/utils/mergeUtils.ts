/**
 * Type guard for object detection
 */
function isObject(item: any): item is Record<string, any> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Deep merge utility for composition state overrides.
 * Arrays are replaced, not merged. Objects are recursively merged.
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      const sourceValue = source[key as keyof T];
      const targetValue = target[key as keyof T];
      
      if (isObject(sourceValue) && isObject(targetValue)) {
        // Recursive merge for nested objects
        (output as any)[key] = deepMerge(targetValue, sourceValue);
      } else {
        // Direct replacement for primitives and arrays
        (output as any)[key] = sourceValue;
      }
    });
  }
  
  return output;
}