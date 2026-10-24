"""
FieldAssist - Complete Backend Test Suite Runner
Runs all module tests in sequence and produces a consolidated report.
"""

import subprocess
import sys
import os

TESTS = [
    ("Auth & Security Verification", ["python", "scripts/verify_auth.py", "b.akarsh2007@gmail.com", "Akarsh@9503"]),
    ("Retailer & Distributor Management", ["python", "scripts/test_retailers_distributors.py"]),
    ("Orders & Order History", ["python", "scripts/test_orders.py"]),
    ("Visits & Attendance", ["python", "scripts/test_visits_attendance.py"]),
    ("Dashboard Summary Analytics", ["python", "scripts/test_dashboard.py"]),
    ("GPS & Beat Planning", ["python", "scripts/test_beat_planning.py"]),
]

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("=" * 70)
    print(" FIELDASSIST BACKEND REGRESSION & VALIDATION SUITE")
    print("=" * 70)

    results = []

    for name, cmd in TESTS:
        print(f"\n>>> Running: {name} ...")
        proc = subprocess.run(cmd, cwd=root, capture_output=True, text=True)
        print(proc.stdout)
        if proc.stderr:
            print(proc.stderr)
        
        passed = (proc.returncode == 0)
        results.append((name, passed))

    print("\n" + "=" * 70)
    print(" SUMMARY OF TEST RESULTS")
    print("=" * 70)
    all_passed = True
    for name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        if not passed:
            all_passed = False
        print(f" {status} - {name}")

    print("=" * 70)
    if all_passed:
        print(" ALL TEST SUITES PASSED (100% SUCCESS)!")
        sys.exit(0)
    else:
        print(" SOME TESTS FAILED. Please review the output above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
