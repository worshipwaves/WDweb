import os
import sys
import ctypes
import subprocess

def is_admin():
    """Check if the script is running with administrator privileges."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def run_command(command, description):
    """Runs a command and reports success or failure."""
    print(f"\n▶️  Executing: {description}...")
    print(f"   Command: {' '.join(command)}")
    try:
        # Using shell=True is okay here as we are building the command from trusted parts.
        # However, passing a list is safer.
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        print("✅  Success!")
        if result.stdout:
            # print(f"   Output:\n{result.stdout}") # Uncomment for verbose debugging
            pass
        return True
    except FileNotFoundError:
        print(f"❌  Error: Command not found. Is this a Windows machine?")
        return False
    except subprocess.CalledProcessError as e:
        print(f"❌  Error executing command. Return code: {e.returncode}")
        print(f"   Stderr:\n{e.stderr}")
        print(f"   Stdout:\n{e.stdout}")
        return False

def fix_folder_permissions():
    """Main function to take ownership and grant permissions."""
    if not is_admin():
        print("="*60)
        print("❌ ERROR: Administrator privileges are required.")
        print("Please re-run this script as an administrator.")
        print("\nHow to run as administrator:")
        print("1. Open the Start Menu.")
        print("2. Type 'cmd' or 'powershell'.")
        print("3. Right-click on 'Command Prompt' or 'Windows PowerShell'.")
        print("4. Select 'Run as administrator'.")
        print("5. In the new admin terminal, navigate to your project folder:")
        print(f"   cd {os.getcwd()}")
        print("6. Activate your venv: venv\\Scripts\\activate")
        print("7. Run the script: python fix_permissions.py")
        print("="*60)
        sys.exit(1)

    print("="*60)
    print("📁 Windows Folder Permission Fixer 📁")
    print("This script will take ownership and grant you Full Control")
    print("over a folder and all its contents.")
    print("="*60)

    # Use the parent of the script's dir as the default backup location
    default_backup_path = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'backups'))
    
    prompt = f"Enter the full path to the folder to fix (e.g., your 'backups' folder)\n[Default: {default_backup_path}]: "
    folder_path = input(prompt).strip().strip('"') or default_backup_path

    if not os.path.isdir(folder_path):
        print(f"\n❌ Error: The path '{folder_path}' is not a valid directory.")
        return

    print(f"\nTarget folder: {folder_path}")
    current_user = os.getlogin()
    print(f"Permissions will be granted to user: {current_user}")

    confirm = input("\n⚠️ This will modify system permissions. Do you want to continue? (y/n): ").lower()
    if confirm != 'y':
        print("Operation cancelled.")
        return
        
    # Command 1: Take Ownership (recursively)
    takeown_command = ["takeown", "/F", folder_path, "/R", "/D", "Y"]
    if not run_command(takeown_command, "Take ownership of folder and its contents"):
        print("\nFailed to take ownership. Cannot proceed with granting permissions.")
        return

    # Command 2: Grant Full Control (recursively)
    # The %USERNAME% variable is resolved by the shell, but using os.getlogin() is more explicit.
    permission_spec = f"{current_user}:(F)"
    icacls_command = ["icacls", folder_path, "/grant", permission_spec, "/T"]
    if not run_command(icacls_command, "Grant Full Control to the current user"):
        print("\nFailed to grant permissions.")
        return
        
    print("\n========================================================")
    print("🎉 All done! Permissions have been successfully updated.")
    print("You should now be able to run your backup script normally.")
    print("========================================================")


if __name__ == "__main__":
    fix_folder_permissions()