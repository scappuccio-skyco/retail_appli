#!/usr/bin/env python3
"""
Manager Dashboard UI Backend Endpoints Test
Testing specific endpoints for Manager Dashboard UI changes as per review request
"""

import requests
import sys
import json
from datetime import datetime

class ManagerDashboardTester:
    def __init__(self, base_url="https://bugfix-retail.preview.emergentagent.com/api"):
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
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)

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

    def test_manager_dashboard_endpoints(self):
        """Test Manager Dashboard UI endpoints as specified in review request"""
        print("🔍 Testing Manager Dashboard UI Endpoints (REVIEW REQUEST)")
        print("=" * 60)
        
        # Test with specific credentials from review request
        login_data = {
            "email": "Manager12@test.com",
            "password": "demo123"
        }
        
        print("\n📋 AUTHENTICATION TEST:")
        success, response = self.run_test(
            "POST /api/auth/login with Manager12@test.com",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        manager_token = None
        if success and 'token' in response:
            manager_token = response['token']
            manager_info = response['user']
            print(f"   ✅ Logged in as: {manager_info.get('name')} ({manager_info.get('email')})")
            print(f"   ✅ Token received and valid")
        else:
            print("   ❌ Could not login with Manager12@test.com - account may not exist")
            print("   This is the specific account mentioned in the review request")
            self.log_test("Manager Dashboard Authentication", False, "Manager12@test.com login failed")
            return
        
        print("\n📊 DASHBOARD DATA LOADING TESTS:")
        
        # Test all dashboard endpoints as specified in review request
        dashboard_endpoints = [
            ("GET /api/manager/sellers", "manager/sellers", "Sellers list"),
            ("GET /api/manager/invitations", "manager/invitations", "Invitations"),
            ("GET /api/manager-diagnostic/me", "manager-diagnostic/me", "Manager diagnostic"),
            ("GET /api/manager/kpi-config", "manager/kpi-config", "KPI configuration"),
            ("GET /api/manager/challenges/active", "manager/challenges/active", "Active challenges data"),
            ("GET /api/manager/objectives/active", "manager/objectives/active", "Active objectives data"),
            ("GET /api/manager/store-kpi/stats", "manager/store-kpi/stats", "Store KPI stats"),
            ("GET /api/subscription/status", "subscription/status", "Subscription info")
        ]
        
        for test_name, endpoint, description in dashboard_endpoints:
            success, response = self.run_test(
                f"{test_name} - {description}",
                "GET",
                endpoint,
                200,
                token=manager_token
            )
            
            if success:
                print(f"   ✅ {description} endpoint working correctly")
                
                # Specific validation for key endpoints
                if endpoint == "manager/objectives/active":
                    if isinstance(response, list):
                        print(f"      📈 Retrieved {len(response)} active objective(s)")
                        if len(response) > 0:
                            obj = response[0]
                            required_fields = ['title', 'ca_target', 'period_start', 'period_end']
                            missing = [f for f in required_fields if f not in obj]
                            if not missing:
                                print(f"      ✅ Objectives data structure correct")
                                print(f"         Title: {obj.get('title')}")
                                print(f"         CA Target: {obj.get('ca_target')}")
                                print(f"         Period: {obj.get('period_start')} to {obj.get('period_end')}")
                            else:
                                self.log_test("Objectives Data Structure", False, f"Missing fields: {missing}")
                    else:
                        self.log_test("Objectives Response Format", False, "Should return array")
                
                elif endpoint == "manager/challenges/active":
                    if isinstance(response, list):
                        print(f"      🎯 Retrieved {len(response)} active challenge(s)")
                        if len(response) > 0:
                            challenge = response[0]
                            required_fields = ['title', 'start_date', 'end_date']
                            missing = [f for f in required_fields if f not in challenge]
                            if not missing:
                                print(f"      ✅ Challenges data structure correct")
                                print(f"         Title: {challenge.get('title')}")
                                print(f"         Period: {challenge.get('start_date')} to {challenge.get('end_date')}")
                                print(f"         CA Target: {challenge.get('ca_target', 'N/A')}")
                            else:
                                self.log_test("Challenges Data Structure", False, f"Missing fields: {missing}")
                    else:
                        self.log_test("Challenges Response Format", False, "Should return array")
                
                elif endpoint == "manager/store-kpi/stats":
                    if isinstance(response, dict):
                        print(f"      📊 Store KPI stats retrieved successfully")
                        print(f"      ✅ KPI data available for store modal")
                        print(f"         Keys: {list(response.keys())}")
                    else:
                        self.log_test("Store KPI Stats Format", False, "Should return object")
                
                elif endpoint == "subscription/status":
                    if isinstance(response, dict) and 'status' in response:
                        print(f"      💳 Subscription status: {response.get('status')}")
                        print(f"      ✅ Subscription info available")
                        if 'ai_credits_remaining' in response:
                            print(f"         AI Credits: {response.get('ai_credits_remaining')}")
                        if 'days_left' in response:
                            print(f"         Days Left: {response.get('days_left')}")
                    else:
                        self.log_test("Subscription Status Format", False, "Should return object with status")
                
                elif endpoint == "manager/sellers":
                    if isinstance(response, list):
                        print(f"      👥 Retrieved {len(response)} seller(s)")
                        if len(response) > 0:
                            seller = response[0]
                            print(f"         Sample seller: {seller.get('name')} ({seller.get('email')})")
                    else:
                        self.log_test("Sellers Response Format", False, "Should return array")
                
                elif endpoint == "manager/invitations":
                    if isinstance(response, list):
                        print(f"      📧 Retrieved {len(response)} invitation(s)")
                    else:
                        self.log_test("Invitations Response Format", False, "Should return array")
                
                elif endpoint == "manager/kpi-config":
                    if isinstance(response, dict):
                        print(f"      ⚙️ KPI configuration retrieved")
                        config_fields = ['track_ca', 'track_ventes', 'track_clients', 'track_articles']
                        for field in config_fields:
                            if field in response:
                                print(f"         {field}: {response[field]}")
                    else:
                        self.log_test("KPI Config Response Format", False, "Should return object")
            else:
                print(f"   ❌ {description} endpoint failed")
        
        print("\n🎯 FOCUS ON OBJECTIVES AND CHALLENGES ENDPOINTS:")
        
        # Detailed testing of objectives endpoint
        success, objectives_response = self.run_test(
            "Detailed Objectives Test - Data Structure Validation",
            "GET",
            "manager/objectives/active",
            200,
            token=manager_token
        )
        
        if success:
            if isinstance(objectives_response, list):
                print(f"   ✅ Objectives endpoint returns proper array format")
                
                for i, obj in enumerate(objectives_response):
                    print(f"      Objective {i+1}:")
                    print(f"        Title: {obj.get('title', 'N/A')}")
                    print(f"        CA Target: {obj.get('ca_target', 'N/A')}")
                    print(f"        Period: {obj.get('period_start', 'N/A')} to {obj.get('period_end', 'N/A')}")
                    
                    # Validate date format
                    if obj.get('period_start') and obj.get('period_end'):
                        try:
                            from datetime import datetime
                            start_date = datetime.fromisoformat(obj['period_start'].replace('Z', '+00:00'))
                            end_date = datetime.fromisoformat(obj['period_end'].replace('Z', '+00:00'))
                            print(f"        ✅ Date format valid")
                        except:
                            self.log_test("Objectives Date Format", False, "Invalid date format")
                
                self.log_test("Objectives Endpoint Detailed Validation", True)
            else:
                self.log_test("Objectives Endpoint Format", False, "Should return array")
        
        # Detailed testing of challenges endpoint
        success, challenges_response = self.run_test(
            "Detailed Challenges Test - Data Structure Validation",
            "GET",
            "manager/challenges/active",
            200,
            token=manager_token
        )
        
        if success:
            if isinstance(challenges_response, list):
                print(f"   ✅ Challenges endpoint returns proper array format")
                
                for i, challenge in enumerate(challenges_response):
                    print(f"      Challenge {i+1}:")
                    print(f"        Title: {challenge.get('title', 'N/A')}")
                    print(f"        Start: {challenge.get('start_date', 'N/A')}")
                    print(f"        End: {challenge.get('end_date', 'N/A')}")
                    print(f"        Target CA: {challenge.get('ca_target', 'N/A')}")
                    
                    # Validate required fields
                    required_fields = ['title', 'start_date', 'end_date']
                    missing = [f for f in required_fields if not challenge.get(f)]
                    if not missing:
                        print(f"        ✅ All required fields present")
                    else:
                        self.log_test("Challenge Required Fields", False, f"Missing: {missing}")
                
                self.log_test("Challenges Endpoint Detailed Validation", True)
            else:
                self.log_test("Challenges Endpoint Format", False, "Should return array")
        
        print("\n📊 STORE KPI MODAL DATA TEST:")
        
        # Test store KPI stats endpoint specifically
        success, kpi_stats_response = self.run_test(
            "Store KPI Stats - Modal Data Validation",
            "GET",
            "manager/store-kpi/stats",
            200,
            token=manager_token
        )
        
        if success:
            print(f"   ✅ Store KPI stats endpoint working")
            print(f"   ✅ Data available for store KPI modal")
            
            # Validate KPI data structure
            if isinstance(kpi_stats_response, dict):
                print(f"      KPI Stats keys: {list(kpi_stats_response.keys())}")
                self.log_test("Store KPI Modal Data", True)
            else:
                self.log_test("Store KPI Stats Format", False, "Should return object")
        
        print("\n🔒 AUTHENTICATION AND ERROR HANDLING:")
        
        # Test endpoints without authentication
        test_endpoints = [
            "manager/sellers",
            "manager/objectives/active", 
            "manager/challenges/active",
            "manager/store-kpi/stats"
        ]
        
        for endpoint in test_endpoints:
            success, _ = self.run_test(
                f"Auth Test - {endpoint} without token",
                "GET",
                endpoint,
                401  # Should return 401 Unauthorized
            )
            
            if success:
                print(f"   ✅ {endpoint} correctly requires authentication")
            else:
                print(f"   ⚠️  {endpoint} authentication check failed")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("🎯 MANAGER DASHBOARD TESTING SUMMARY")
        print("=" * 60)
        print(f"Total Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
        
        passed_tests = [test for test in self.test_results if test['success']]
        if passed_tests:
            print(f"\n✅ PASSED TESTS:")
            for test in passed_tests:
                print(f"   • {test['test']}")
        
        print("=" * 60)

def main():
    """Main test execution"""
    tester = ManagerDashboardTester()
    
    try:
        tester.test_manager_dashboard_endpoints()
        tester.print_summary()
        
        # Exit with appropriate code
        if tester.tests_passed == tester.tests_run:
            print("\n🎉 All tests passed!")
            sys.exit(0)
        else:
            print(f"\n⚠️  {tester.tests_run - tester.tests_passed} test(s) failed")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Testing failed with error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()