# utils/performance_monitor.py

import time
from typing import Dict, List, Optional

class PerformanceMonitor:
    """A singleton class to track and report performance metrics on the backend."""

    def __init__(self):
        self.entries: Dict[str, Dict] = {}
        self.completed_entries: List[Dict] = []
        self.enabled: bool = True

    def start(self, name: str):
        """Starts a timer for a given operation."""
        if not self.enabled:
            return
        self.entries[name] = {
            "name": name,
            "start_time": time.perf_counter()
        }

    def end(self, name: str) -> Optional[float]:
        """Stops a timer and records the duration."""
        if not self.enabled or name not in self.entries:
            return None
        
        entry = self.entries.pop(name)
        end_time = time.perf_counter()
        duration_ms = (end_time - entry["start_time"]) * 1000
        
        entry["end_time"] = end_time
        entry["duration"] = duration_ms
        
        self.completed_entries.append(entry)
        return duration_ms

    def get_report(self) -> str:
        """Generates a formatted string report of all completed operations."""
        if not self.completed_entries:
            return "=== Performance Report ===\nNo operations recorded."
            
        sorted_entries = sorted(self.completed_entries, key=lambda x: x["duration"], reverse=True)
        
        report = "\n=== Backend Performance Report ===\n"
        report += f"Total operations: {len(sorted_entries)}\n\n"
        
        for entry in sorted_entries:
            report += f"{entry['name']:<40} {entry['duration']:>10.2f}ms\n"
            
        return report

    def reset(self):
        """Clears all recorded entries."""
        self.entries.clear()
        self.completed_entries.clear()

# Create a singleton instance for global use
performance_monitor = PerformanceMonitor()