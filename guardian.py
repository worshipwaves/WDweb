#!/usr/bin/env python
"""
WaveDesigner Guardian Linter (v4 - Greenfield Edition)

This linter enforces the strict architectural rules of the new, stateless,
workflow-based application. It is your primary defense against architectural
drift and LLM-induced regressions.

PRIORITIES:
- BLOCKER: Prevents web deployment. MUST FIX.
- CRITICAL: Will cause bugs or data corruption in a concurrent environment.
- HIGH: Significant violation of architectural patterns.
- MEDIUM: Minor violation, introduces technical debt.
- LOW: Style or hints that improve maintainability.
"""
import argparse
import ast
import sys
from pathlib import Path
from typing import List, Dict
from dataclasses import dataclass
from enum import Enum

# --- Configuration ---

class ViolationPriority(Enum):
    BLOCKER = "BLOCKER"
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

@dataclass
class Violation:
    filepath: Path
    line: int
    v_type: str
    priority: ViolationPriority
    details: str

    def __str__(self):
        return f"{self.filepath}:{self.line} [{self.priority.value}] {self.v_type}: {self.details}"

class GuardianChecker(ast.NodeVisitor):
    """AST visitor that enforces the new architecture rules."""

    def __init__(self, filepath: Path):
        self.filepath = filepath
        self.violations = []
        self.current_class = None
        self.current_function = None
        self.layer = self._determine_layer(filepath)
        self.function_params = set()  # Track function parameters

    def _add_violation(self, v_type: str, priority: ViolationPriority, line: int, details: str):
        self.violations.append(Violation(self.filepath, line, v_type, priority, details))

    def _determine_layer(self, filepath: Path):
        parts = filepath.parts
        if 'services' in parts:
            if filepath.name == 'service_facade.py':
                return 'facade'
            return 'services'
        elif 'core' in parts:
            return 'core'
        elif 'adapters' in parts:
            return 'adapters'
        return 'unknown'

    def visit_Import(self, node):
        for alias in node.names:
            self._check_import(alias.name, node.lineno)
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            self._check_import(node.module, node.lineno)
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        old_class = self.current_class
        self.current_class = node.name
        if self.layer == 'services':
            self._check_for_stateful_service(node)
        self.generic_visit(node)
        self.current_class = old_class

    def visit_FunctionDef(self, node):
        old_function = self.current_function
        old_params = self.function_params  # Save old params
        self.current_function = node.name
        
        # Track function parameters
        self.function_params = set()
        for arg in node.args.args:
            self.function_params.add(arg.arg)
        for arg in node.args.posonlyargs:
            self.function_params.add(arg.arg)
        for arg in node.args.kwonlyargs:
            self.function_params.add(arg.arg)
        if node.args.vararg:
            self.function_params.add(node.args.vararg.arg)
        if node.args.kwarg:
            self.function_params.add(node.args.kwarg.arg)
        
        if self.layer in ['services', 'core']:
            self._check_for_default_args(node)
        self.generic_visit(node)
        self.current_function = old_function
        self.function_params = old_params  # Restore old params

    def visit_Call(self, node):
        if self.layer in ['services', 'core'] and isinstance(node.func, ast.Attribute):
            if node.func.attr in ['append', 'extend', 'insert', 'pop', 'remove', 'sort', 'reverse', 'update']:
                self._add_violation('STATE_MUTATION', ViolationPriority.CRITICAL, node.lineno,
                                    f"Forbidden call to mutating method '.{node.func.attr}()'")
        self.generic_visit(node)

    def visit_AugAssign(self, node):
        if self.layer in ['services', 'core']:
            target = node.target
            
            # Only flag mutations of parameters, attributes, or subscripts
            if isinstance(target, ast.Name) and target.id in self.function_params:
                self._add_violation('STATE_MUTATION', ViolationPriority.CRITICAL, node.lineno,
                                    f"Forbidden mutation of input parameter '{target.id}' with augmented assignment")
            elif isinstance(target, ast.Attribute):
                self._add_violation('STATE_MUTATION', ViolationPriority.CRITICAL, node.lineno,
                                    "Forbidden mutation of object attribute with augmented assignment")
            elif isinstance(target, ast.Subscript):
                self._add_violation('STATE_MUTATION', ViolationPriority.CRITICAL, node.lineno,
                                    "Forbidden mutation of collection element with augmented assignment")
            # Local variables are allowed - no violation
            
        self.generic_visit(node)

    def _check_import(self, module_name: str, line: int):
        if self.layer == 'adapters' and 'services.' in module_name and 'service_facade' not in module_name:
            self._add_violation('FACADE_BYPASS', ViolationPriority.CRITICAL, line,
                                f"Adapter is importing a service directly ('{module_name}'). Must use ServiceFacade.")
        if self.layer == 'core' and ('services' in module_name or 'dtos' in module_name):
            self._add_violation('CORE_IMPORTS_SERVICE_LAYER', ViolationPriority.HIGH, line,
                                f"Core layer cannot import from services or DTOs ('{module_name}').")
        if self.layer == 'services' and 'adapters' in module_name:
            self._add_violation('SERVICE_IMPORTS_ADAPTER', ViolationPriority.HIGH, line,
                                f"Service layer cannot import from adapters ('{module_name}').")

    def _check_for_stateful_service(self, class_node):
        init_method = next((n for n in class_node.body if isinstance(n, ast.FunctionDef) and n.name == '__init__'), None)
        if not init_method:
            return

        for stmt in ast.walk(init_method):
            if isinstance(stmt, ast.Assign):
                for target in stmt.targets:
                    if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == 'self':
                        is_dependency = target.attr.startswith('_')
                        if not is_dependency:
                            self._add_violation('STATEFUL_SERVICE', ViolationPriority.BLOCKER, stmt.lineno,
                                                f"Service must be stateless. Forbidden instance variable 'self.{target.attr}'.")

    def _check_for_default_args(self, func_node):
        has_defaults = bool(func_node.args.defaults) or any(d is not None for d in (func_node.args.kw_defaults or []))
        if has_defaults:
            self._add_violation('DEFAULT_ARGUMENT', ViolationPriority.BLOCKER, func_node.lineno,
                                f"Function '{func_node.name}' has default arguments, which are forbidden in services/core.")

