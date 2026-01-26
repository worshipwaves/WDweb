#!/usr/bin/env python3
r"""
Project Files Collector
=======================

This script collects the contents of code and text files from specified directories
OR from a specific list of files, and combines them into a single formatted
document (markdown or plain text) that can be uploaded to Claude or used for
other purposes.

NEW: Use --files to specify exact file paths OR --dirs to search directories.

USAGE EXAMPLES:
---------------
1. Basic usage (collect all text/code files from current directory):
   python collect_project_files.py

2. Collect files from a specific project folder (using --dirs):
   python collect_project_files.py --dirs "C:/Users/paulj/my_project"
   # You can paste paths directly from Windows Explorer's "Copy as Path"

3. Collect only Python and JavaScript files from current directory (using default dir):
   python collect_project_files.py --extensions py js

4. Collect only specific files (ignores directory search):
   python collect_project_files.py --files "C:/path/to/file1.py" "C:/path/to/another/file2.js"

5. Collect files but ignore the 'old_code' folder (directory search mode):
   python collect_project_files.py --dirs . --exclude old_code
   # OR simply: python collect_project_files.py --exclude old_code (defaults to current dir)

6. Collect files without searching subfolders (directory search mode):
   python collect_project_files.py --dirs . --no-subfolders
   # OR simply: python collect_project_files.py --no-subfolders

7. Collect only HTML and CSS files from two folders (directory search mode):
   python collect_project_files.py --dirs folder1 folder2 --extensions html css

8. Create a plain text output instead of markdown:
   python collect_project_files.py --format text

9. Save the output to a specific file:
   python collect_project_files.py --output my_files.md
   # OR using --files option:
   python collect_project_files.py --files file1.py file2.py --output "C:/path/to/output.md"

10. Exclude specific files (directory search mode):
    python collect_project_files.py --exclude-files package-lock.json some_file.txt


WHAT THIS SCRIPT DOES:
---------------------
1. EITHER uses the list of files specified with the --files option.
2. OR searches through directories you specify with --dirs (or current directory by default) for files matching extensions/exclusions.
3. Combines them into one big file (either markdown or plain text).
4. Saves the combined file (defaults to C:/Users/paulj/WaveDesigner-refactor/combined_files_[date]_[time].ext).

COMMAND LINE OPTIONS:
-------------------
--dirs, -d        Directories to search for files (default: current directory if --files not used).
--files, -f       Specify exact file paths to include (takes priority over directory search).
--no-subfolders   Do not include subfolders (directory search only).
--exclude         Directories to exclude (directory search only, case-insensitive).
--exclude-files   Files to exclude by name (directory search only, case-insensitive).
--format          Output format: 'markdown' or 'text' (default: markdown).
--output          Custom output filename or directory (if ends with / or \).
--extensions      Specific file extensions for directory search (without dot, ignored if --files used).
"""

import argparse
import os
import re
from datetime import datetime

# =========================================================================
# HARD-CODED EXCLUDED DIRECTORIES (for directory search mode only)
# Add any directories you never want to include in your collection here
# These will be excluded in addition to any directories specified via --exclude
# =========================================================================
ALWAYS_EXCLUDED_DIRS = [
    # Common development directories
    "node_modules",
    "venv",
    "env",
    ".venv",
    ".env",
    "__pycache__",
    ".git",
    ".github",
    ".gitlab",
    ".svn",
    # Build output directories
    "build",
    "dist",
    "target",
    "out",
    "bin",
    "obj",
    # IDE and editor directories
    ".vscode",
    ".idea",
    ".vs",
    # Temporary and cache directories
    "tmp",
    "temp",
    "cache",
    ".cache",
    "logs",
    # Add your custom directories below
    # For example:
    # 'my_large_data_folder',
    # 'vendor',
    # 'deps',
    ".ruff_cache",
    "ai_compact",
    "assets",
    "backups",
    "combined_files",
    "dev_utils",
    "data",
    "logs",
    "projects",
    "refactoring_guidelines",
    "separated",
    "uploads",
    "svg-dxf uploads",
    "docs",
    "tests",
    "blender",
]

