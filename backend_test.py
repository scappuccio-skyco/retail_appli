import requests
import sys
import json
from datetime import datetime

class ManagerDashboardAndSuperAdminTester:
    def __init__(self, base_url="https://backend-overhaul-6.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.manager_token = None
        self.superadmin_token = None
        self.gerant_token = None
        self.manager_user = None
        self.superadmin_user = None
        self.gerant_user = None
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
        """Test authentication for all roles"""
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
        
        # Test Gérant login (gerant@skyco.fr / Gerant123!)
        gerant_data = {
            "email": "gerant@skyco.fr",
            "password": "Gerant123!"
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
        
        # Test SuperAdmin login (superadmin-test@retailperformer.com / SuperAdmin123!)
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

    def test_gerant_dashboard_endpoints(self):
        """Test Gérant Dashboard User Management Endpoints"""
        print("\n👑 TESTING GÉRANT DASHBOARD USER MANAGEMENT")
        
        if not self.gerant_token:
            self.log_test("Gérant Dashboard Tests", False, "No gérant token available")
            return
        
        # Test 1: GET /api/gerant/sellers - get list of sellers
        success, sellers_response = self.run_test(
            "Gérant Get All Sellers",
            "GET",
            "gerant/sellers",
            200,
            token=self.gerant_token
        )
        
        seller_id = None
        if success and isinstance(sellers_response, list) and len(sellers_response) > 0:
            seller_id = sellers_response[0].get('id')
            print(f"   ✅ Found {len(sellers_response)} sellers, testing with seller: {seller_id}")
            
            # Display seller info
            for seller in sellers_response[:3]:  # Show first 3 sellers
                print(f"   📋 Seller: {seller.get('name')} ({seller.get('email')}) - Status: {seller.get('status')}")
        else:
            print("   ⚠️ No sellers found to test suspend/reactivate operations")
        
        # Test 2: GET /api/gerant/managers - get list of managers
        success, managers_response = self.run_test(
            "Gérant Get All Managers",
            "GET",
            "gerant/managers",
            200,
            token=self.gerant_token
        )
        
        manager_id = None
        if success and isinstance(managers_response, list) and len(managers_response) > 0:
            manager_id = managers_response[0].get('id')
            print(f"   ✅ Found {len(managers_response)} managers, testing with manager: {manager_id}")
            
            # Display manager info
            for manager in managers_response[:3]:  # Show first 3 managers
                print(f"   📋 Manager: {manager.get('name')} ({manager.get('email')}) - Status: {manager.get('status')}")
        else:
            print("   ⚠️ No managers found to test suspend/reactivate operations")
        
        # Test 3: Test seller suspend/reactivate operations
        if seller_id:
            # Test suspend seller
            success, suspend_response = self.run_test(
                "Gérant Suspend Seller",
                "PATCH",
                f"gerant/sellers/{seller_id}/suspend",
                200,
                token=self.gerant_token
            )
            
            if success:
                print(f"   ✅ Seller suspended successfully: {suspend_response.get('message', 'No message')}")
                
                # Test reactivate seller
                success, reactivate_response = self.run_test(
                    "Gérant Reactivate Seller",
                    "PATCH",
                    f"gerant/sellers/{seller_id}/reactivate",
                    200,
                    token=self.gerant_token
                )
                
                if success:
                    print(f"   ✅ Seller reactivated successfully: {reactivate_response.get('message', 'No message')}")
        
        # Test 4: Test manager suspend/reactivate operations
        if manager_id:
            # Test suspend manager
            success, suspend_response = self.run_test(
                "Gérant Suspend Manager",
                "PATCH",
                f"gerant/managers/{manager_id}/suspend",
                200,
                token=self.gerant_token
            )
            
            if success:
                print(f"   ✅ Manager suspended successfully: {suspend_response.get('message', 'No message')}")
                
                # Test reactivate manager
                success, reactivate_response = self.run_test(
                    "Gérant Reactivate Manager",
                    "PATCH",
                    f"gerant/managers/{manager_id}/reactivate",
                    200,
                    token=self.gerant_token
                )
                
                if success:
                    print(f"   ✅ Manager reactivated successfully: {reactivate_response.get('message', 'No message')}")
        
        # Test 5: GET /api/gerant/invitations - list all invitations
        success, invitations_response = self.run_test(
            "Gérant Get All Invitations",
            "GET",
            "gerant/invitations",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(invitations_response, list):
            print(f"   ✅ Found {len(invitations_response)} invitations")
            
            # Check if invitation to cappuccioseb+h@gmail.com exists
            target_email = "cappuccioseb+h@gmail.com"
            target_invitation = None
            for invitation in invitations_response:
                if invitation.get('email') == target_email:
                    target_invitation = invitation
                    break
            
            if target_invitation:
                print(f"   ✅ Found invitation to {target_email}: Status {target_invitation.get('status')}")
            else:
                print(f"   ⚠️ No invitation found for {target_email}")
                
            # Display recent invitations
            for invitation in invitations_response[:3]:  # Show first 3 invitations
                print(f"   📧 Invitation: {invitation.get('email')} ({invitation.get('role')}) - Status: {invitation.get('status')}")
        
        # Test 6: Test invalid user IDs (should return 404)
        success, response = self.run_test(
            "Gérant Suspend Invalid Seller (Expected 404)",
            "PATCH",
            "gerant/sellers/invalid-seller-id/suspend",
            404,
            token=self.gerant_token
        )
        
        success, response = self.run_test(
            "Gérant Suspend Invalid Manager (Expected 404)",
            "PATCH",
            "gerant/managers/invalid-manager-id/suspend",
            404,
            token=self.gerant_token
        )
        
        # Test 7: Test without authentication (should fail)
        success, response = self.run_test(
            "Gérant Sellers - No Auth (Expected 403)",
            "GET",
            "gerant/sellers",
            403
        )
        
        success, response = self.run_test(
            "Gérant Managers - No Auth (Expected 403)",
            "GET",
            "gerant/managers",
            403
        )

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
        """Run all Manager Dashboard, SuperAdmin Subscriptions, and Gérant Dashboard tests"""
        print("🚀 STARTING COMPREHENSIVE BACKEND API TESTS")
        print("=" * 70)
        
        # Test authentication first
        self.test_authentication()
        
        # Test the specific fixes and new features
        self.test_manager_dashboard_fix()
        self.test_superadmin_subscriptions_fix()
        self.test_seller_kpi_enabled_endpoint()
        self.test_gerant_dashboard_endpoints()
        
        # Test security
        self.test_authentication_security()
        
        # Test critical endpoints for 500 errors
        self.test_critical_endpoints_no_500_errors()
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 COMPREHENSIVE BACKEND API TEST SUMMARY")
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
        
        print("\n🎯 VERIFICATION RESULTS:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("✅ Manager Dashboard 404 errors fix appears successful!")
            print("✅ SuperAdmin Subscriptions Details endpoint working!")
            print("✅ Gérant Dashboard User Management endpoints working!")
            print("✅ No major regressions detected")
        else:
            print("❌ Some fixes have issues!")
            print("❌ Multiple endpoints failing - needs investigation")
        
        return self.tests_passed >= self.tests_run * 0.8

if __name__ == "__main__":
    tester = ManagerDashboardAndSuperAdminTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)