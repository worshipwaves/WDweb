#!/usr/bin/env python3
"""
Test script for the new CSG API endpoints.
Run this after applying Phase 1 changes to verify everything works.
"""

import json
import requests
from typing import Dict, Any


def test_panel_parameters():
    """Test the panel parameters endpoint."""
    print("\n=== Testing /geometry/panel-parameters ===")
    
    # Create test state (NO material_thickness)
    state = {
        "frame_design": {
            "finish_x": 36.0,
            "finish_y": 36.0,
            "number_sections": 2,
            "separation": 2.0
        }
    }
    
    response = requests.post(
        "http://localhost:8000/geometry/panel-parameters",
        json=state
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✓ Panel parameters retrieved:")
        print(f"  - Outer radius: {data['outer_radius']}")
        print(f"  - Thickness: {data['thickness']}")
        print(f"  - Separation: {data['separation']}")
        print(f"  - Number sections: {data['number_sections']}")
        return True
    else:
        print(f"✗ Error: {response.status_code} - {response.text}")
        return False


def test_slot_data():
    """Test the slot data endpoint."""
    print("\n=== Testing /geometry/slot-data ===")
    
    # Create test state with amplitudes
    num_slots = 48
    state = {
        "frame_design": {
            "finish_x": 36.0,
            "finish_y": 36.0,
            "number_sections": 2,
            "separation": 2.0
        },
        "pattern_settings": {
            "number_slots": num_slots,
            "slot_style": "radial",
            "bit_diameter": 0.25,
            "x_offset": 3.0,
            "y_offset": 0.5,
            "grain_angle": 90.0,
            "orientation": "auto",
            "scale_center_point": 1.0
        },
        "processed_amplitudes": [0.5 + (i * 0.01) for i in range(num_slots)]
    }
    
    response = requests.post(
        "http://localhost:8000/geometry/slot-data",
        json=state
    )
    
    if response.status_code == 200:
        data = response.json()
        slots = data.get("slots", [])
        print(f"✓ Slot data retrieved: {len(slots)} slots")
        if slots:
            print(f"  Sample slot[0]:")
            print(f"    - Position: ({slots[0]['x']:.2f}, {slots[0]['z']:.2f})")
            print(f"    - Angle: {slots[0]['angle']:.3f} rad")
            print(f"    - Dimensions: {slots[0]['length']:.2f} x {slots[0]['width']:.2f}")
        return True
    else:
        print(f"✗ Error: {response.status_code} - {response.text}")
        return False


def test_csg_data():
    """Test the combined CSG data endpoint."""
    print("\n=== Testing /geometry/csg-data ===")
    
    # Create complete test state
    num_slots = 24
    state = {
        "frame_design": {
            "finish_x": 36.0,
            "finish_y": 36.0,
            "number_sections": 3,
            "separation": 2.0
        },
        "pattern_settings": {
            "number_slots": num_slots,
            "slot_style": "radial",
            "bit_diameter": 0.25,
            "x_offset": 3.0,
            "y_offset": 0.5,
            "grain_angle": 90.0,
            "orientation": "auto",
            "scale_center_point": 1.0
        },
        "processed_amplitudes": [0.3 + (i * 0.02) for i in range(num_slots)]
    }
    
    response = requests.post(
        "http://localhost:8000/geometry/csg-data",
        json=state
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✓ CSG data retrieved:")
        
        # Check panel config
        panel = data.get("panel_config", {})
        print(f"  Panel config:")
        print(f"    - Outer radius: {panel.get('outer_radius')}")
        print(f"    - Number sections: {panel.get('number_sections')}")
        
        # Check slot data
        slots = data.get("slot_data", [])
        print(f"  Slot data: {len(slots)} slots")
        
        return True
    else:
        print(f"✗ Error: {response.status_code} - {response.text}")
        return False


def test_without_amplitudes():
    """Test that CSG data works without amplitudes."""
    print("\n=== Testing /geometry/csg-data without amplitudes ===")
    
    state = {
        "frame_design": {
            "finish_x": 36.0,
            "finish_y": 36.0,
            "number_sections": 4,
            "separation": 2.0
        }
    }
    
    response = requests.post(
        "http://localhost:8000/geometry/csg-data",
        json=state
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✓ CSG data retrieved (no amplitudes):")
        print(f"  - Panel config present: {bool(data.get('panel_config'))}")
        print(f"  - Slot data: {len(data.get('slot_data', []))} slots (should be 0)")
        return True
    else:
        print(f"✗ Error: {response.status_code} - {response.text}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("CSG API Endpoint Tests")
    print("=" * 60)
    print("\nMake sure the FastAPI server is running on localhost:8000")
    print("Run with: uvicorn api.main:app --reload")
    
    tests = [
        test_panel_parameters,
        test_slot_data,
        test_csg_data,
        test_without_amplitudes
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except requests.exceptions.ConnectionError:
            print("\n✗ ERROR: Could not connect to API server")
            print("  Make sure the server is running: uvicorn api.main:app --reload")
            return
        except Exception as e:
            print(f"\n✗ ERROR in {test.__name__}: {e}")
            results.append(False)
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary:")
    passed = sum(results)
    total = len(results)
    print(f"  Passed: {passed}/{total}")
    
    if passed == total:
        print("\n✅ All tests passed! Phase 1 backend changes are working correctly.")
        print("\nYou can now proceed to Phase 2: Frontend CSG Implementation")
    else:
        print("\n⚠ Some tests failed. Review the errors above.")


if __name__ == "__main__":
    main()