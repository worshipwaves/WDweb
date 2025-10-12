#!/usr/bin/env python -u
"""
auto_guardian.py — Real-Time Monitor for the Greenfield Architecture

This script enforces the strict architectural rules for the new WaveDesigner project.
It runs in the background, watches for file changes, and provides immediate
feedback if a newly saved file violates the architecture. It is your primary
defense against regressions, especially those introduced by AI assistants.
"""

from typing import List, Dict
import os
import sys
import time
import subprocess
import json
import re
from pathlib import Path
from datetime import datetime

try:
    import winsound
except ImportError:
    winsound = None # Non-windows compatibility

# ---------------- CONFIG: RULES FOR THE NEW ARCHITECTURE ----------------

# Violation types that the new guardian.py can detect.
# This list must stay in sync with guardian.py
VIOLATION_TYPES = [
    "STATEFUL_SERVICE",
    "DEFAULT_ARGUMENT",
    "FACADE_BYPASS",
    "STATE_MUTATION",
    "CORE_IMPORTS_SERVICE_LAYER",
    "SERVICE_IMPORTS_ADAPTER",
]

# Violations that trigger a more urgent alert.
CRITICAL_TYPES = [
    "STATEFUL_SERVICE",      # BLOCKER
    "DEFAULT_ARGUMENT",      # BLOCKER
    "FACADE_BYPASS",         # CRITICAL
    "STATE_MUTATION",        # CRITICAL
]

# Quick fix instructions tailored to the new architecture.
FIX_HINTS = {
    "STATEFUL_SERVICE": """
[BLOCKER] Services MUST be stateless. Remove instance variables that store data.
- BAD:  self.cached_data = {}
- GOOD: Pass all required data into the method via DTOs.
""",
    "DEFAULT_ARGUMENT": """
[BLOCKER] Services/Core MUST NOT have default arguments.
- BAD:  def process(self, data, threshold=0.5):
- GOOD: def process(self, request: ProcessRequestDTO):
- All defaults MUST live in config/default_parameters.json.
""",
    "FACADE_BYPASS": """
[CRITICAL] Adapters (UI) MUST ONLY call the ServiceFacade.
- BAD (in UI code): from services.composition_service import CompositionService
- GOOD (in UI code): from services.service_facade import WaveformDesignerFacade
""",
    "STATE_MUTATION": """
[CRITICAL] Do not mutate input data. Create and return NEW objects.
- BAD:  input_list.append(item)
- BAD:  state_dto.value += 1
- GOOD: new_list = input_list + [item]
- GOOD: return dataclasses.replace(state_dto, value=state_dto.value + 1)
""",
    "CORE_IMPORTS_SERVICE_LAYER": """
[HIGH] The Core layer cannot know about Services or DTOs.
- BAD (in core/geometry_math.py): from services.dtos import CompositionStateDTO
- GOOD: The core function should only accept primitive types (lists, numbers, numpy arrays).
""",
}

# Instructions to paste to an LLM to keep it aligned with the architecture.
LLM_INSTRUCTION = """
CRITICAL ARCHITECTURE RULES FOR THIS PROJECT:

1.  **Immutability:** Never modify input objects (lists, dicts, DTOs). Always create and return a new object with the changes.
2.  **Stateless Services:** Service classes MUST NOT store data in `self` (except for injected dependencies that start with an underscore, like `self._some_service`).
3.  **Facade is the Entry Point:** The UI (`adapters/`) can ONLY import and call `WaveformDesignerFacade`. It MUST NOT import other services like `CompositionService`.
4.  **No Default Arguments:** Functions in `services/` and `core/` MUST NOT have default arguments (e.g., `threshold=0.5`). All defaults live in `config/default_parameters.json`.
"""

# ---------------- SCRIPT LOGIC ----------------

def print_status(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    colors = {"INFO": "", "WARN": "\033[93m", "ERROR": "\033[91m", "SUCCESS": "\033[92m", "CRITICAL": "\033[95m"}
    reset = "\033[0m"
    print(f"{colors.get(level, '')}[{ts}] {msg}{reset}", flush=True)

def beep_alert(priority: str):
    if not winsound: return
    try:
        if priority in ["BLOCKER", "CRITICAL"]:
            winsound.Beep(800, 200); time.sleep(0.05); winsound.Beep(800, 200)
        else:
            winsound.Beep(600, 150)
    except Exception: pass

def run_command(cmd: str, timeout: int = 10):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True,
                          encoding="utf-8", env=os.environ.copy(), timeout=timeout)

def parse_guardian_output(text: str) -> List[Dict]:
    """Parse the detailed output of the new guardian.py."""
    violations = []
    # Regex to capture: filepath, line, priority, type, details
    pattern = r".*?(\S+\.py):(\d+)\s+\[(BLOCKER|CRITICAL|HIGH|MEDIUM|LOW)\]\s+([A-Z_]+):\s+(.+)"
    for match in re.finditer(pattern, text):
        filepath, line, priority, v_type, details = match.groups()
        violations.append({
            "file": filepath.strip(), "line": int(line), "priority": priority,
            "type": v_type, "details": details.strip()
        })
    return violations