# =========================================================================
# HARD-CODED EXCLUDED FILES (for directory search mode only)
# Add any files you never want to include in your collection here
# These will be excluded in addition to any files specified via --exclude-files
# =========================================================================
ALWAYS_EXCLUDED_FILES = [
    "package-lock.json",
]
# =========================================================================


def sanitize_filename(filename):
    """
    Create a safe filename part or markdown header from a string.
    Remove special characters potentially problematic in filenames
    and replace with underscores.
    """
    # Allow alphanumeric characters, underscores, hyphens, and periods
    # Replace others with underscore
    sanitized = re.sub(r"[^\w\-_.]", "_", filename)
    # Also replace colon specifically, as it's often problematic in filenames
    sanitized = sanitized.replace(":", "_")
    return sanitized


def get_valid_extensions(custom_extensions=None):
    """
    Returns a list of valid file extensions to include based on defaults and custom extensions.
    (Used only in directory search mode)

    Args:
        custom_extensions (list): Optional list of custom extensions to use instead of defaults

    Returns:
        list: List of file extensions with dots
    """
    if custom_extensions:
        # Make sure all extensions have a leading dot
        return [ext if ext.startswith(".") else f".{ext}" for ext in custom_extensions]

    # Default list of file extensions to include
    return [
        ".txt",
        ".py",
        ".md",
        ".lua",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",  # Scripting/Markup
        ".html",
        ".htm",
        ".css",
        ".scss",
        ".sass",  # Web frontend
        ".json",
        ".xml",
        ".yaml",
        ".yml",
        ".toml",  # Data/Config
        ".csv",
        ".tsv",  # Tabular data
        ".sql",
        ".sh",
        ".bash",
        ".zsh",
        ".ps1",  # Shell/DB scripts
        ".java",
        ".c",
        ".cpp",
        ".h",
        ".cs",
        ".go",
        ".rb",
        ".php",  # Other languages
        ".svg",  # Vector Graphics (often text-based)
        ".config",
        ".conf",
        ".ini",  # Common config extensions
        ".dockerfile",
        ".env",  # DevOps/Env files
        ".gitignore",
        ".gitattributes",  # Git files (often useful)
        ".frag",
        ".vert",
        ".glsl",
    ]


def get_code_language(file_path):
    """
    Determines the language for syntax highlighting based on the file extension.

    Args:
        file_path (str): Path to the file (can be relative or absolute)

    Returns:
        str: Language name for syntax highlighting
    """
    file_ext = os.path.splitext(file_path)[1][1:].lower()
    filename_lower = os.path.basename(file_path).lower()

    # Handle files without extensions
    if not file_ext:
        if "dockerfile" in filename_lower:
            return "dockerfile"
        elif "makefile" in filename_lower:
            return "makefile"
        elif ".env" in filename_lower:  # check for presence of .env anywhere in name
            return "bash"  # or 'ini' depending on common format
        elif ".git" in filename_lower:  # check for .gitignore, .gitattributes etc.
            return "plaintext"  # or potentially 'ini' for attributes
        else:
            return "text"

    # Map extensions to language names
    extension_map = {
        "yml": "yaml",
        "js": "javascript",
        "jsx": "javascript",
        "ts": "typescript",
        "tsx": "typescript",
        "py": "python",
        "md": "markdown",
        "sh": "bash",
        "bash": "bash",
        "zsh": "bash",
        "cs": "csharp",
        "cpp": "cpp",
        "c": "c",
        "go": "go",
        "rb": "ruby",
        "php": "php",
        "java": "java",
        "html": "html",
        "htm": "html",
        "css": "css",
        "scss": "scss",
        "sass": "sass",
        "json": "json",
        "xml": "xml",
        "sql": "sql",
        "ps1": "powershell",
        "conf": "plaintext",  # Often ini-like, but plaintext is safer default
        "config": "plaintext",
        "ini": "ini",
        # Add '.txt' explicitly for clarity, defaulting to plaintext
        "txt": "plaintext",
    }

    # Default to the extension name itself if not found in map, or 'plaintext' for unknown
    return extension_map.get(file_ext, "plaintext")


