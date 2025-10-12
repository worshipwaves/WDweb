import os
import sys
import psutil
import getpass
from send2trash import send2trash

def check_permissions(path):
    """Checks read, write, and execute permissions."""
    print(f"\n---  permissions for {path} ---")
    if not os.path.exists(path):
        print(f"❌ Path does not exist.")
        return False
        
    readable = os.access(path, os.R_OK)
    writable = os.access(path, os.W_OK)
    executable = os.access(path, os.X_OK) # For directories, this means listable
    
    print(f"{'✅' if readable else '❌'} Readable: {readable}")
    print(f"{'✅' if writable else '❌'} Writable: {writable}")
    print(f"{'✅' if executable else '❌'} Listable/Executable: {executable}")
    
    if not all([readable, writable, executable]):
        print("⚠️ Permission issue detected. The current user may not have full control.")
        return False
    return True

def find_locking_processes(folder_path):
    """Scans all system processes to find locks on files within the folder."""
    print(f"\n--- Scanning for process locks in {folder_path} ---")
    
    locking_processes = []
    target_path = os.path.abspath(folder_path).lower()

    # Iterate over all running processes
    for proc in psutil.process_iter(['pid', 'name', 'username']):
        try:
            # Get the list of open files for this process
            open_files = proc.open_files()
            for file in open_files:
                file_path_lower = os.path.abspath(file.path).lower()
                if file_path_lower.startswith(target_path):
                    proc_info = {
                        'pid': proc.info['pid'],
                        'name': proc.info['name'],
                        'username': proc.info['username'],
                        'locked_file': file.path
                    }
                    if proc_info not in locking_processes:
                        locking_processes.append(proc_info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            # Ignore processes that have died or that we can't access
            continue
            
    if not locking_processes:
        print("✅ No active file locks found by any accessible process.")
    else:
        print("❌ Found processes with files open inside the target folder:")
        for p in locking_processes:
            print(f"  - Process: {p['name']} (PID: {p['pid']})")
            print(f"    Locked File: {p['locked_file']}")
        print("👉 To resolve, close these programs or use Task Manager to end the tasks.")
        
    return locking_processes

def check_current_directory(folder_path):
    """Checks if the current working directory is inside the target folder."""
    print("\n--- Checking Current Working Directory ---")
    
    target_path = os.path.abspath(folder_path).lower()
    cwd = os.path.abspath(os.getcwd()).lower()
    
    if cwd.startswith(target_path):
        print(f"❌ Critical Issue: The script is running from inside the directory it's trying to delete!")
        print(f"   Your CWD: {os.getcwd()}")
        print(f"   Target:   {folder_path}")
        print("👉 Change your directory (e.g., `cd ..`) before running the script again.")
        return True
    else:
        print("✅ Current working directory is not inside the target folder.")
        return False

def test_send2trash(folder_path):
    """Tries to send a dummy file from the location to the trash."""
    print("\n--- Testing send2trash directly ---")
    dummy_file_path = os.path.join(folder_path, "delete_test_file.tmp")
    
    try:
        # Create a dummy file to test deletion
        with open(dummy_file_path, 'w') as f:
            f.write("test")
        print(f"ℹ️ Created temporary file: {dummy_file_path}")

        # Attempt to send it to the trash
        send2trash(dummy_file_path)
        print("✅ Successfully sent the temporary file to the Recycle Bin.")
        print("   This confirms send2trash itself is working.")
        
    except Exception as e:
        print(f"❌ Failed to send the temporary file to the Recycle Bin.")
        print(f"   Error: {e}")
        if os.path.exists(dummy_file_path):
             os.remove(dummy_file_path) # Clean up if send2trash failed

def run_diagnostics():
    """Main function to run all diagnostic checks."""
    target_folder = input("Enter the full path to the backup folder that fails to delete: ").strip()
    
    if not os.path.isdir(target_folder):
        print(f"❌ Error: The path provided is not a valid directory.")
        return

    print("\n==============================================")
    print(f"🔬 Running Diagnostics for: {target_folder}")
    print("==============================================")
    
    # Basic Info
    print("\n--- System Information ---")
    print(f"Python Version: {sys.version}")
    # The send2trash version could not be imported, likely an older version.
    # We will check the version using pip instead.
    pass
    print(f"Current User: {getpass.getuser()}")
    
    # Run checks
    is_cwd_issue = check_current_directory(target_folder)
    
    parent_dir = os.path.dirname(target_folder)
    check_permissions(parent_dir)
    check_permissions(target_folder)
    
    find_locking_processes(target_folder)
    
    test_send2trash(target_folder)
    
    print("\n==============================================")
    print("🔎 DIAGNOSTIC SUMMARY:")
    print("==============================================")
    print("Review the ❌ and ⚠️ messages above.")
    print("The most common cause of '[WinError 5] Access is denied' is a file lock.")
    print("Look for locking processes like 'explorer.exe' (File Explorer), 'cmd.exe' (your terminal), or your code editor (e.g., 'code.exe').")
    if is_cwd_issue:
        print("\n🔥 The Current Working Directory issue is the most likely culprit. Fix that first!")


if __name__ == "__main__":
    run_diagnostics()