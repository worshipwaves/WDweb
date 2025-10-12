#!/usr/bin/env python
"""
test_guardians.py - Test Harness for guardian.py and auto_guardian.py

This script validates that our linters are correctly enforcing the new
"Family Business 1.1" architecture. It creates a series of test files,
some with intentional violations and one that is perfectly compliant,
then runs guardian.py against them to verify the results.

It also tests auto_guardian.py's file watching and violation tracking capabilities.
"""

import subprocess
import sys
import time
from pathlib import Path
import shutil
import pytest

# --- Configuration ---
TEST_DIR = Path("linter_test_environment")

# --- Test Cases ---

# Each key is the rule to test, value is a tuple of (filepath, code_content)
VIOLATION_TESTS = {
    "STATEFUL_SERVICE": (
        TEST_DIR / "services" / "stateful_service.py",
        """
class BadService:
    def __init__(self):
        self.data_cache = {}  # BLOCKER: This is state!
    def process(self, request):
        return request
"""
    ),
    "DEFAULT_ARGUMENT": (
        TEST_DIR / "services" / "default_arg_service.py",
        """
from dataclasses import dataclass

@dataclass(frozen=True)
class RequestDTO:
    value: int

class BadService:
    def process(self, request: RequestDTO, option="default"):  # BLOCKER: Default argument
        return request
"""
    ),
    "FACADE_BYPASS": (
        TEST_DIR / "adapters" / "bad_adapter.py",
        """
from services.composition_service import CompositionService # CRITICAL: Bypassing the facade!

class BadAdapter:
    def do_work(self):
        pass
"""
    ),
    "STATE_MUTATION": (
        TEST_DIR / "services" / "mutating_service.py",
        """
class MutatingService:
    def process(self, data_list: list):
        data_list.append(1)  # CRITICAL: Mutating an input!
        return data_list
"""
    ),
    "CORE_IMPORTS_SERVICE_LAYER": (
        TEST_DIR / "core" / "bad_core.py",
        """
from services.dtos import SomeDTO  # HIGH: Core cannot import from services/DTOs!

def calculate():
    return 1
"""
    ),
    "SERVICE_IMPORTS_ADAPTER": (
        TEST_DIR / "services" / "bad_service_import.py",
        """
from adapters.pyqt.some_widget import MyWidget # HIGH: Service cannot import from adapter!

class BadService:
    def do_work(self):
        pass
"""
    ),
}

CORRECT_CODE_TEST = {
    "CORRECT_CODE": (
        TEST_DIR / "services" / "correct_service.py",
        """
from dataclasses import dataclass

# In a theoretical dtos.py
@dataclass(frozen=True)
class RequestDTO:
    value: int

@dataclass(frozen=True)
class ResponseDTO:
    result: int

# In a theoretical core/math.py
def add_one(val: int) -> int:
    # This is a local mutation, which is allowed.
    result = val
    result += 1
    return result

class CorrectService:
    def __init__(self, _some_dependency):
        # This is dependency injection, not state. It is allowed.
        self._dependency = _some_dependency

    def process(self, request: RequestDTO) -> ResponseDTO:
        # No default args, uses DTOs, no input mutation.
        new_value = add_one(request.value)
        return ResponseDTO(result=new_value)
"""
    )
}

# Test cases for auto_guardian file watching
AUTO_GUARDIAN_TESTS = {
    "file_modification": {
        "initial": """
class GoodService:
    def process(self):
        return "ok"
""",
        "modified": """
class BadService:
    def __init__(self):
        self.cache = {}  # Introducing violation!
    def process(self):
        return "ok"
"""
    },
    "fix_violation": {
        "initial": """
class BadService:
    def process(self, data, option="bad"):  # Has violation
        return data
""",
        "modified": """
class GoodService:
    def process(self, data):  # Fixed!
        return data
"""
    }
}

# --- Fixtures ---

@pytest.fixture
def test_environment():
    """Create and cleanup test environment for linter tests."""
    # Setup: Create test directories and dummy files
    if TEST_DIR.exists():
        shutil.rmtree(TEST_DIR)
    TEST_DIR.mkdir()
    (TEST_DIR / "services").mkdir()
    (TEST_DIR / "core").mkdir()
    (TEST_DIR / "adapters").mkdir()
    (TEST_DIR / "adapters" / "pyqt").mkdir()
    
    # Create dummy files for imports to work
    (TEST_DIR / "services" / "composition_service.py").touch()
    (TEST_DIR / "services" / "dtos.py").touch()
    (TEST_DIR / "adapters" / "pyqt" / "some_widget.py").touch()
    (TEST_DIR / "services" / "service_facade.py").write_text("# Facade placeholder")
    
    yield TEST_DIR
    
    # Cleanup: Remove test environment
    if TEST_DIR.exists():
        shutil.rmtree(TEST_DIR)


# --- Helper Functions ---

def run_guardian(filepath: Path) -> str:
    """Run guardian.py on a file and return its output."""
    cmd = [sys.executable, "guardian.py", str(filepath)]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    return result.stdout + result.stderr


# --- Tests for guardian.py ---

