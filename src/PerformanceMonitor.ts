/**
 * PerformanceMonitor - Tracks and logs performance metrics
 * 
 * Usage:
 * PerformanceMonitor.start('operation_name');
 * // ... do work ...
 * PerformanceMonitor.end('operation_name');
 */

interface PerformanceEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class PerformanceMonitorClass {
  private entries: Map<string, PerformanceEntry> = new Map();
  private completedEntries: PerformanceEntry[] = [];
  private enabled: boolean = true;
  
  start(name: string): void {
    if (!this.enabled) return;
    
    this.entries.set(name, {
      name,
      startTime: performance.now()
    });
  }
  
  end(name: string): number | null {
    if (!this.enabled) return null;
    
    const entry = this.entries.get(name);
    if (!entry) {
      console.warn(`[PerfMonitor] No start time found for: ${name}`);
      return null;
    }
    
    const endTime = performance.now();
    const duration = endTime - entry.startTime;
    
    entry.endTime = endTime;
    entry.duration = duration;
    
    this.completedEntries.push(entry);
    this.entries.delete(name);
    
    return duration;
  }
  
  mark(_name: string): void {
    if (!this.enabled) return;
  }
  
  getReport(): string {
    const sorted = [...this.completedEntries].sort((a, b) => b.duration! - a.duration!);
    
    let report = '\n=== Performance Report ===\n';
    report += 'Total operations: ' + sorted.length + '\n\n';
    
    sorted.forEach(entry => {
      report += `${entry.name.padEnd(40)} ${entry.duration!.toFixed(2).padStart(10)}ms\n`;
    });
    
    return report;
  }
  
  reset(): void {
    this.entries.clear();
    this.completedEntries = [];
  }
  
  enable(): void {
    this.enabled = true;
  }
  
  disable(): void {
    this.enabled = false;
  }
}

export const PerformanceMonitor = new PerformanceMonitorClass();

// Expose to window for console access
declare global {
  interface Window {
    perfMonitor?: PerformanceMonitorClass;
  }
}

if (typeof window !== 'undefined') {
  window.perfMonitor = PerformanceMonitor;
}