def clean_path(path):
    """
    Clean a Windows path that might have been copied with "Copy as Path"
    Removes quotes and handles backslashes properly.
    """
    # Remove quotes if present
    if path.startswith('"') and path.endswith('"'):
        path = path[1:-1]

    # Return the path as is (Python will handle it correctly in os.path functions)
    return path


# --- Renamed original collect_files function ---
def collect_files_from_dirs(
    root_dirs, include_subfolders=True, extensions=None, excluded_dirs=None, excluded_files=None
):
    """
    Collect files with specified extensions from root directories and optionally their subfolders.
    (Used only when --files option is NOT provided)

    Args:
        root_dirs (list): List of root directory paths to search in
        include_subfolders (bool): Whether to include subfolders in the search
        extensions (list): List of file extensions (with dots) to collect
        excluded_dirs (list): List of directory names to exclude from search
        excluded_files (list): List of file names to exclude from collection

    Returns:
        list: List of tuples containing (relative_path, full_path) for each file
    """
    if extensions is None:
        # Should have been processed in main already, but have a fallback
        extensions = get_valid_extensions()

    # Combine always excluded dirs with user-specified excluded dirs
    all_excluded_dirs = ALWAYS_EXCLUDED_DIRS + (excluded_dirs or [])

    # Combine always excluded files with user-specified excluded files
    all_excluded_files = ALWAYS_EXCLUDED_FILES + (excluded_files or [])

    # Convert excluded_dirs to lowercase set for efficient case-insensitive comparison
    excluded_dirs_lower = {d.lower() for d in all_excluded_dirs}

    # Convert excluded_files to lowercase set for efficient case-insensitive comparison
    excluded_files_lower = {f.lower() for f in all_excluded_files}

    collected = []
    processed_dirs = (
        set()
    )  # Keep track of processed dirs to handle potential symlink loops/overlaps

    for root_dir in root_dirs:
        cleaned_root_dir = clean_path(root_dir)  # Clean path here as well
        abs_root_dir = os.path.abspath(cleaned_root_dir)  # Work with absolute paths
        if not os.path.exists(abs_root_dir):
            print(f"Warning: Directory '{root_dir}' does not exist. Skipping.")
            continue
        if not os.path.isdir(abs_root_dir):
            print(f"Warning: Path '{root_dir}' is not a directory. Skipping.")
            continue
        if abs_root_dir in processed_dirs:  # Avoid processing the same directory twice
            continue
        processed_dirs.add(abs_root_dir)

        if include_subfolders:
            # Walk through all subdirectories
            for dirpath, dirnames, filenames in os.walk(abs_root_dir, topdown=True):
                # Filter out excluded directories in-place for efficiency
                dirnames[:] = [
                    d
                    for d in dirnames
                    if d.lower() not in excluded_dirs_lower and not d.startswith(".")
                ]  # Also skip hidden dirs

                for filename in filenames:
                    # Skip excluded files
                    if filename.lower() in excluded_files_lower:
                        continue

                    # Check if file extension matches or if specific filename is in the extensions list
                    file_ext = os.path.splitext(filename)[1].lower()
                    # Allow matching by extension OR by full filename (for files like Dockerfile)
                    if file_ext in extensions or filename.lower() in [
                        ext.lstrip(".").lower() for ext in extensions
                    ]:
                        full_path = os.path.join(dirpath, filename)
                        relative_path = os.path.relpath(
                            full_path, abs_root_dir
                        )  # Relative to the specific root it was found under
                        # Normalize path separators for consistency
                        relative_path = relative_path.replace("\\", "/")
                        collected.append((relative_path, full_path))
        else:
            # Only search in the root directory, not in subdirectories
            try:
                for filename in os.listdir(abs_root_dir):
                    full_path = os.path.join(abs_root_dir, filename)
                    if os.path.isfile(full_path):  # Ensure it's a file
                        # Skip excluded files
                        if filename.lower() in excluded_files_lower:
                            continue

                        file_ext = os.path.splitext(filename)[1].lower()
                        # Allow matching by extension OR by full filename
                        if file_ext in extensions or filename.lower() in [
                            ext.lstrip(".").lower() for ext in extensions
                        ]:
                            # For non-recursive, relative path is just the filename
                            relative_path = filename
                            collected.append((relative_path, full_path))
            except OSError as e:
                print(f"Warning: Could not list directory '{abs_root_dir}': {e}. Skipping.")

    # Sort files by relative path for a consistent order
    return sorted(collected, key=lambda x: x[0])