def get_python_files_to_monitor() -> Dict[str, float]:
    """Get all relevant Python files in the project."""
    excluded = {'venv', '__pycache__', 'backups', '.git', 'requirements'}
    files = {}
    for p in Path(".").rglob("*.py"):
        if any(ex in p.parts for ex in excluded):
            continue
        if p.name in ['guardian.py', 'auto_guardian.py', '__init__.py'] or p.name.startswith('test_'):
            continue
        try:
            files[str(p)] = p.stat().st_mtime
        except FileNotFoundError:
            continue
    return files

def run_guardian_on_file(filepath: str) -> List[Dict]:
    """Execute guardian.py on a single file."""
    cmd = f'python guardian.py "{filepath}"'
    result = run_command(cmd)
    output = result.stdout + result.stderr
    if "SyntaxError" in output:
        print_status(f"Syntax error in {Path(filepath).name}, cannot lint.", "ERROR")
        return [{"type": "SYNTAX_ERROR"}]
    return parse_guardian_output(output)

def main():
    print("=" * 60)
    print(" [SHIELD] Auto-Guardian — Real-Time Architecture Monitor")
    print("=" * 60)

    if not Path("guardian.py").exists():
        print_status("guardian.py not found. Please create the linter script first.", "ERROR")
        return

    file_mtimes = get_python_files_to_monitor()
    file_violation_cache = {}

    print_status(f"Building initial baseline for {len(file_mtimes)} files...")
    initial_total = 0
    for filepath in file_mtimes.keys():
        violations = run_guardian_on_file(filepath)
        file_violation_cache[filepath] = {v['line']: v for v in violations if v['type'] != 'SYNTAX_ERROR'}
        initial_total += len(file_violation_cache[filepath])
    
    print_status(f"Baseline complete. Initial violation count: {initial_total}", "SUCCESS")
    print("\n" + "=" * 60)
    print("  [WATCHING] Watching for file changes... (Press Ctrl+C to stop)")
    print("=" * 60 + "\n")

    try:
        while True:
            time.sleep(1)
            for filepath, last_mtime in file_mtimes.items():
                try:
                    current_mtime = Path(filepath).stat().st_mtime
                    if current_mtime > last_mtime:
                        print_status(f"Change detected in: {Path(filepath).name}", "INFO")
                        file_mtimes[filepath] = current_mtime

                        old_violations = file_violation_cache.get(filepath, {})
                        new_violations_list = run_guardian_on_file(filepath)
                        
                        if any(v['type'] == 'SYNTAX_ERROR' for v in new_violations_list):
                            continue

                        new_violations = {v['line']: v for v in new_violations_list}
                        file_violation_cache[filepath] = new_violations

                        added_violations = [v for v in new_violations.values() if v['line'] not in old_violations or old_violations[v['line']] != v]
                        removed_count = len(old_violations) - (len(new_violations) - len(added_violations))
                        
                        if added_violations:
                            priority_order = ["BLOCKER", "CRITICAL", "HIGH", "MEDIUM", "LOW"]
                            highest_priority = sorted(added_violations, key=lambda v: priority_order.index(v['priority']))[0]['priority']
                            beep_alert(highest_priority)
                            print_status(f"[ALERT] {len(added_violations)} NEW VIOLATION(S) INTRODUCED!", "CRITICAL")
                            
                            for v in added_violations:
                                print(f"  - [{v['priority']}] {v['type']} (Line {v['line']}): {v['details']}")

                            print("\n   [NOTE] TO FIX (give this to your LLM):")
                            print("   " + "-" * 40)
                            unique_types = {v['type'] for v in added_violations}
                            for v_type in unique_types:
                                if v_type in FIX_HINTS:
                                    print(FIX_HINTS[v_type])
                            print("\n   [AI] AND REMIND IT OF THE CORE RULES:")
                            print("   " + "-" * 40)
                            print(LLM_INSTRUCTION)
                            print("   " + "-" * 40 + "\n")

                        elif removed_count > 0:
                            print_status(f"[FIXED] {removed_count} violation(s) fixed. Great work!", "SUCCESS")
                        else:
                            print_status("[OK] File saved, no new violations.", "SUCCESS")

                except FileNotFoundError:
                    if filepath in file_mtimes:
                        del file_mtimes[filepath]
                        del file_violation_cache[filepath]
                        print_status(f"File removed: {Path(filepath).name}", "WARN")
                except Exception as e:
                    print_status(f"Error processing {filepath}: {e}", "ERROR")

    except KeyboardInterrupt:
        print_status("\nMonitoring stopped.", "INFO")

if __name__ == "__main__":
    main()