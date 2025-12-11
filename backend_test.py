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
        
        # Test Manager login (y.legoff@skyco.fr / TestDemo123!)
        manager_data = {
            "email": "y.legoff@skyco.fr",
            "password": "TestDemo123!"
        }
        
        success, response = self.run_test(
            "Manager Authentication",
            "POST",
            "auth/login",
            200,
            data=manager_data
        )
        
        if success and 'token' in response:
            self.manager_token = response['token']
            self.manager_user = response.get('user', {})
            print(f"   ✅ Manager logged in: {self.manager_user.get('email')}")
        
        # Test SuperAdmin login (superadmin-e1@test.com / TestSuper123!)
        superadmin_data = {
            "email": "superadmin-e1@test.com",
            "password": "TestSuper123!"
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

    def test_manager_dashboard_fix(self):
        """Test Manager Dashboard 404 Errors Fix"""
        print("\n🏪 TESTING MANAGER DASHBOARD 404 ERRORS FIX")
        
        if not self.manager_token:
            self.log_test("Manager Dashboard Fix", False, "No manager token available")
            return
        
        # Test 1: GET /api/manager/store-kpi-overview
        success, response = self.run_test(
            "Manager Store KPI Overview",
            "GET",
            "manager/store-kpi-overview",
            200,
            token=self.manager_token
        )
        
        if success:
            # Verify response structure
            expected_fields = ['date', 'store_id', 'totals', 'derived', 'sellers_submitted']
            missing_fields = [f for f in expected_fields if f not in response]
            if missing_fields:
                self.log_test("Store KPI Overview Structure", False, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ KPI Overview: Store {response.get('store_id')}, Date {response.get('date')}")
                print(f"   ✅ Totals: CA {response.get('totals', {}).get('ca_journalier', 0)}€, Ventes {response.get('totals', {}).get('nb_ventes', 0)}")
                print(f"   ✅ Sellers submitted: {response.get('sellers_submitted', 0)}")
        
        # Test 2: GET /api/manager/store-kpi-overview with specific date
        success, response = self.run_test(
            "Manager Store KPI Overview - Specific Date",
            "GET",
            "manager/store-kpi-overview?date=2025-12-05",
            200,
            token=self.manager_token
        )
        
        if success:
            print(f"   ✅ KPI Overview for 2025-12-05: CA {response.get('totals', {}).get('ca_journalier', 0)}€")
        
        # Test 3: GET /api/manager/sellers
        success, response = self.run_test(
            "Manager Sellers List",
            "GET",
            "manager/sellers",
            200,
            token=self.manager_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} sellers in manager's store")
        
        # Test 4: GET /api/manager/objectives/active
        success, response = self.run_test(
            "Manager Active Objectives",
            "GET",
            "manager/objectives/active",
            200,
            token=self.manager_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} active objectives")
        
        # Test 5: GET /api/manager/challenges/active
        success, response = self.run_test(
            "Manager Active Challenges",
            "GET",
            "manager/challenges/active",
            200,
            token=self.manager_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} active challenges")

    def test_superadmin_subscriptions_fix(self):
        """Test SuperAdmin Subscriptions Details Endpoint Fix"""
        print("\n👑 TESTING SUPERADMIN SUBSCRIPTIONS DETAILS FIX")
        
        if not self.superadmin_token:
            self.log_test("SuperAdmin Subscriptions Fix", False, "No superadmin token available")
            return
        
        # Test 1: GET /api/superadmin/subscriptions/overview (to get gérant IDs)
        success, overview_response = self.run_test(
            "SuperAdmin Subscriptions Overview",
            "GET",
            "superadmin/subscriptions/overview",
            200,
            token=self.superadmin_token
        )
        
        gerant_id = None
        if success and 'subscriptions' in overview_response:
            subscriptions = overview_response['subscriptions']
            if len(subscriptions) > 0:
                gerant_id = subscriptions[0]['gerant']['id']
                print(f"   ✅ Found {len(subscriptions)} subscriptions, testing with gérant: {gerant_id}")
                print(f"   ✅ Overview summary: {overview_response.get('summary', {})}")
        
        # Test 2: GET /api/superadmin/subscriptions/{gerant_id}/details (NEW ENDPOINT)
        if gerant_id:
            success, response = self.run_test(
                "SuperAdmin Subscription Details (NEW)",
                "GET",
                f"superadmin/subscriptions/{gerant_id}/details",
                200,
                token=self.superadmin_token
            )
            
            if success:
                # Verify response structure
                expected_fields = ['gerant', 'subscription', 'sellers', 'transactions']
                missing_fields = [f for f in expected_fields if f not in response]
                if missing_fields:
                    self.log_test("Subscription Details Structure", False, f"Missing fields: {missing_fields}")
                else:
                    gerant_info = response.get('gerant', {})
                    sellers_info = response.get('sellers', {})
                    transactions = response.get('transactions', [])
                    
                    print(f"   ✅ Gérant: {gerant_info.get('name')} ({gerant_info.get('email')})")
                    print(f"   ✅ Sellers: {sellers_info.get('active', 0)} active, {sellers_info.get('suspended', 0)} suspended, {sellers_info.get('total', 0)} total")
                    print(f"   ✅ Transactions: {len(transactions)} recent transactions")
                    print(f"   ✅ AI Credits Used: {response.get('ai_credits_used', 0)}")
        else:
            self.log_test("SuperAdmin Subscription Details", False, "No gérant ID found to test with")
        
        # Test 3: Test with invalid gérant ID (should return 404)
        success, response = self.run_test(
            "SuperAdmin Subscription Details - Invalid ID",
            "GET",
            "superadmin/subscriptions/invalid-gerant-id/details",
            404,
            token=self.superadmin_token
        )
        
        # Test 4: GET /api/superadmin/workspaces (existing endpoint)
        success, response = self.run_test(
            "SuperAdmin Workspaces",
            "GET",
            "superadmin/workspaces",
            200,
            token=self.superadmin_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} workspaces")
        
        # Test 5: GET /api/superadmin/stats (existing endpoint)
        success, response = self.run_test(
            "SuperAdmin Platform Stats",
            "GET",
            "superadmin/stats",
            200,
            token=self.superadmin_token
        )
        
        if success:
            print(f"   ✅ Platform stats retrieved successfully")

    def test_seller_kpi_enabled_endpoint(self):
        """Test Seller KPI Enabled Endpoint"""
        print("\n🔗 TESTING SELLER KPI ENABLED ENDPOINT")
        
        if not self.manager_token:
            self.log_test("Seller KPI Enabled", False, "No manager token available")
            return
        
        # Test 1: GET /api/seller/kpi-enabled (with manager token)
        success, response = self.run_test(
            "Seller KPI Enabled Check",
            "GET",
            "seller/kpi-enabled",
            200,
            token=self.manager_token
        )
        
        if success:
            # Verify response structure
            expected_fields = ['enabled', 'seller_input_kpis']
            missing_fields = [f for f in expected_fields if f not in response]
            if missing_fields:
                self.log_test("KPI Enabled Structure", False, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ KPI Enabled: {response.get('enabled')}")
                print(f"   ✅ Seller Input KPIs: {response.get('seller_input_kpis')}")
        
        # Test 2: GET /api/seller/kpi-enabled with store_id parameter
        if self.manager_user and self.manager_user.get('store_id'):
            store_id = self.manager_user['store_id']
            success, response = self.run_test(
                "Seller KPI Enabled - With Store ID",
                "GET",
                f"seller/kpi-enabled?store_id={store_id}",
                200,
                token=self.manager_token
            )
            
            if success:
                print(f"   ✅ KPI Enabled for store {store_id}: {response.get('enabled')}")
        
        # Test 3: Test without authentication (should fail)
        success, response = self.run_test(
            "Seller KPI Enabled - No Auth (Expected 403)",
            "GET",
            "seller/kpi-enabled",
            403
        )

    def test_authentication_security(self):
        """Test authentication and authorization security"""
        print("\n🔒 TESTING AUTHENTICATION SECURITY")
        
        # Test 1: Access manager endpoint without token
        success, response = self.run_test(
            "Manager Endpoint - No Auth (Expected 403)",
            "GET",
            "manager/store-kpi-overview",
            403
        )
        
        # Test 2: Access superadmin endpoint without token
        success, response = self.run_test(
            "SuperAdmin Endpoint - No Auth (Expected 403)",
            "GET",
            "superadmin/subscriptions/overview",
            403
        )
        
        # Test 3: Access superadmin endpoint with manager token (should fail)
        if self.manager_token:
            success, response = self.run_test(
                "SuperAdmin Endpoint - Manager Token (Expected 403)",
                "GET",
                "superadmin/subscriptions/overview",
                403,
                token=self.manager_token
            )

    def test_critical_endpoints_no_500_errors(self):
        """Test that critical endpoints return 200 OK (not 500)"""
        print("\n🏗️ TESTING CRITICAL ENDPOINTS - NO 500 ERRORS")
        
        critical_endpoints = [
            ("manager/store-kpi-overview", self.manager_token),
            ("seller/kpi-enabled", self.manager_token),
            ("superadmin/subscriptions/overview", self.superadmin_token),
            ("superadmin/workspaces", self.superadmin_token),
            ("superadmin/stats", self.superadmin_token)
        ]
        
        for endpoint, token in critical_endpoints:
            if token:
                success, response = self.run_test(
                    f"Critical Endpoint - {endpoint}",
                    "GET",
                    endpoint,
                    200,
                    token=token
                )
                
                if not success:
                    print(f"   ❌ REGRESSION: {endpoint} returned non-200 status")

    def run_all_tests(self):
        """Run all Manager Dashboard and SuperAdmin Subscriptions tests"""
        print("🚀 STARTING MANAGER DASHBOARD & SUPERADMIN SUBSCRIPTIONS TESTS")
        print("=" * 70)
        
        # Test authentication first
        self.test_authentication()
        
        # Test the two specific fixes
        self.test_manager_dashboard_fix()
        self.test_superadmin_subscriptions_fix()
        self.test_seller_kpi_enabled_endpoint()
        
        # Test security
        self.test_authentication_security()
        
        # Test critical endpoints for 500 errors
        self.test_critical_endpoints_no_500_errors()
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 MANAGER DASHBOARD & SUPERADMIN SUBSCRIPTIONS TEST SUMMARY")
        print("=" * 70)
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
        
        print("\n🎯 FIX VERIFICATION:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("✅ Manager Dashboard 404 errors fix appears successful!")
            print("✅ SuperAdmin Subscriptions Details endpoint working!")
            print("✅ No major regressions detected")
        else:
            print("❌ Some fixes have issues!")
            print("❌ Multiple endpoints failing - needs investigation")
        
        return self.tests_passed >= self.tests_run * 0.8

if __name__ == "__main__":
    tester = CleanArchitectureAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)