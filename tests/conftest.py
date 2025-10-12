# in tests/conftest.py

import sys
from pathlib import Path

# Add the project root directory to the Python path
# This allows pytest to find the 'services', 'core', etc. modules
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))