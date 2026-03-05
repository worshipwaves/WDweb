import os
import shutil
from datetime import datetime
from send2trash import send2trash
import time

MAX_BACKUPS_TO_KEEP = 10

def create_backup():
    description = input("Enter backup description: ").strip()
    if not description:
        print("❌ No description provided. Backup cancelled.")
        return
    
    safe_description = "".join(c for c in description if c.isalnum() or c in (' ', '-', '_')).rstrip()
    safe_description = safe_description.replace(' ', '_')
    
    # MODIFIED: Path logic is kept, but it's important to run this from the project root
    # or ensure the pathing is correct for your execution method.
    # This assumes `dev_utils` is in the project root.
    project_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(project_dir)
    backup_folder = os.path.join(parent_dir, "backups")
    os.makedirs(backup_folder, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    backup_name = os.path.join(backup_folder, f"backup_{timestamp}_{safe_description}")
    
    # MODIFIED: Added 'venv', '.pytest_cache', and 'dev_utils' to ignore patterns
    ignore_patterns = shutil.ignore_patterns(
        # Standard Python temporary files
        "*.pyc", 
        "__pycache__",
        # Project-specific folders to ignore
        "backups",
        "combined_files",
        "venv",
        ".pytest_cache",
        "assets",
        # Legacy folders (kept for safety)
        "ai_compact", 
        "separated", 
        "logs", 
        "*.log"
    )
    
    try:
        shutil.copytree(parent_dir, backup_name, ignore=ignore_patterns)
        print(f"✅ Backed up to {backup_name}")
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        if os.path.exists(backup_name):
            try:
                shutil.rmtree(backup_name)
            except Exception as e2:
                print(f"❌ Cleanup of failed backup failed: {e2}")
        return
    
    def count_files(path):
        total = 0
        # Add any other top-level folders you ignore during the copy
        ignore_dirs = {'.git', 'venv', 'backups', 'assets', '__pycache__'} 
        
        for root, dirs, files in os.walk(path, topdown=True):
            # This line prunes the directories os.walk will enter,
            # which is more efficient and avoids the path-matching bug.
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            total += len(files)
        return total
    
    source_files = count_files(parent_dir)
    backup_files = count_files(backup_name)
    print(f"ℹ️ Source files: ~{source_files}, Backup files: {backup_files}")
    
    print("ℹ️ Pausing for 2 seconds to allow system processes to catch up...")
    time.sleep(2) # <--- 2. ADD THIS DELAY    
    
    backups = sorted([f for f in os.listdir(backup_folder) if f.startswith("backup_")])
    while len(backups) > MAX_BACKUPS_TO_KEEP:
        old_backup = backups.pop(0)
        old_backup_path = os.path.join(backup_folder, old_backup)
        try:
            send2trash(old_backup_path)
            print(f"♻️ Sent to recycle bin: {old_backup}")
        except Exception as e:
            print(f"❌ Failed to recycle {old_backup}: {e}")

if __name__ == "__main__":
    create_backup()