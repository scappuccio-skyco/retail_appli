#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import RetailCoachAPITester

def main():
    """Run only Daily Challenge Feedback System tests"""
    print("🎯 Daily Challenge Feedback System Testing")
    print("=" * 60)
    
    tester = RetailCoachAPITester()
    
    # Run only the Daily Challenge tests
    tester.test_daily_challenge_feedback_system()
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Daily Challenge Test Summary: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All Daily Challenge tests passed!")
        return 0
    else:
        print("❌ Some Daily Challenge tests failed!")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)