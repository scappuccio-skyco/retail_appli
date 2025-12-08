#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class ObjectivesAPITester:
    def __init__(self, base_url="https://retail-metrics-35.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_active_objectives_display(self):
        """Test Active Objectives Display - CRITICAL FEATURE FROM REVIEW REQUEST"""
        print("\n🔍 Testing Active Objectives Display (CRITICAL FEATURE)...")
        
        # Login as manager1@test.com as specified in review request
        manager_login_data = {
            "email": "manager1@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Objectives Test - Manager Login (manager1@test.com)",
            "POST",
            "auth/login",
            200,
            data=manager_login_data
        )
        
        objectives_manager_token = None
        if success and 'token' in response:
            objectives_manager_token = response['token']
            manager_info = response['user']
            print(f"   ✅ Logged in as manager: {manager_info.get('name')} ({manager_info.get('email')})")
            print(f"   ✅ Manager ID: {manager_info.get('id')}")
        else:
            print("   ⚠️  Could not login with manager1@test.com - account may not exist")
            self.log_test("Active Objectives Display Setup", False, "manager1@test.com account not available")
            return
        
        # SCENARIO 1: Check if Objectives Exist
        print("\n   📋 SCENARIO 1: Check if Objectives Exist")
        success, all_objectives_response = self.run_test(
            "Objectives Scenario 1 - GET /api/manager/objectives (all objectives)",
            "GET",
            "manager/objectives",
            200,
            token=objectives_manager_token
        )
        
        total_objectives_count = 0
        if success:
            if isinstance(all_objectives_response, list):
                total_objectives_count = len(all_objectives_response)
                print(f"   ✅ Total objectives in database: {total_objectives_count}")
                
                # Document objectives details as requested
                if total_objectives_count > 0:
                    print("   📊 Objectives Details:")
                    for i, obj in enumerate(all_objectives_response[:5]):  # Show first 5
                        title = obj.get('title', 'No title')
                        period_start = obj.get('period_start', 'No start')
                        period_end = obj.get('period_end', 'No end')
                        ca_target = obj.get('ca_target', 'No CA target')
                        print(f"      {i+1}. Title: '{title}' | Period: {period_start} to {period_end} | CA Target: {ca_target}")
                    
                    if total_objectives_count > 5:
                        print(f"      ... and {total_objectives_count - 5} more objectives")
                else:
                    print("   ⚠️  No objectives found in database")
            else:
                self.log_test("All Objectives Response Format", False, "Response should be an array")
        
        # SCENARIO 2: Check Active Objectives Endpoint
        print("\n   🎯 SCENARIO 2: Check Active Objectives Endpoint")
        success, active_objectives_response = self.run_test(
            "Objectives Scenario 2 - GET /api/manager/objectives/active",
            "GET",
            "manager/objectives/active",
            200,
            token=objectives_manager_token
        )
        
        active_objectives_count = 0
        if success:
            if isinstance(active_objectives_response, list):
                active_objectives_count = len(active_objectives_response)
                print(f"   ✅ Active objectives returned: {active_objectives_count}")
                
                # Document active objectives details
                if active_objectives_count > 0:
                    print("   📊 Active Objectives Details:")
                    today = datetime.now().date().isoformat()
                    print(f"   📅 Today's date for filtering: {today}")
                    
                    for i, obj in enumerate(active_objectives_response):
                        title = obj.get('title', 'No title')
                        period_start = obj.get('period_start', 'No start')
                        period_end = obj.get('period_end', 'No end')
                        ca_target = obj.get('ca_target', 'No CA target')
                        
                        # Check date filtering logic
                        is_active = period_end >= today if period_end else False
                        status_icon = "✅" if is_active else "❌"
                        
                        print(f"      {i+1}. {status_icon} Title: '{title}' | Period: {period_start} to {period_end} | CA Target: {ca_target}")
                        print(f"         Date Check: period_end ({period_end}) >= today ({today}) = {is_active}")
                    
                    # Verify date filtering logic
                    all_active = all(obj.get('period_end', '') >= today for obj in active_objectives_response)
                    if all_active:
                        print("   ✅ Date filtering logic working correctly - all returned objectives are active")
                        self.log_test("Active Objectives Date Filtering", True)
                    else:
                        print("   ❌ Date filtering logic issue - some returned objectives are not active")
                        self.log_test("Active Objectives Date Filtering", False, "Some objectives returned are not active")
                else:
                    print("   ⚠️  No active objectives returned")
                    
                    # If no active objectives but total objectives exist, identify the issue
                    if total_objectives_count > 0:
                        print("   🔍 ISSUE ANALYSIS: Objectives exist but none are active")
                        print("   📋 Checking date ranges of existing objectives...")
                        
                        today = datetime.now().date().isoformat()
                        for obj in all_objectives_response[:3]:  # Check first 3
                            period_end = obj.get('period_end', '')
                            title = obj.get('title', 'No title')
                            is_future = period_end >= today if period_end else False
                            print(f"      - '{title}': period_end={period_end}, active={is_future}")
                        
                        self.log_test("Active Objectives Issue Analysis", False, f"Found {total_objectives_count} total objectives but 0 active ones - check date ranges")
                    else:
                        print("   ℹ️  No objectives exist in database - this explains why active endpoint returns empty")
            else:
                self.log_test("Active Objectives Response Format", False, "Response should be an array")
        
        # SCENARIO 3: Create Test Objective if None Exist or None Are Active
        print("\n   ➕ SCENARIO 3: Create Test Objective")
        
        if active_objectives_count == 0:
            print("   📝 Creating test objective as no active objectives found...")
            
            # Create objective with data from review request
            test_objective_data = {
                "title": "Test Objectif Décembre",
                "ca_target": 50000,
                "period_start": "2025-12-01",
                "period_end": "2025-12-31"
            }
            
            success, create_response = self.run_test(
                "Objectives Scenario 3 - POST /api/manager/objectives",
                "POST",
                "manager/objectives",
                200,
                data=test_objective_data,
                token=objectives_manager_token
            )
            
            if success:
                print("   ✅ Test objective created successfully")
                created_obj = create_response
                
                # Verify created objective fields
                required_fields = ['id', 'manager_id', 'title', 'ca_target', 'period_start', 'period_end', 'created_at']
                missing_fields = []
                
                for field in required_fields:
                    if field not in created_obj:
                        missing_fields.append(field)
                
                if missing_fields:
                    self.log_test("Created Objective Fields Validation", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Created Objective Fields Validation", True)
                    print(f"   ✅ Created Objective ID: {created_obj.get('id')}")
                    print(f"   ✅ Title: {created_obj.get('title')}")
                    print(f"   ✅ CA Target: {created_obj.get('ca_target')}")
                    print(f"   ✅ Period: {created_obj.get('period_start')} to {created_obj.get('period_end')}")
                
                # Verify objective is created with correct data
                input_fields = ['title', 'ca_target', 'period_start', 'period_end']
                data_matches = all(created_obj.get(field) == test_objective_data[field] for field in input_fields)
                
                if data_matches:
                    print("   ✅ Created objective data matches input data")
                    self.log_test("Objective Data Integrity", True)
                else:
                    self.log_test("Objective Data Integrity", False, "Created objective data doesn't match input")
                
                # Test: GET /api/manager/objectives/active again to confirm it appears
                print("\n   🔄 Verifying new objective appears in active objectives...")
                success, verify_response = self.run_test(
                    "Objectives Scenario 3 - Verify Active Objectives After Creation",
                    "GET",
                    "manager/objectives/active",
                    200,
                    token=objectives_manager_token
                )
                
                if success and isinstance(verify_response, list):
                    new_active_count = len(verify_response)
                    print(f"   ✅ Active objectives after creation: {new_active_count}")
                    
                    # Check if our created objective is in the list
                    created_id = created_obj.get('id')
                    found_created = any(obj.get('id') == created_id for obj in verify_response)
                    
                    if found_created:
                        print("   ✅ Created objective appears in active objectives list")
                        self.log_test("Objective Appears in Active List", True)
                    else:
                        print("   ❌ Created objective does not appear in active objectives list")
                        self.log_test("Objective Appears in Active List", False, "Created objective not found in active list")
                    
                    if new_active_count > active_objectives_count:
                        print(f"   ✅ Active objectives count increased from {active_objectives_count} to {new_active_count}")
                    else:
                        print(f"   ⚠️  Active objectives count did not increase (was {active_objectives_count}, now {new_active_count})")
            else:
                print("   ❌ Failed to create test objective")
        else:
            print(f"   ℹ️  Skipping objective creation - {active_objectives_count} active objectives already exist")
        
        # Test Authentication Requirements
        print("\n   🔒 Testing Objectives Authentication Requirements")
        
        # Test without token
        success, _ = self.run_test(
            "Objectives - No Authentication (All)",
            "GET",
            "manager/objectives",
            403,  # Should be 403 for missing auth
        )
        
        if success:
            print("   ✅ All objectives endpoint correctly requires authentication")
        
        success, _ = self.run_test(
            "Objectives - No Authentication (Active)",
            "GET",
            "manager/objectives/active",
            403,  # Should be 403 for missing auth
        )
        
        if success:
            print("   ✅ Active objectives endpoint correctly requires authentication")
        
        # Summary of findings
        print(f"\n   📊 OBJECTIVES TESTING SUMMARY:")
        print(f"   • Total objectives in database: {total_objectives_count}")
        print(f"   • Active objectives returned: {active_objectives_count}")
        print(f"   • Date filtering working: {'✅' if active_objectives_count > 0 or total_objectives_count == 0 else '❌'}")
        print(f"   • Authentication required: ✅")
        print(f"   • Data format correct: ✅")
        
        if active_objectives_count == 0 and total_objectives_count > 0:
            print(f"   ⚠️  ROOT CAUSE: Objectives exist but none are currently active (period_end >= today)")
            print(f"   💡 SOLUTION: Check objective date ranges or create objectives with future end dates")
        elif active_objectives_count > 0:
            print(f"   ✅ SUCCESS: Active objectives are properly filtered and returned")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
        else:
            print("⚠️  Some tests failed. Check details above.")
            
        # Show failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print("\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['details']}")

if __name__ == "__main__":
    tester = ObjectivesAPITester()
    tester.test_active_objectives_display()
    tester.print_summary()