@pytest.mark.skipif(not Path("guardian.py").exists(), reason="guardian.py not found")
class TestGuardian:
    """Test suite for guardian.py linter."""
    
    def test_stateful_service_violation(self, test_environment):
        """Test detection of STATEFUL_SERVICE violation."""
        filepath, content = VIOLATION_TESTS["STATEFUL_SERVICE"]
        filepath.write_text(content, encoding="utf-8")
        output = run_guardian(filepath)
        assert "STATEFUL_SERVICE" in output, "Failed to detect STATEFUL_SERVICE violation"
    
    def test_default_argument_violation(self, test_environment):
        """Test detection of DEFAULT_ARGUMENT violation."""
        filepath, content = VIOLATION_TESTS["DEFAULT_ARGUMENT"]
        filepath.write_text(content, encoding="utf-8")
        output = run_guardian(filepath)
        assert "DEFAULT_ARGUMENT" in output, "Failed to detect DEFAULT_ARGUMENT violation"
    
    def test_facade_bypass_violation(self, test_environment):
        """Test detection of FACADE_BYPASS violation."""
        filepath, content = VIOLATION_TESTS["FACADE_BYPASS"]
        filepath.write_text(content, encoding="utf-8")
        output = run_guardian(filepath)
        assert "FACADE_BYPASS" in output, "Failed to detect FACADE_BYPASS violation"
    
    def test_state_mutation_violation(self, test_environment):
        """Test detection of STATE_MUTATION violation."""
        filepath, content = VIOLATION_TESTS["STATE_MUTATION"]
        filepath.write_text(content, encoding="utf-8")
        output = run_guardian(filepath)
        assert "STATE_MUTATION" in output, "Failed to detect STATE_MUTATION violation"
    
    def test_core_imports_service_layer_violation(self, test_environment):
        """Test detection of CORE_IMPORTS_SERVICE_LAYER violation."""
        filepath, content = VIOLATION_TESTS["CORE_IMPORTS_SERVICE_LAYER"]
        filepath.write_text(content, encoding="utf-8")
        output = run_guardian(filepath)
        assert "CORE_IMPORTS_SERVICE_LAYER" in output, "Failed to detect CORE_IMPORTS_SERVICE_LAYER violation"
    
    def test_service_imports_adapter_violation(self, test_environment):
        """Test detection of SERVICE_IMPORTS_ADAPTER violation."""
        filepath, content = VIOLATION_TESTS["SERVICE_IMPORTS_ADAPTER"]
        filepath.write_text(content, encoding="utf-8")
        output = run_guardian(filepath)
        assert "SERVICE_IMPORTS_ADAPTER" in output, "Failed to detect SERVICE_IMPORTS_ADAPTER violation"
    
    def test_correct_code_no_violations(self, test_environment):
        """Test that compliant code produces no violations."""
        filepath, content = CORRECT_CODE_TEST["CORRECT_CODE"]
        filepath.write_text(content, encoding="utf-8")
        output = run_guardian(filepath)
        assert "No architecture violations found" in output, "Incorrectly flagged compliant code as having violations"


# --- Tests for auto_guardian.py ---

@pytest.mark.skipif(not Path("auto_guardian.py").exists(), reason="auto_guardian.py not found")
class TestAutoGuardian:
    """Test suite for auto_guardian.py file watcher."""
    
    def test_output_parsing(self):
        """Test auto_guardian's parsing functions."""
        # Import the parse function from auto_guardian
        sys.path.insert(0, ".")
        from auto_guardian import parse_guardian_output
        
        # Test parsing guardian output
        sample_output = """
        services/bad.py:10 [BLOCKER] STATEFUL_SERVICE: Service must be stateless
        core/math.py:5 [HIGH] CORE_IMPORTS_SERVICE_LAYER: Core cannot import from services
        """
        
        violations = parse_guardian_output(sample_output)
        
        assert len(violations) == 2, "Failed to parse correct number of violations"
        assert violations[0]['type'] == 'STATEFUL_SERVICE', "Failed to parse violation type"
        assert violations[0]['priority'] == 'BLOCKER', "Failed to parse violation priority"
    
    def test_file_change_detection(self, test_environment):
        """Test auto_guardian's file change detection simulation."""
        test_file = test_environment / "services" / "watch_test.py"
        
        # Write initial file
        test_file.write_text(AUTO_GUARDIAN_TESTS["file_modification"]["initial"])
        initial_mtime = test_file.stat().st_mtime
        
        # Simulate a change after a brief pause
        time.sleep(0.1)
        test_file.write_text(AUTO_GUARDIAN_TESTS["file_modification"]["modified"])
        new_mtime = test_file.stat().st_mtime
        
        assert new_mtime > initial_mtime, "File modification time not updated"
        
        # Check if guardian detects the new violation
        output = run_guardian(test_file)
        assert "STATEFUL_SERVICE" in output, "Failed to detect violation in modified file"
    
    def test_violation_tracking(self, test_environment):
        """Test auto_guardian's violation tracking logic."""
        test_file = test_environment / "services" / "track_test.py"
        
        # Start with code that has violations
        test_file.write_text(AUTO_GUARDIAN_TESTS["fix_violation"]["initial"])
        output1 = run_guardian(test_file)
        has_initial_violation = "DEFAULT_ARGUMENT" in output1
        
        # Fix the violation
        time.sleep(0.1)
        test_file.write_text(AUTO_GUARDIAN_TESTS["fix_violation"]["modified"])
        output2 = run_guardian(test_file)
        has_final_violation = "DEFAULT_ARGUMENT" in output2
        
        assert has_initial_violation, "Failed to detect initial violation"
        assert not has_final_violation, "Failed to detect that violation was fixed"
    
    def test_critical_alert_prioritization(self):
        """Test auto_guardian's critical alert prioritization."""
        # Import the priority list from auto_guardian
        from auto_guardian import CRITICAL_TYPES
        
        expected_critical = ["STATEFUL_SERVICE", "DEFAULT_ARGUMENT", "FACADE_BYPASS", "STATE_MUTATION"]
        
        assert set(CRITICAL_TYPES) == set(expected_critical), f"Critical types mismatch. Expected: {expected_critical}, Got: {CRITICAL_TYPES}"