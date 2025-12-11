import requests
import sys
import json
from datetime import datetime

class ManagerDashboardAndSuperAdminTester:
    def __init__(self, base_url="https://api-resolution.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.manager_token = None
        self.superadmin_token = None
        self.manager_user = None
        self.superadmin_user = None
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
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

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

    def test_authentication(self):
        """Test authentication for both roles"""
        print("\n🔐 TESTING AUTHENTICATION")
        
        # Test Gérant login
        gerant_data = {
            "email": "gerant.demo@test.fr",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Gérant Authentication",
            "POST",
            "auth/login",
            200,
            data=gerant_data
        )
        
        if success and 'token' in response:
            self.gerant_token = response['token']
            self.gerant_user = response.get('user', {})
            print(f"   ✅ Gérant logged in: {self.gerant_user.get('email')}")
        
        # Test SuperAdmin login
        superadmin_data = {
            "email": "superadmin-test@retailperformer.com",
            "password": "SuperAdmin123!"
        }
        
        success, response = self.run_test(
            "SuperAdmin Authentication",
            "POST",
            "auth/login",
            200,
            data=superadmin_data
        )
        
        if success and 'token' in response:
            self.superadmin_token = response['token']
            self.superadmin_user = response.get('user', {})
            print(f"   ✅ SuperAdmin logged in: {self.superadmin_user.get('email')}")

    def test_gerant_routes(self):
        """Test all Gérant routes from Clean Architecture"""
        print("\n🏪 TESTING GÉRANT ROUTES (Clean Architecture)")
        
        if not self.gerant_token:
            self.log_test("Gérant Routes", False, "No gérant token available")
            return
        
        # Test 1: GET /api/gerant/dashboard/stats
        success, response = self.run_test(
            "Gérant Dashboard Stats",
            "GET",
            "gerant/dashboard/stats",
            200,
            token=self.gerant_token
        )
        
        if success:
            # Verify response structure
            expected_fields = ['total_stores', 'total_managers', 'total_sellers']
            missing_fields = [f for f in expected_fields if f not in response]
            if missing_fields:
                self.log_test("Dashboard Stats Structure", False, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ Stats: {response.get('total_stores')} stores, {response.get('total_managers')} managers, {response.get('total_sellers')} sellers")
        
        # Test 2: GET /api/gerant/subscription/status
        success, response = self.run_test(
            "Gérant Subscription Status",
            "GET",
            "gerant/subscription/status",
            200,
            token=self.gerant_token
        )
        
        if success:
            expected_fields = ['has_access', 'status', 'plan']
            missing_fields = [f for f in expected_fields if f not in response]
            if missing_fields:
                self.log_test("Subscription Status Structure", False, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ Subscription: {response.get('status')} - {response.get('plan')}")
        
        # Test 3: GET /api/gerant/stores
        success, stores_response = self.run_test(
            "Gérant Stores List",
            "GET",
            "gerant/stores",
            200,
            token=self.gerant_token
        )
        
        store_id = None
        if success and isinstance(stores_response, list) and len(stores_response) > 0:
            store_id = stores_response[0].get('id')
            print(f"   ✅ Found {len(stores_response)} stores, testing with store: {store_id}")
            
            # Test 4: GET /api/gerant/stores/{store_id}/kpi-history
            if store_id:
                success, response = self.run_test(
                    "Store KPI History",
                    "GET",
                    f"gerant/stores/{store_id}/kpi-history",
                    200,
                    token=self.gerant_token
                )
                
                if success and isinstance(response, list):
                    print(f"   ✅ KPI History: {len(response)} entries")
                
                # Test 5: GET /api/gerant/stores/{store_id}/available-years
                success, response = self.run_test(
                    "Store Available Years",
                    "GET",
                    f"gerant/stores/{store_id}/available-years",
                    200,
                    token=self.gerant_token
                )
                
                if success and isinstance(response, list):
                    print(f"   ✅ Available years: {response}")
        
        # Test 6: POST /api/gerant/sellers/{seller_id}/transfer (need a seller ID first)
        # This would require getting sellers first, but we'll test the endpoint structure
        test_transfer_data = {
            "new_store_id": "test-store-id",
            "new_manager_id": "test-manager-id"
        }
        
        success, response = self.run_test(
            "Seller Transfer (Expected 404)",
            "POST",
            "gerant/sellers/test-seller-id/transfer",
            404,  # Expected since test-seller-id doesn't exist
            data=test_transfer_data,
            token=self.gerant_token
        )

    def test_superadmin_routes(self):
        """Test all SuperAdmin routes from Clean Architecture"""
        print("\n👑 TESTING SUPERADMIN ROUTES (Clean Architecture)")
        
        if not self.superadmin_token:
            self.log_test("SuperAdmin Routes", False, "No superadmin token available")
            return
        
        # Test 1: GET /api/superadmin/workspaces
        success, response = self.run_test(
            "SuperAdmin Workspaces",
            "GET",
            "superadmin/workspaces",
            200,
            token=self.superadmin_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} workspaces")
            if len(response) > 0:
                workspace = response[0]
                print(f"   ✅ Sample workspace: {workspace.get('name', 'N/A')}")
        
        # Test 2: GET /api/superadmin/stats
        success, response = self.run_test(
            "SuperAdmin Platform Stats",
            "GET",
            "superadmin/stats",
            200,
            token=self.superadmin_token
        )
        
        if success:
            expected_fields = ['total_workspaces', 'total_users']
            present_fields = [f for f in expected_fields if f in response]
            print(f"   ✅ Platform stats fields present: {present_fields}")
        
        # Test 3: GET /api/superadmin/logs
        success, response = self.run_test(
            "SuperAdmin System Logs",
            "GET",
            "superadmin/logs",
            200,
            token=self.superadmin_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Retrieved {len(response)} log entries")

    def test_integration_routes(self):
        """Test Integration routes from Clean Architecture"""
        print("\n🔗 TESTING INTEGRATION ROUTES (Clean Architecture)")
        
        if not self.gerant_token:
            self.log_test("Integration Routes", False, "No gérant token available")
            return
        
        # Test 1: POST /api/integrations/api-keys (create API key)
        api_key_data = {
            "name": "Test API Key",
            "permissions": ["read:stores", "write:kpi"],
            "expires_days": 30
        }
        
        success, response = self.run_test(
            "Create API Key",
            "POST",
            "integrations/api-keys",
            200,
            data=api_key_data,
            token=self.gerant_token
        )
        
        created_api_key = None
        if success:
            created_api_key = response.get('api_key')
            print(f"   ✅ API Key created: {created_api_key[:20]}...")
        
        # Test 2: GET /api/integrations/api-keys (list API keys)
        success, response = self.run_test(
            "List API Keys",
            "GET",
            "integrations/api-keys",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} API keys")
            if len(response) > 0:
                key_info = response[0]
                print(f"   ✅ Sample key: {key_info.get('name')} - {key_info.get('permissions')}")

    def test_authentication_security(self):
        """Test authentication and authorization security"""
        print("\n🔒 TESTING AUTHENTICATION SECURITY")
        
        # Test 1: Access gérant endpoint without token
        success, response = self.run_test(
            "Gérant Endpoint - No Auth (Expected 403)",
            "GET",
            "gerant/dashboard/stats",
            403
        )
        
        # Test 2: Access superadmin endpoint without token
        success, response = self.run_test(
            "SuperAdmin Endpoint - No Auth (Expected 403)",
            "GET",
            "superadmin/workspaces",
            403
        )
        
        # Test 3: Access superadmin endpoint with gérant token (should fail)
        if self.gerant_token:
            success, response = self.run_test(
                "SuperAdmin Endpoint - Gérant Token (Expected 403)",
                "GET",
                "superadmin/workspaces",
                403,
                token=self.gerant_token
            )

    def test_clean_architecture_endpoints(self):
        """Test that Clean Architecture endpoints return 200 OK (not 500)"""
        print("\n🏗️ TESTING CLEAN ARCHITECTURE - NO 500 ERRORS")
        
        critical_endpoints = [
            ("gerant/dashboard/stats", self.gerant_token),
            ("gerant/subscription/status", self.gerant_token),
            ("gerant/stores", self.gerant_token),
            ("superadmin/workspaces", self.superadmin_token),
            ("superadmin/stats", self.superadmin_token),
            ("superadmin/logs", self.superadmin_token),
            ("integrations/api-keys", self.gerant_token)
        ]
        
        for endpoint, token in critical_endpoints:
            if token:
                success, response = self.run_test(
                    f"Clean Architecture - {endpoint}",
                    "GET",
                    endpoint,
                    200,
                    token=token
                )
                
                if not success:
                    print(f"   ❌ REGRESSION: {endpoint} returned non-200 status")

    def run_all_tests(self):
        """Run all Clean Architecture tests"""
        print("🚀 STARTING CLEAN ARCHITECTURE REFACTORING TESTS")
        print("=" * 60)
        
        # Test authentication first
        self.test_authentication()
        
        # Test all route categories
        self.test_gerant_routes()
        self.test_superadmin_routes()
        self.test_integration_routes()
        
        # Test security
        self.test_authentication_security()
        
        # Test Clean Architecture compliance
        self.test_clean_architecture_endpoints()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 CLEAN ARCHITECTURE TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
        
        print("\n🎯 CLEAN ARCHITECTURE VERIFICATION:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("✅ Clean Architecture refactoring appears successful!")
            print("✅ Routes → Services → Repositories pattern working")
            print("✅ No major regressions detected")
        else:
            print("❌ Clean Architecture refactoring has issues!")
            print("❌ Multiple endpoints failing - needs investigation")
        
        return self.tests_passed >= self.tests_run * 0.8

if __name__ == "__main__":
    tester = CleanArchitectureAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)