# --- Modified document creation function signature ---
def create_markdown_document(collected_files, source_info, output_file):
    """
    Create a markdown document from the collected files.

    Args:
        collected_files (list): List of (identifier, full_path) tuples.
                                 'identifier' is relative_path for dir search,
                                 or user-provided path for --files mode.
        source_info (str): Description of how files were collected.
        output_file (str): Path to save the combined document.

    Returns:
        str: Path to the created document, or None if failed.
    """
    print(f"Processing {len(collected_files)} files sourced from: {source_info}")

    if not collected_files:
        print("No files were collected.")
        return None

    # Create markdown content
    markdown_content = "# Project Files Overview\n\n"
    markdown_content += f"**Generated on:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    markdown_content += f"**Source:** {source_info}\n"  # Use the provided source info string
    markdown_content += f"**Total files:** {len(collected_files)}\n\n"

    # Add file list to overview
    markdown_content += "## Files Included\n\n"
    for identifier, _ in collected_files:  # Use the identifier from the tuple
        markdown_content += f"- `{identifier}`\n"

    markdown_content += "\n---\n\n"  # Separator before file contents

    # Add content of each file
    for i, (identifier, full_path) in enumerate(collected_files):
        if identifier.lower().endswith(".md"):
            continue
        try:
            # Added progress indicator for large collections
            if len(collected_files) > 10 and (i + 1) % 5 == 0:
                print(f"Processing file {i + 1}/{len(collected_files)}: {identifier}")

            # Attempt to read with UTF-8, fall back to latin-1 if that fails
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    file_content = f.read()
            except UnicodeDecodeError:
                print(f"Warning: Could not read {identifier} as UTF-8, trying latin-1.")
                with open(full_path, "r", encoding="latin-1") as f:
                    file_content = f.read()
            except FileNotFoundError:
                print(
                    f"Error: File not found during processing: '{identifier}' ({full_path}). Skipping."
                )
                markdown_content += f"## File: `{identifier}`\n\n"
                markdown_content += "```text\n*** Error reading file: File not found ***\n```\n\n"
                continue  # Skip to the next file

            # Determine language hint for markdown code block using the identifier
            lang = get_code_language(identifier)

            markdown_content += f"## File: `{identifier}`\n\n"
            markdown_content += f"```{lang}\n{file_content}\n```\n\n"
        except Exception as e:
            print(
                f"Error reading file '{identifier}' ({full_path}): {e}"
            )  # Include full path in error
            markdown_content += f"## File: `{identifier}`\n\n"
            markdown_content += f"```text\n*** Error reading file: {e} ***\n```\n\n"

    # Create directory if it doesn't exist
    output_dir = os.path.dirname(output_file) or "."  # Handle case where output is in current dir
    try:
        os.makedirs(output_dir, exist_ok=True)
    except OSError as e:
        print(f"ERROR: Failed to create output directory '{output_dir}': {e}")
        return None

    # Write the markdown content to the output file
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(markdown_content)
        print(f"Created markdown document: {os.path.abspath(output_file)}")
        return output_file
    except Exception as e:
        print(f"ERROR: Failed to write output file '{output_file}': {e}")
        return None