def lint_file(filepath: Path) -> List[Violation]:
    try:
        content = filepath.read_text(encoding='utf-8')
        tree = ast.parse(content)
        checker = GuardianChecker(filepath)
        checker.visit(tree)
        return checker.violations
    except Exception as e:
        # Silently fail for syntax errors etc. during linting
        return []

def main():
    parser = argparse.ArgumentParser(description="WaveDesigner Guardian Linter (Greenfield Edition)")
    parser.add_argument('path', nargs='?', default='.', help='Path to check (default: current directory)')
    args = parser.parse_args()
    
    root = Path(args.path)
    all_violations = []
    files_checked = 0

    if root.is_file():
        files_to_check = [root]
    else:
        files_to_check = root.rglob("*.py")

    for py_file in files_to_check:
        if 'venv' in py_file.parts or '__pycache__' in py_file.parts or py_file.name.startswith('test_'):
            continue
        if 'backups' in py_file.parts or 'backup' in py_file.parts:
            continue
        if py_file.name in ['guardian.py', 'auto_guardian.py', '__init__.py']:
            continue
        files_checked += 1
        all_violations.extend(lint_file(py_file))

    print(f"Checked {files_checked} files.")
    if not all_violations:
        print("\nNo architecture violations found!")
        sys.exit(0)

    print(f"\nFound {len(all_violations)} architecture violations:")
    all_violations.sort(key=lambda v: (list(ViolationPriority).index(v.priority), str(v.filepath), v.line))
    
    current_priority = None
    for v in all_violations:
        if v.priority != current_priority:
            current_priority = v.priority
            print(f"\n--- {current_priority.value} ---")
        print(f"  - {v}")

    sys.exit(1)

if __name__ == "__main__":
    main()