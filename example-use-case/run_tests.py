#!/usr/bin/env python3
"""
Test runner script for NatiChat application.
Provides easy commands to run different types of tests.
"""

import sys
import subprocess
import os
from pathlib import Path


def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print("=" * 60)

    try:
        result = subprocess.run(
            command, shell=True, check=True, capture_output=True, text=True
        )
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        return False


def main():
    """Main test runner function"""
    if len(sys.argv) < 2:
        print("NatiChat Test Runner")
        print("=" * 40)
        print("Usage:")
        print("  python run_tests.py all          - Run all tests")
        print("  python run_tests.py unit         - Run unit tests only")
        print("  python run_tests.py integration  - Run integration tests only")
        print("  python run_tests.py coverage     - Run tests with coverage report")
        print("  python run_tests.py quick        - Run tests quickly (no coverage)")
        print("  python run_tests.py verbose      - Run tests with verbose output")
        return

    command = sys.argv[1].lower()

    # Change to the example-use-case directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)

    if command == "all":
        success = run_command("pytest -v", "All tests with verbose output")
    elif command == "unit":
        success = run_command("pytest tests/test_app.py -v", "Unit tests only")
    elif command == "integration":
        success = run_command(
            "pytest tests/test_integration.py -v", "Integration tests only"
        )
    elif command == "coverage":
        success = run_command(
            "pytest --cov=app --cov-report=html --cov-report=term",
            "Tests with coverage report",
        )
    elif command == "quick":
        success = run_command("pytest --tb=short", "Quick test run")
    elif command == "verbose":
        success = run_command("pytest -vv --tb=long", "Very verbose test output")
    else:
        print(f"Unknown command: {command}")
        print("Available commands: all, unit, integration, coverage, quick, verbose")
        return

    if success:
        print("\n✅ Tests completed successfully!")
    else:
        print("\n❌ Tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
