import os
import shutil
import sys
from pathlib import Path

try:
    import psutil
except ImportError:
    print("❌ ERROR: 'psutil' library not found. Please run: pip install psutil")
    sys.exit(1)

def find_locking_processes_and_exit(locked_path: Path):
    """Scans for a process locking a path and exits with a clear error."""
    print("\n" + "="*60)
    print(f"🛑 ACTION REQUIRED: Deletion failed for: {locked_path}")
    
    locking_procs = set()
    locked_path_str = str(locked_path.resolve()).lower()

    for proc in psutil.process_iter(['pid', 'name']):
        try:
            for file_handle in proc.open_files():
                if str(Path(file_handle.path).resolve()).lower().startswith(locked_path_str):
                    locking_procs.add(f"   - '{proc.info['name']}' (PID: {proc.info['pid']})")
                    break 
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    if locking_procs:
        print("   A program has this file/folder locked. Please close it and try again:")
        for proc_info in sorted(list(locking_procs)):
            print(proc_info)
    else:
        print("   Could not identify the specific program.")
        print("   Please ensure all editors (Notepad++), terminals, and file explorers are closed.")
    
    print("="*60)
    sys.exit(1)

def restore_backup():
    utils_dir = Path(__file__).resolve().parent
    project_dir = utils_dir.parent
    backup_folder = project_dir / "backups"

    try:
        if project_dir in Path.cwd().resolve().parents or project_dir == Path.cwd().resolve():
            print("\n🛑 ERROR: Run this script from the parent directory (e.g., 'cd ..').")
            sys.exit(1)
    except Exception:
        pass

    # (The rest of the script is the same as the one I gave you with the try/except block)
    # This function just provides the context for the call.
    
    # ... [The existing code to list backups and get user choice] ...
    # This part is correct, so I'm omitting it for brevity. The key change is in the deletion loop.
    
    # --- DELETION PHASE with ERROR HANDLING ---
    preserve_list = ["backups", "dev_utils", ".git", "venv", "node_modules", "combined_files"]
    print("ℹ️ Deleting old project files (preserving essential folders)...")
    for item in project_dir.iterdir():
        if item.name in preserve_list:
            continue
        try:
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
        except PermissionError:
            # If deletion fails, find the culprit and exit
            find_locking_processes_and_exit(item) # This is the key call
        except Exception as e:
            print(f"⚠️  Could not delete {item.name}: {e}")
    # ... [The rest of the copy and final message code is also correct] ...

# ... (The rest of your script) ...
# I will provide the full file in the next message if this is too confusing.