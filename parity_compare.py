#!/usr/bin/env python3
"""
PARITY COMPARISON TOOL

Compares [PARITY-PYQT] and [PARITY-WEB] diagnostic outputs to identify divergence.

USAGE:
1. Run PyQt app with test audio, copy terminal output to pyqt_output.txt
2. Run Web backend with same audio, copy server logs to web_output.txt
3. Run: python parity_compare.py pyqt_output.txt web_output.txt

Or pipe directly:
    python parity_compare.py <(grep PARITY-PYQT pyqt.log) <(grep PARITY-WEB web.log)
"""

import json
import sys
import re
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class StageData:
    """Parsed stage data from diagnostic output."""
    stage: str
    data: Dict
    source: str  # 'pyqt' or 'web'


def parse_parity_line(line: str) -> Optional[Tuple[str, Dict]]:
    """Parse a [PARITY-*] line into (stage_name, data_dict)."""
    # Match [PARITY-PYQT] or [PARITY-WEB] followed by stage: {json}
    pattern = r'\[PARITY-(?:PYQT|WEB)\]\s+(\w+):\s*(\{.*\})'
    match = re.search(pattern, line)
    if match:
        stage = match.group(1)
        try:
            data = json.loads(match.group(2))
            return stage, data
        except json.JSONDecodeError:
            return None
    return None


def parse_file(filepath: str, source: str) -> Dict[str, StageData]:
    """Parse diagnostic output file into stage data dict."""
    stages = {}
    with open(filepath, 'r') as f:
        for line in f:
            result = parse_parity_line(line)
            if result:
                stage, data = result
                stages[stage] = StageData(stage=stage, data=data, source=source)
    return stages


def compare_arrays(arr1: List[float], arr2: List[float], tolerance: float = 1e-6) -> Tuple[bool, Optional[int], float]:
    """
    Compare two arrays element by element.
    Returns: (match, first_diff_index, max_diff)
    """
    if len(arr1) != len(arr2):
        return False, 0, float('inf')
    
    max_diff = 0.0
    first_diff_idx = None
    
    for i, (a, b) in enumerate(zip(arr1, arr2)):
        diff = abs(a - b)
        if diff > max_diff:
            max_diff = diff
        if diff > tolerance and first_diff_idx is None:
            first_diff_idx = i
    
    return first_diff_idx is None, first_diff_idx, max_diff


def compare_stages(pyqt: StageData, web: StageData, tolerance: float = 1e-6) -> Dict:
    """Compare two stage outputs and return detailed diff."""
    result = {
        'stage': pyqt.stage,
        'match': True,
        'differences': []
    }
    
    pyqt_data = pyqt.data
    web_data = web.data
    
    # Compare all keys
    all_keys = set(pyqt_data.keys()) | set(web_data.keys())
    
    for key in sorted(all_keys):
        if key not in pyqt_data:
            result['differences'].append({
                'key': key,
                'issue': 'missing_in_pyqt',
                'web_value': web_data[key]
            })
            result['match'] = False
            continue
            
        if key not in web_data:
            result['differences'].append({
                'key': key,
                'issue': 'missing_in_web',
                'pyqt_value': pyqt_data[key]
            })
            result['match'] = False
            continue
        
        pyqt_val = pyqt_data[key]
        web_val = web_data[key]
        
        # Handle array comparison
        if isinstance(pyqt_val, list) and isinstance(web_val, list):
            match, diff_idx, max_diff = compare_arrays(pyqt_val, web_val, tolerance)
            if not match:
                result['differences'].append({
                    'key': key,
                    'issue': 'array_mismatch',
                    'first_diff_index': diff_idx,
                    'max_diff': max_diff,
                    'pyqt_sample': pyqt_val[:5] if len(pyqt_val) >= 5 else pyqt_val,
                    'web_sample': web_val[:5] if len(web_val) >= 5 else web_val
                })
                result['match'] = False
                
        # Handle numeric comparison
        elif isinstance(pyqt_val, (int, float)) and isinstance(web_val, (int, float)):
            diff = abs(pyqt_val - web_val)
            if diff > tolerance:
                result['differences'].append({
                    'key': key,
                    'issue': 'value_mismatch',
                    'pyqt': pyqt_val,
                    'web': web_val,
                    'diff': diff
                })
                result['match'] = False
                
        # Handle string/other comparison
        elif pyqt_val != web_val:
            result['differences'].append({
                'key': key,
                'issue': 'value_mismatch',
                'pyqt': pyqt_val,
                'web': web_val
            })
            result['match'] = False
    
    return result