# --- Modified document creation function signature ---
def create_text_document(collected_files, source_info, output_file):
    """
    Create a plain text document from the collected files.

    Args:
        collected_files (list): List of (identifier, full_path) tuples.
        source_info (str): Description of how files were collected.
        output_file (str): Path to save the combined document.

    Returns:
        str: Path to the created document, or None if failed.
    """
    print(f"Processing {len(collected_files)} files sourced from: {source_info}")

    if not collected_files:
        print("No files were collected.")
        return None

    # Create text content
    text_content = "PROJECT FILES OVERVIEW\n"
    text_content += "=====================\n\n"
    text_content += f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    text_content += f"Source: {source_info}\n"  # Use the provided source info string
    text_content += f"Total files: {len(collected_files)}\n\n"

    # Add file list to overview
    text_content += "FILES INCLUDED:\n"
    text_content += "===============\n\n"
    for identifier, _ in collected_files:
        text_content += f"- {identifier}\n"

    text_content += "\n" + "=" * 80 + "\n\n"  # Separator before file contents

    # Add content of each file
    for i, (identifier, full_path) in enumerate(collected_files):
        if identifier.lower().endswith(".md"):
            continue
        try:
            # Added progress indicator for large collections
            if len(collected_files) > 10 and (i + 1) % 5 == 0:
                print(f"Processing file {i + 1}/{len(collected_files)}: {identifier}")

            # Attempt to read with UTF-8, fall back to latin-1 if that fails
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    file_content = f.read()
            except UnicodeDecodeError:
                print(f"Warning: Could not read {identifier} as UTF-8, trying latin-1.")
                with open(full_path, "r", encoding="latin-1") as f:
                    file_content = f.read()
            except FileNotFoundError:
                print(
                    f"Error: File not found during processing: '{identifier}' ({full_path}). Skipping."
                )
                text_content += f"FILE: {identifier}\n"
                text_content += "=" * 80 + "\n\n"
                text_content += "*** Error reading file: File not found ***\n\n"
                text_content += "-" * 80 + "\n\n"
                continue  # Skip to next file

            text_content += f"FILE: {identifier}\n"
            text_content += "=" * 80 + "\n\n"
            text_content += file_content + "\n\n"  # Add newline after content
            text_content += "-" * 80 + "\n\n"
        except Exception as e:
            print(f"Error reading file '{identifier}' ({full_path}): {e}")
            text_content += f"FILE: {identifier}\n"
            text_content += "=" * 80 + "\n\n"
            text_content += f"*** Error reading file: {e} ***\n\n"
            text_content += "-" * 80 + "\n\n"

    # Create directory if it doesn't exist
    output_dir = os.path.dirname(output_file) or "."
    try:
        os.makedirs(output_dir, exist_ok=True)
    except OSError as e:
        print(f"ERROR: Failed to create output directory '{output_dir}': {e}")
        return None

    # Write the text content to the output file
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(text_content)
        print(f"Created text document: {os.path.abspath(output_file)}")
        return output_file
    except Exception as e:
        print(f"ERROR: Failed to write output file '{output_file}': {e}")
        return None


def main():
    # Default output directory - kept as hardcoded per requirement
    DEFAULT_OUTPUT_DIR = "C:/Users/paulj/WDweb/combined_files"    

    # --- CORRECTED argparse setup ---
    parser = argparse.ArgumentParser(
        description="Collect and combine content from project files (via directory search or specific files).",
        formatter_class=argparse.RawTextHelpFormatter,  # Preserve formatting in help text
    )

    # Input modes: Directories OR specific files (mutually exclusive)
    input_group = parser.add_mutually_exclusive_group()
    # OPTIONAL directories argument
    input_group.add_argument(
        "--dirs",
        "-d",
        nargs="*",
        default=None,
        help='Directories to search (default: current directory if --files not used). Use "." for current dir explicitly.',
    )
    # OPTIONAL specific files argument
    input_group.add_argument(
        "--files",
        "-f",
        nargs="+",
        default=None,
        help="Specify exact file paths to include (takes priority over directory search)",
    )

    # Options for directory search mode (only relevant if --dirs used or defaulted to)
    parser.add_argument(
        "--no-subfolders",
        action="store_true",
        help="Do not include subfolders (directory search mode only)",
    )
    parser.add_argument(
        "--exclude",
        nargs="+",
        default=[],
        help="Directories to exclude (directory search mode only, case-insensitive)",
    )
    parser.add_argument(
        "--exclude-files",
        nargs="+",
        default=[],
        help="Files to exclude by name (directory search mode only, case-insensitive)",
    )
    parser.add_argument(
        "--extensions",
        nargs="+",
        default=None,
        help="Specific file extensions for directory search (without dot, ignored if --files is used)",
    )

    # General options applicable to both modes
    parser.add_argument(
        "--format",
        choices=["markdown", "text"],
        default="markdown",
        help="Output format (default: markdown)",
    )
    parser.add_argument(
        "--output", "-o", help=f"Output file path or directory (defaults to {DEFAULT_OUTPUT_DIR})"
    )

    args = parser.parse_args()
    # --- End of corrected argparse setup ---

    # Clean any paths provided by user (remove quotes from Copy as Path)
    # Important: Clean paths *before* using them
    if args.dirs is not None:  # Check if --dirs was actually provided
        args.dirs = [clean_path(d) for d in args.dirs]
    if args.files:
        args.files = [clean_path(f) for f in args.files]
    if args.output:
        args.output = clean_path(args.output)

    collected_files = []  # Initialize empty list
    source_info = ""  # String describing the source of files

    # --- Determine collection mode ---
    if args.files:
        # --- Specific Files Mode ---
        print(
            f"Processing specific files provided via --files option ({len(args.files)} specified)."
        )
        source_info = f"Specified files ({len(args.files)})"
        # Warn if directory search options were also provided (they are ignored)
        if args.dirs is not None:
            print("Warning: --dirs option ignored because --files was used.")
        if args.extensions:
            print("Warning: --extensions option ignored because --files was used.")
        if args.exclude:
            print("Warning: --exclude option ignored because --files was used.")
        if args.exclude_files:
            print("Warning: --exclude-files option ignored because --files was used.")
        if args.no_subfolders:
            print("Warning: --no-subfolders option ignored because --files was used.")

        valid_files_temp = []
        for filepath in args.files:
            # Check if the provided path is an existing file
            if os.path.isfile(filepath):
                abs_path = os.path.abspath(filepath)
                # Store tuple: (identifier_path, absolute_path_for_reading)
                # Use the user-provided path as the identifier for headers/list
                valid_files_temp.append((filepath, abs_path))
            else:
                print(f"Warning: Specified file '{filepath}' not found or is not a file. Skipping.")

        # Sort by the identifier (the user-provided path) for consistent order
        collected_files = sorted(valid_files_temp, key=lambda x: x[0])

    else:
        # --- Directory Search Mode (either via --dirs or default) ---
        # Determine search directories: use --dirs if provided, otherwise default to current dir '.'
        search_dirs = args.dirs if args.dirs is not None else [".."]
        # Handle empty --dirs list (e.g., `python script.py --dirs`) - treat as default '.'
        if not search_dirs:
            search_dirs = ["."]

        print("Starting directory search mode.")
        print(f"Searching in directories: {', '.join(search_dirs)}")

        # Create absolute paths for source_info display *after* cleaning
        abs_search_dirs = [os.path.abspath(d) for d in search_dirs]
        source_info = f"Directories: {', '.join(abs_search_dirs)}"
        if args.no_subfolders:
            source_info += " (non-recursive)"
        if args.exclude:
            source_info += f", Excluded dirs: {', '.join(args.exclude)}"
        if args.exclude_files:
            source_info += f", Excluded files: {', '.join(args.exclude_files)}"

        # Process extensions for directory search
        extensions_to_use = get_valid_extensions(args.extensions)
        if args.extensions:
            print(
                f"Looking only for files with extensions: {', '.join(ext.lstrip('.') for ext in extensions_to_use)}"
            )
            source_info += (
                f", Extensions: {', '.join(ext.lstrip('.') for ext in extensions_to_use)}"
            )
        else:
            print("Using default file extensions.")
            # Optionally add default extensions to source_info if desired

        # Call the directory search function
        collected_files = collect_files_from_dirs(
            search_dirs, not args.no_subfolders, extensions_to_use, args.exclude, args.exclude_files
        )

    # --- Process output file path ---
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    output_file = None  # Initialize

    if args.output:
        # Check if the output is intended to be a directory
        # Check if path exists AND is a directory OR if it ends with a separator
        if (os.path.isdir(args.output)) or (
            args.output.endswith(os.path.sep) or args.output.endswith("/")
        ):  # Check both separators explicitly
            output_dir = args.output
            # Ensure directory exists (create if not)
            try:
                os.makedirs(output_dir, exist_ok=True)
                output_filename_base = f"combined_files_{timestamp}"
                output_file = os.path.join(
                    output_dir, f"{output_filename_base}.{'txt' if args.format == 'text' else 'md'}"
                )
            except OSError as e:
                print(
                    f"ERROR: Could not create specified output directory '{output_dir}': {e}. Falling back to default."
                )
                args.output = None  # Force fallback to default logic below
        else:
            # Assume it's a full file path
            output_file = args.output
            # Ensure the directory part of the path exists
            output_dir = os.path.dirname(output_file) or "."
            try:
                os.makedirs(output_dir, exist_ok=True)
            except OSError as e:
                print(
                    f"ERROR: Could not create directory for specified output file '{output_file}': {e}. Falling back to default."
                )
                args.output = None  # Force fallback to default logic below

    # Fallback to default directory if output wasn't set or failed to create dir
    if output_file is None:
        output_dir = DEFAULT_OUTPUT_DIR
        print(f"Using default output directory: {output_dir}")
        try:
            os.makedirs(output_dir, exist_ok=True)  # Ensure default directory exists
            output_filename_base = f"combined_files_{timestamp}"
            output_file = os.path.join(
                output_dir, f"{output_filename_base}.{'txt' if args.format == 'text' else 'md'}"
            )
        except OSError as e:
            print(f"ERROR: Failed to create default output directory '{output_dir}': {e}")
            print("Please check permissions or specify a valid output path using --output.")
            return  # Critical error, cannot proceed

    # Ensure output_file is actually set before proceeding
    if not output_file:
        print("ERROR: Could not determine a valid output file path. Exiting.")
        return

    print(f"Output will be saved to: {os.path.abspath(output_file)}")

    # --- Check if files were collected before proceeding ---
    if not collected_files:
        print("\nNo valid files were found or specified to process.")
        return  # Exit if no files

    print(f"\nFound {len(collected_files)} files to include in the output.")

    # --- Create the document based on format ---
    result_file = None
    if args.format == "markdown":
        # Pass the determined output_file path
        result_file = create_markdown_document(collected_files, source_info, output_file)
    else:  # 'text' format
        # Pass the determined output_file path
        result_file = create_text_document(collected_files, source_info, output_file)

    # --- Final confirmation ---
    if result_file:
        print("\nSuccess! Your files have been combined into:")
        print(f"{os.path.abspath(result_file)}")  # Show absolute path
        print("\nYou can now upload this file or use it as needed.")
    else:
        # Error message would have been printed by the creation function
        print("\nFailed to create the output document.")


if __name__ == "__main__":
    main()