def main():
    if len(sys.argv) < 3:
        print("Usage: python parity_compare.py <pyqt_output.txt> <web_output.txt> [tolerance]")
        print("\nAlternatively, paste outputs inline:")
        print("  python parity_compare.py --interactive")
        sys.exit(1)
    
    if sys.argv[1] == '--interactive':
        print("Paste PyQt output (end with blank line):")
        pyqt_lines = []
        while True:
            line = input()
            if not line:
                break
            pyqt_lines.append(line)
        
        print("\nPaste Web output (end with blank line):")
        web_lines = []
        while True:
            line = input()
            if not line:
                break
            web_lines.append(line)
        
        # Parse inline
        pyqt_stages = {}
        for line in pyqt_lines:
            result = parse_parity_line(line)
            if result:
                stage, data = result
                pyqt_stages[stage] = StageData(stage=stage, data=data, source='pyqt')
        
        web_stages = {}
        for line in web_lines:
            result = parse_parity_line(line)
            if result:
                stage, data = result
                web_stages[stage] = StageData(stage=stage, data=data, source='web')
    else:
        pyqt_file = sys.argv[1]
        web_file = sys.argv[2]
        tolerance = float(sys.argv[3]) if len(sys.argv) > 3 else 1e-6
        
        pyqt_stages = parse_file(pyqt_file, 'pyqt')
        web_stages = parse_file(web_file, 'web')
    
    tolerance = 1e-6
    
    print("\n" + "="*70)
    print("PARITY COMPARISON REPORT")
    print("="*70)
    
    # Stage order for sequential comparison
    stage_order = [
        'stage0_loaded',
        'stage0b_silence_removed', 
        'stage1_resampled',
        'stage2_binned',
        'stage3_filtered',
        'stage4_afterExponent',
        'stage4b_normalized',
        'stage5_scaled',
        'geometry'
    ]
    
    all_stages = set(pyqt_stages.keys()) | set(web_stages.keys())
    ordered_stages = [s for s in stage_order if s in all_stages]
    ordered_stages += sorted(all_stages - set(stage_order))
    
    first_divergence = None
    
    for stage in ordered_stages:
        print(f"\n--- {stage} ---")
        
        if stage not in pyqt_stages:
            print(f"  ⚠️  MISSING in PyQt output")
            continue
            
        if stage not in web_stages:
            print(f"  ⚠️  MISSING in Web output")
            continue
        
        result = compare_stages(pyqt_stages[stage], web_stages[stage], tolerance)
        
        if result['match']:
            print(f"  ✅ MATCH")
        else:
            print(f"  ❌ DIVERGENCE DETECTED")
            if first_divergence is None:
                first_divergence = stage
            
            for diff in result['differences']:
                key = diff['key']
                issue = diff['issue']
                
                if issue == 'array_mismatch':
                    print(f"     [{key}] Array mismatch at index {diff['first_diff_index']}")
                    print(f"         Max diff: {diff['max_diff']:.10f}")
                    print(f"         PyQt[0:5]: {diff['pyqt_sample']}")
                    print(f"         Web[0:5]:  {diff['web_sample']}")
                    
                elif issue == 'value_mismatch':
                    if 'diff' in diff:
                        print(f"     [{key}] Value mismatch: PyQt={diff['pyqt']}, Web={diff['web']} (diff={diff['diff']:.10f})")
                    else:
                        print(f"     [{key}] Value mismatch: PyQt={diff['pyqt']}, Web={diff['web']}")
                        
                elif issue == 'missing_in_pyqt':
                    print(f"     [{key}] Missing in PyQt, Web={diff['web_value']}")
                    
                elif issue == 'missing_in_web':
                    print(f"     [{key}] Missing in Web, PyQt={diff['pyqt_value']}")
    
    print("\n" + "="*70)
    if first_divergence:
        print(f"🔴 FIRST DIVERGENCE: {first_divergence}")
        print(f"   Fix this stage before proceeding to downstream stages.")
    else:
        print("🟢 ALL STAGES MATCH - Parity confirmed!")
    print("="*70 + "\n")
    
    return 0 if first_divergence is None else 1


if __name__ == '__main__':
    sys.exit(main())
