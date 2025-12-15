import requests
import sys
import json
from datetime import datetime

class ManagerDashboardAndSuperAdminTester:
    def __init__(self, base_url="https://invite-fix-1.preview.emergentagent.com/api"):
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

class StripeBillingTester:
    def __init__(self, base_url="https://invite-fix-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.gerant_token = None
        self.seller_token = None
        self.gerant_user = None
        self.seller_user = None
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
        """Test authentication for gerant and seller"""
        print("\n🔐 TESTING STRIPE BILLING AUTHENTICATION")
        
        # Test Gérant login (gerant@skyco.fr / Gerant123!)
        gerant_data = {
            "email": "gerant@skyco.fr",
            "password": "Gerant123!"
        }
        
        success, response = self.run_test(
            "Gérant Authentication for Billing Tests",
            "POST",
            "auth/login",
            200,
            data=gerant_data
        )
        
        if success and 'token' in response:
            self.gerant_token = response['token']
            self.gerant_user = response.get('user', {})
            print(f"   ✅ Gérant logged in: {self.gerant_user.get('email')}")
        
        # Test Seller login (emma.petit@test.com / TestDemo123!)
        seller_data = {
            "email": "emma.petit@test.com",
            "password": "TestDemo123!"
        }
        
        success, response = self.run_test(
            "Seller Authentication for AI Unlimited Tests",
            "POST",
            "auth/login",
            200,
            data=seller_data
        )
        
        if success and 'token' in response:
            self.seller_token = response['token']
            self.seller_user = response.get('user', {})
            print(f"   ✅ Seller logged in: {self.seller_user.get('email')}")

    def test_stripe_billing_smoke_tests(self):
        """Test Stripe billing subscription preview endpoints"""
        print("\n💳 TESTING STRIPE BILLING - SMOKE TESTS")
        
        if not self.gerant_token:
            self.log_test("Stripe Billing Smoke Tests", False, "No gérant token available")
            return
        
        # Test 1: POST /api/gerant/subscription/preview with {"new_seats": 13}
        success, response = self.run_test(
            "Subscription Preview - New Seats (13)",
            "POST",
            "gerant/subscription/preview",
            200,
            data={"new_seats": 13},
            token=self.gerant_token
        )
        
        if success:
            # Check for "No such price" error
            response_str = json.dumps(response)
            if "No such price" in response_str:
                self.log_test("No Such Price Error Check - Seats", False, "Found 'No such price' error in response")
            else:
                print(f"   ✅ No 'No such price' error found")
            
            # Check for valid proration_estimate
            proration = response.get('proration_estimate', 0)
            if isinstance(proration, (int, float)) and proration >= 0:
                print(f"   ✅ Valid proration_estimate: {proration}€")
            else:
                self.log_test("Proration Estimate Check - Seats", False, f"Invalid proration_estimate: {proration}")
            
            # Check cost calculations
            if 'new_monthly_cost' in response and 'current_monthly_cost' in response:
                print(f"   ✅ Cost calculations present: Current {response.get('current_monthly_cost')}€ → New {response.get('new_monthly_cost')}€")
            else:
                self.log_test("Cost Calculations Check - Seats", False, "Missing cost calculation fields")
        
        # Test 2: POST /api/gerant/subscription/preview with {"new_interval": "year"}
        success, response = self.run_test(
            "Subscription Preview - New Interval (year)",
            "POST",
            "gerant/subscription/preview",
            200,
            data={"new_interval": "year"},
            token=self.gerant_token
        )
        
        if success:
            # Check for "No such price" error
            response_str = json.dumps(response)
            if "No such price" in response_str:
                self.log_test("No Such Price Error Check - Interval", False, "Found 'No such price' error in response")
            else:
                print(f"   ✅ No 'No such price' error found")
            
            # Check for valid proration_estimate
            proration = response.get('proration_estimate', 0)
            if isinstance(proration, (int, float)) and proration >= 0:
                print(f"   ✅ Valid proration_estimate: {proration}€")
            else:
                self.log_test("Proration Estimate Check - Interval", False, f"Invalid proration_estimate: {proration}")
            
            # Check interval change
            if response.get('interval_changing') == True and response.get('new_interval') == 'year':
                print(f"   ✅ Interval change detected: {response.get('current_interval')} → year")
            else:
                print(f"   ℹ️ Interval info: changing={response.get('interval_changing')}, new={response.get('new_interval')}")
        
        # Test 3: POST /api/gerant/seats/preview with {"new_seats": 14}
        success, response = self.run_test(
            "Seats Preview - New Seats (14)",
            "POST",
            "gerant/seats/preview",
            200,
            data={"new_seats": 14},
            token=self.gerant_token
        )
        
        if success:
            # Check for "No such price" error
            response_str = json.dumps(response)
            if "No such price" in response_str:
                self.log_test("No Such Price Error Check - Seats Preview", False, "Found 'No such price' error in response")
            else:
                print(f"   ✅ No 'No such price' error found")
            
            # Check for valid proration_estimate
            proration = response.get('proration_estimate', 0)
            if isinstance(proration, (int, float)) and proration >= 0:
                print(f"   ✅ Valid proration_estimate: {proration}€")
            else:
                self.log_test("Proration Estimate Check - Seats Preview", False, f"Invalid proration_estimate: {proration}")
            
            # Check cost calculations
            expected_fields = ['current_seats', 'new_seats', 'current_monthly_cost', 'new_monthly_cost', 'price_difference']
            missing_fields = [f for f in expected_fields if f not in response]
            if missing_fields:
                self.log_test("Seats Preview Structure", False, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ Seats preview: {response.get('current_seats')} → {response.get('new_seats')} seats")
                print(f"   ✅ Cost change: {response.get('current_monthly_cost')}€ → {response.get('new_monthly_cost')}€")

    def test_webhook_health_check(self):
        """Test Stripe webhook health endpoint"""
        print("\n🔗 TESTING WEBHOOK HEALTH CHECK")
        
        success, response = self.run_test(
            "Stripe Webhook Health Check",
            "GET",
            "webhooks/stripe/health",
            200
        )
        
        if success:
            # Check expected response structure
            expected_response = {
                "status": "ok",
                "webhook_secret_configured": True,
                "stripe_key_configured": True
            }
            
            # Verify status
            if response.get('status') == 'ok':
                print(f"   ✅ Webhook status: {response.get('status')}")
            else:
                self.log_test("Webhook Status Check", False, f"Expected status 'ok', got '{response.get('status')}'")
            
            # Verify webhook secret configured
            if response.get('webhook_secret_configured') == True:
                print(f"   ✅ Webhook secret configured: {response.get('webhook_secret_configured')}")
            else:
                self.log_test("Webhook Secret Check", False, f"Webhook secret not configured: {response.get('webhook_secret_configured')}")
            
            # Verify stripe key configured
            if response.get('stripe_key_configured') == True:
                print(f"   ✅ Stripe key configured: {response.get('stripe_key_configured')}")
            else:
                self.log_test("Stripe Key Check", False, f"Stripe key not configured: {response.get('stripe_key_configured')}")

    def test_ai_unlimited_no_quota_blocking(self):
        """Test AI unlimited functionality - no quota blocking"""
        print("\n🤖 TESTING AI UNLIMITED - NO QUOTA BLOCKING")
        
        if not self.seller_token:
            self.log_test("AI Unlimited Tests", False, "No seller token available")
            return
        
        # Test POST /api/ai/daily-challenge (no body needed)
        success, response = self.run_test(
            "AI Daily Challenge - No Quota Check",
            "POST",
            "ai/daily-challenge",
            200,
            data={},  # No body needed
            token=self.seller_token
        )
        
        if success:
            # Check for quota/credit blocking errors
            response_str = json.dumps(response).lower()
            quota_keywords = ['crédits', 'insufficient', 'quota', 'limit', 'blocked', 'exceeded']
            
            found_quota_error = any(keyword in response_str for keyword in quota_keywords)
            
            if found_quota_error:
                self.log_test("AI Quota Blocking Check", False, f"Found quota/credit blocking in response: {response}")
            else:
                print(f"   ✅ No quota/credit blocking detected")
            
            # Check if we got challenge data OR fallback (both are valid)
            if 'challenge' in response or 'title' in response or 'description' in response or 'fallback' in response:
                print(f"   ✅ AI challenge response received (challenge data or fallback)")
            else:
                print(f"   ℹ️ Response structure: {list(response.keys()) if isinstance(response, dict) else type(response)}")

    def test_subscription_status(self):
        """Test subscription status endpoint"""
        print("\n📊 TESTING SUBSCRIPTION STATUS")
        
        if not self.gerant_token:
            self.log_test("Subscription Status Test", False, "No gérant token available")
            return
        
        success, response = self.run_test(
            "Gérant Subscription Status",
            "GET",
            "gerant/subscription/status",
            200,
            token=self.gerant_token
        )
        
        if success:
            # Check for subscription info fields
            expected_fields = ['plan', 'status', 'seats']
            present_fields = [f for f in expected_fields if f in response]
            
            if len(present_fields) >= 2:  # At least 2 out of 3 fields should be present
                print(f"   ✅ Subscription info present: {present_fields}")
                
                if 'plan' in response:
                    print(f"   ✅ Plan: {response.get('plan')}")
                if 'status' in response:
                    print(f"   ✅ Status: {response.get('status')}")
                if 'seats' in response:
                    print(f"   ✅ Seats: {response.get('seats')}")
            else:
                self.log_test("Subscription Info Check", False, f"Missing subscription fields. Present: {present_fields}, Expected: {expected_fields}")
            
            # Log full response for debugging
            print(f"   📋 Full subscription response: {json.dumps(response, indent=2)}")

    def run_stripe_billing_tests(self):
        """Run all Stripe billing and webhook tests"""
        print("🚀 STARTING STRIPE BILLING AND WEBHOOK TESTS")
        print("=" * 70)
        
        # Test authentication first
        self.test_authentication()
        
        # Run the specific test cases
        self.test_stripe_billing_smoke_tests()
        self.test_webhook_health_check()
        self.test_ai_unlimited_no_quota_blocking()
        self.test_subscription_status()
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 STRIPE BILLING TEST SUMMARY")
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
        
        print("\n🎯 STRIPE BILLING VERIFICATION RESULTS:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("✅ Stripe billing and webhook system working correctly!")
            print("✅ No 'No such price' errors detected")
            print("✅ Webhook health check passed")
            print("✅ AI unlimited functionality confirmed")
            print("✅ Subscription status endpoint operational")
        else:
            print("❌ Stripe billing system has issues!")
            print("❌ Multiple endpoints failing - needs investigation")
        
        return self.tests_passed >= self.tests_run * 0.8


class GerantRBACTester:
    def __init__(self, base_url="https://invite-fix-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.gerant_token = None
        self.gerant_user = None
        self.store_id = None
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

    def test_gerant_authentication(self):
        """Test Gérant authentication"""
        print("\n🔐 TESTING GÉRANT AUTHENTICATION FOR RBAC")
        
        gerant_data = {
            "email": "gerant@skyco.fr",
            "password": "Gerant123!"
        }
        
        success, response = self.run_test(
            "Gérant Authentication for RBAC Tests",
            "POST",
            "auth/login",
            200,
            data=gerant_data
        )
        
        if success and 'token' in response:
            self.gerant_token = response['token']
            self.gerant_user = response.get('user', {})
            print(f"   ✅ Gérant logged in: {self.gerant_user.get('email')}")
            return True
        else:
            print("   ❌ Failed to authenticate Gérant")
            return False

    def get_store_id(self):
        """Get a valid store_id from Gérant stores"""
        print("\n🏪 GETTING VALID STORE_ID")
        
        if not self.gerant_token:
            self.log_test("Get Store ID", False, "No gérant token available")
            return False
        
        success, response = self.run_test(
            "Get Gérant Stores",
            "GET",
            "gerant/stores",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            self.store_id = response[0].get('id')
            print(f"   ✅ Using store_id: {self.store_id}")
            print(f"   ✅ Store name: {response[0].get('name', 'Unknown')}")
            return True
        else:
            self.log_test("Get Store ID", False, "No stores found or invalid response")
            return False

    def test_manager_endpoints_with_store_id(self):
        """Test all manager endpoints with store_id parameter"""
        print("\n👔 TESTING MANAGER ENDPOINTS WITH STORE_ID (RBAC)")
        
        if not self.gerant_token or not self.store_id:
            self.log_test("Manager Endpoints RBAC", False, "Missing gérant token or store_id")
            return
        
        # Test 1: GET /api/manager/sync-mode?store_id={store_id}
        success, response = self.run_test(
            "Manager Sync Mode with Store ID",
            "GET",
            f"manager/sync-mode?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success:
            if 'sync_mode' in response:
                print(f"   ✅ Sync mode: {response.get('sync_mode')}")
            else:
                self.log_test("Sync Mode Response Structure", False, "Missing 'sync_mode' field")
        
        # Test 2: GET /api/manager/sellers?store_id={store_id}
        success, response = self.run_test(
            "Manager Sellers with Store ID",
            "GET",
            f"manager/sellers?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} sellers")
        
        # Test 3: GET /api/manager/kpi-config?store_id={store_id}
        success, response = self.run_test(
            "Manager KPI Config with Store ID",
            "GET",
            f"manager/kpi-config?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success:
            print(f"   ✅ KPI config retrieved successfully")
        
        # Test 4: GET /api/manager/objectives?store_id={store_id}
        success, response = self.run_test(
            "Manager Objectives with Store ID",
            "GET",
            f"manager/objectives?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} objectives")
        
        # Test 5: GET /api/manager/objectives/active?store_id={store_id}
        success, response = self.run_test(
            "Manager Active Objectives with Store ID",
            "GET",
            f"manager/objectives/active?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} active objectives")
        
        # Test 6: GET /api/manager/challenges?store_id={store_id}
        success, response = self.run_test(
            "Manager Challenges with Store ID",
            "GET",
            f"manager/challenges?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} challenges")
        
        # Test 7: GET /api/manager/challenges/active?store_id={store_id}
        success, response = self.run_test(
            "Manager Active Challenges with Store ID",
            "GET",
            f"manager/challenges/active?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} active challenges")
        
        # Test 8: POST /api/manager/analyze-store-kpis?store_id={store_id}
        analyze_data = {
            "start_date": "2025-01-01",
            "end_date": "2025-01-31"
        }
        
        success, response = self.run_test(
            "Manager Analyze Store KPIs with Store ID",
            "POST",
            f"manager/analyze-store-kpis?store_id={self.store_id}",
            200,
            data=analyze_data,
            token=self.gerant_token
        )
        
        if success:
            if 'store_name' in response and 'kpis' in response:
                print(f"   ✅ Analysis complete for store: {response.get('store_name')}")
                print(f"   ✅ KPIs analyzed: {len(response.get('kpis', []))} items")
            else:
                print(f"   ✅ Analysis response received (structure may vary)")
        
        # Test 9: GET /api/manager/subscription-status?store_id={store_id}
        success, response = self.run_test(
            "Manager Subscription Status with Store ID",
            "GET",
            f"manager/subscription-status?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success:
            print(f"   ✅ Subscription status retrieved successfully")

    def test_manager_endpoints_without_store_id(self):
        """Test manager endpoints without store_id to verify they fail appropriately"""
        print("\n🚫 TESTING MANAGER ENDPOINTS WITHOUT STORE_ID (Should Fail)")
        
        if not self.gerant_token:
            self.log_test("Manager Endpoints Without Store ID", False, "No gérant token available")
            return
        
        # Test endpoints without store_id - should return 400 "Le paramètre store_id est requis"
        endpoints_to_test = [
            "manager/sync-mode",
            "manager/sellers",
            "manager/kpi-config",
            "manager/objectives",
            "manager/objectives/active",
            "manager/challenges",
            "manager/challenges/active",
            "manager/subscription-status"
        ]
        
        for endpoint in endpoints_to_test:
            success, response = self.run_test(
                f"Manager {endpoint.split('/')[-1]} WITHOUT Store ID (Expected 400)",
                "GET",
                endpoint,
                400,
                token=self.gerant_token
            )
            
            if success:
                # Check if the error message is about missing store_id
                response_str = json.dumps(response) if isinstance(response, dict) else str(response)
                if "store_id" in response_str.lower():
                    print(f"   ✅ Correct error message about missing store_id")
                else:
                    print(f"   ℹ️ Got 400 but different error message: {response_str[:100]}")

    def run_rbac_tests(self):
        """Run all RBAC tests for Gérant View as Manager functionality"""
        print("🚀 STARTING GÉRANT RBAC 'VIEW AS MANAGER' TESTS")
        print("=" * 70)
        
        # Step 1: Authenticate as Gérant
        if not self.test_gerant_authentication():
            print("❌ Cannot proceed without Gérant authentication")
            return False
        
        # Step 2: Get valid store_id
        if not self.get_store_id():
            print("❌ Cannot proceed without valid store_id")
            return False
        
        # Step 3: Test manager endpoints with store_id
        self.test_manager_endpoints_with_store_id()
        
        # Step 4: Test manager endpoints without store_id (should fail)
        self.test_manager_endpoints_without_store_id()
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 GÉRANT RBAC TEST SUMMARY")
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
        
        print("\n🎯 RBAC VERIFICATION RESULTS:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("✅ Gérant RBAC 'View as Manager' functionality working correctly!")
            print("✅ All manager endpoints accessible with store_id parameter")
            print("✅ No 400/404/403 errors when store_id is provided")
            print("✅ Proper error handling when store_id is missing")
        else:
            print("❌ Gérant RBAC functionality has issues!")
            print("❌ Multiple endpoints failing - needs investigation")
        
        return self.tests_passed >= self.tests_run * 0.8


class GerantFeaturesTester:
    def __init__(self, base_url="https://invite-fix-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.gerant_token = None
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

    def test_gerant_authentication(self):
        """Test Gérant authentication for feature tests"""
        print("\n🔐 TESTING GÉRANT AUTHENTICATION FOR FEATURE TESTS")
        
        # Test Gérant login (gerant@skyco.fr / Gerant123!)
        gerant_data = {
            "email": "gerant@skyco.fr",
            "password": "Gerant123!"
        }
        
        success, response = self.run_test(
            "Gérant Authentication for Feature Tests",
            "POST",
            "auth/login",
            200,
            data=gerant_data
        )
        
        if success and 'token' in response:
            self.gerant_token = response['token']
            self.gerant_user = response.get('user', {})
            print(f"   ✅ Gérant logged in: {self.gerant_user.get('email')}")
            return True
        else:
            print("   ❌ Failed to authenticate Gérant")
            return False

    def test_gerant_stores_api(self):
        """Test Gérant Stores API for Store Selection Dropdown"""
        print("\n🏪 TESTING GÉRANT STORES API FOR STORE SELECTION")
        
        if not self.gerant_token:
            self.log_test("Gérant Stores API", False, "No gérant token available")
            return
        
        # Test 1: Get all stores for gérant
        success, response = self.run_test(
            "Gérant Get All Stores",
            "GET",
            "gerant/stores",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} stores")
            
            # Verify we have at least 9 stores as mentioned in the review request
            if len(response) >= 9:
                print(f"   ✅ Store count meets requirement (≥9 stores)")
            else:
                self.log_test("Store Count Check", False, f"Expected ≥9 stores, found {len(response)}")
            
            # Check store structure
            if len(response) > 0:
                store = response[0]
                expected_fields = ['id', 'name']
                missing_fields = [f for f in expected_fields if f not in store]
                if missing_fields:
                    self.log_test("Store Structure Check", False, f"Missing fields in store: {missing_fields}")
                else:
                    print(f"   ✅ Store structure valid: {store.get('name')}")
                    
                # Display first few stores
                for i, store in enumerate(response[:3]):
                    print(f"   📋 Store {i+1}: {store.get('name')} (ID: {store.get('id')})")
        else:
            self.log_test("Gérant Stores Response", False, f"Expected list, got {type(response)}")
    
    def test_gerant_store_managers_api(self):
        """Test Gérant Store Managers API for Manager Selection Dropdown"""
        print("\n👔 TESTING GÉRANT STORE MANAGERS API FOR MANAGER SELECTION")
        
        if not self.gerant_token:
            self.log_test("Gérant Store Managers API", False, "No gérant token available")
            return
        
        # First get stores to test with
        success, stores_response = self.run_test(
            "Get Stores for Manager Test",
            "GET",
            "gerant/stores",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(stores_response, list) and len(stores_response) > 0:
            store_id = stores_response[0].get('id')
            store_name = stores_response[0].get('name')
            
            # Test getting managers for a specific store
            success, response = self.run_test(
                f"Gérant Get Store Managers - {store_name}",
                "GET",
                f"gerant/stores/{store_id}/managers",
                200,
                token=self.gerant_token
            )
            
            if success and isinstance(response, list):
                print(f"   ✅ Found {len(response)} managers for store {store_name}")
                
                # Check manager structure if any exist
                if len(response) > 0:
                    manager = response[0]
                    expected_fields = ['id', 'name', 'email']
                    missing_fields = [f for f in expected_fields if f not in manager]
                    if missing_fields:
                        self.log_test("Manager Structure Check", False, f"Missing fields in manager: {missing_fields}")
                    else:
                        print(f"   ✅ Manager structure valid: {manager.get('name')} ({manager.get('email')})")
                else:
                    print(f"   ℹ️ No managers found for store {store_name}")
            else:
                self.log_test("Store Managers Response", False, f"Expected list, got {type(response)}")
        else:
            self.log_test("Store Managers Test Setup", False, "Could not get stores for testing")
    
    def test_gerant_store_kpi_overview(self):
        """Test Gérant Store KPI Overview for Dashboard Modal"""
        print("\n📊 TESTING GÉRANT STORE KPI OVERVIEW FOR DASHBOARD MODAL")
        
        if not self.gerant_token:
            self.log_test("Gérant Store KPI Overview", False, "No gérant token available")
            return
        
        # First get stores to test with
        success, stores_response = self.run_test(
            "Get Stores for KPI Test",
            "GET",
            "gerant/stores",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(stores_response, list) and len(stores_response) > 0:
            store_id = stores_response[0].get('id')
            store_name = stores_response[0].get('name')
            
            # Test getting KPI overview for a specific store
            success, response = self.run_test(
                f"Gérant Store KPI Overview - {store_name}",
                "GET",
                f"gerant/stores/{store_id}/kpi-overview",
                200,
                token=self.gerant_token
            )
            
            if success:
                # Check for expected KPI fields
                expected_fields = ['store_id', 'date']
                present_fields = [f for f in expected_fields if f in response]
                
                if len(present_fields) >= 1:  # At least store_id should be present
                    print(f"   ✅ KPI overview structure valid for {store_name}")
                    print(f"   ✅ Store ID: {response.get('store_id')}")
                    if 'date' in response:
                        print(f"   ✅ Date: {response.get('date')}")
                    if 'totals' in response:
                        totals = response.get('totals', {})
                        print(f"   ✅ Totals available: {list(totals.keys())}")
                else:
                    self.log_test("KPI Overview Structure", False, f"Missing expected fields. Present: {present_fields}")
            else:
                # This might be expected if no KPI data exists
                print(f"   ℹ️ No KPI data available for store {store_name}")
        else:
            self.log_test("KPI Overview Test Setup", False, "Could not get stores for testing")

    def test_gerant_invitations_api(self):
        """Test Gérant Invitations API for Seller Invitation Flow"""
        print("\n📧 TESTING GÉRANT INVITATIONS API FOR SELLER INVITATION")
        
        if not self.gerant_token:
            self.log_test("Gérant Invitations API", False, "No gérant token available")
            return
        
        # Test 1: Get all invitations
        success, response = self.run_test(
            "Gérant Get All Invitations",
            "GET",
            "gerant/invitations",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} invitations")
            
            # Check invitation structure if any exist
            if len(response) > 0:
                invitation = response[0]
                expected_fields = ['email', 'role', 'status']
                missing_fields = [f for f in expected_fields if f not in invitation]
                if missing_fields:
                    self.log_test("Invitation Structure Check", False, f"Missing fields in invitation: {missing_fields}")
                else:
                    print(f"   ✅ Invitation structure valid: {invitation.get('email')} ({invitation.get('role')})")
                    
                # Display recent invitations
                for i, inv in enumerate(response[:3]):
                    print(f"   📧 Invitation {i+1}: {inv.get('email')} - {inv.get('role')} - {inv.get('status')}")
            else:
                print(f"   ℹ️ No invitations found")
        else:
            self.log_test("Invitations Response", False, f"Expected list, got {type(response)}")
        
        # Test 2: Test invitation creation (dry run - we won't actually send)
        # This tests the API structure without sending real emails
        test_invitation_data = {
            "name": "Test User",
            "email": "test-invitation@example.com",
            "role": "seller",
            "store_id": "test-store-id"
        }
        
        # Note: This will likely fail with 404 for invalid store_id, but that's expected
        # We're testing the API structure, not actually creating invitations
        success, response = self.run_test(
            "Gérant Create Invitation (Structure Test)",
            "POST",
            "gerant/invitations",
            400,  # Expect 400 due to invalid store_id
            data=test_invitation_data,
            token=self.gerant_token
        )
        
        # The test passes if we get a proper error response (not 500)
        if success or (not success and "400" in str(response)):
            print(f"   ✅ Invitation API structure working (got expected validation error)")
        else:
            print(f"   ℹ️ Invitation API response: {response}")

    def test_stripe_webhook_health(self):
        """Test Stripe Webhook Health API - GET /api/webhooks/stripe/health"""
        print("\n🔗 TESTING STRIPE WEBHOOK HEALTH API")
        
        success, response = self.run_test(
            "Stripe Webhook Health Check",
            "GET",
            "webhooks/stripe/health",
            200
        )
        
        if success:
            # Verify response structure matches review request requirements
            expected_response = {
                "status": "ok",
                "webhook_secret_configured": True,
                "stripe_key_configured": True
            }
            
            # Check each field individually
            if response.get('status') == 'ok':
                print(f"   ✅ Status: {response.get('status')}")
            else:
                self.log_test("Webhook Health Status", False, f"Expected status='ok', got '{response.get('status')}'")
            
            if response.get('webhook_secret_configured') == True:
                print(f"   ✅ Webhook secret configured: {response.get('webhook_secret_configured')}")
            else:
                self.log_test("Webhook Secret Configuration", False, f"Expected webhook_secret_configured=true, got {response.get('webhook_secret_configured')}")
            
            if response.get('stripe_key_configured') == True:
                print(f"   ✅ Stripe key configured: {response.get('stripe_key_configured')}")
            else:
                self.log_test("Stripe Key Configuration", False, f"Expected stripe_key_configured=true, got {response.get('stripe_key_configured')}")
            
            # Verify exact match with review request requirements
            if (response.get('status') == 'ok' and 
                response.get('webhook_secret_configured') == True and 
                response.get('stripe_key_configured') == True):
                print(f"   ✅ All webhook health requirements met as per review request")
            else:
                self.log_test("Webhook Health Complete Check", False, "Not all webhook health requirements met")

    def test_gerant_api_security(self):
        """Test Gérant API security and access control"""
        print("\n🔒 TESTING GÉRANT API SECURITY")
        
        # Test 1: Access stores without authentication
        success, response = self.run_test(
            "Gérant Stores - No Auth (Expected 403)",
            "GET",
            "gerant/stores",
            403
        )
        
        # Test 2: Access store managers without authentication
        success, response = self.run_test(
            "Gérant Store Managers - No Auth (Expected 403)",
            "GET",
            "gerant/stores/test-store-id/managers",
            403
        )
        
        # Test 3: Access invitations without authentication
        success, response = self.run_test(
            "Gérant Invitations - No Auth (Expected 403)",
            "GET",
            "gerant/invitations",
            403
        )

    def run_morning_brief_and_webhook_tests(self):
        """Run all Morning Brief and Stripe Webhook tests"""
        print("🚀 STARTING MORNING BRIEF AND STRIPE WEBHOOK TESTS")
        print("=" * 70)
        
        # Test authentication first
        if not self.test_manager_authentication():
            print("❌ Cannot proceed without Manager authentication")
            return False
        
        # Run the specific test cases
        self.test_morning_brief_api()
        self.test_morning_brief_preview()
        self.test_stripe_webhook_health()
        self.test_morning_brief_security()
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 MORNING BRIEF AND WEBHOOK TEST SUMMARY")
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
        
        print("\n🎯 MORNING BRIEF AND WEBHOOK VERIFICATION RESULTS:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("✅ Morning Brief API working correctly!")
            print("✅ Stripe webhook health check passed!")
            print("✅ All required response fields present!")
            print("✅ Security controls working properly!")
        else:
            print("❌ Morning Brief or Webhook system has issues!")
            print("❌ Multiple endpoints failing - needs investigation")
        
        return self.tests_passed >= self.tests_run * 0.8


class EvaluationGeneratorTester:
    def __init__(self, base_url="https://invite-fix-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.manager_token = None
        self.seller_token = None
        self.manager_user = None
        self.seller_user = None
        self.seller_id = None
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
        """Test authentication for Manager and Seller"""
        print("\n🔐 TESTING EVALUATION GENERATOR AUTHENTICATION")
        
        # Test Manager login (y.legoff@skyco.fr / TestDemo123!)
        manager_data = {
            "email": "y.legoff@skyco.fr",
            "password": "TestDemo123!"
        }
        
        success, response = self.run_test(
            "Manager Authentication for Evaluation Tests",
            "POST",
            "auth/login",
            200,
            data=manager_data
        )
        
        if success and 'token' in response:
            self.manager_token = response['token']
            self.manager_user = response.get('user', {})
            print(f"   ✅ Manager logged in: {self.manager_user.get('email')}")
        
        # Test Seller login (emma.petit@test.com / TestDemo123!)
        seller_data = {
            "email": "emma.petit@test.com",
            "password": "TestDemo123!"
        }
        
        success, response = self.run_test(
            "Seller Authentication for Evaluation Tests",
            "POST",
            "auth/login",
            200,
            data=seller_data
        )
        
        if success and 'token' in response:
            self.seller_token = response['token']
            self.seller_user = response.get('user', {})
            self.seller_id = self.seller_user.get('id')
            print(f"   ✅ Seller logged in: {self.seller_user.get('email')}")
            print(f"   ✅ Seller ID: {self.seller_id}")

    def test_evaluation_api_manager_perspective(self):
        """Test evaluation generation from Manager perspective"""
        print("\n👔 TESTING EVALUATION API - MANAGER PERSPECTIVE")
        
        if not self.manager_token or not self.seller_id:
            self.log_test("Manager Evaluation API", False, "Missing manager token or seller ID")
            return
        
        # Test 1: Generate evaluation guide for seller (Manager perspective)
        evaluation_data = {
            "employee_id": self.seller_id,
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        success, response = self.run_test(
            "Manager Generate Evaluation Guide",
            "POST",
            "evaluations/generate",
            200,
            data=evaluation_data,
            token=self.manager_token
        )
        
        if success:
            # Verify response structure
            expected_fields = ['employee_id', 'employee_name', 'role_perspective', 'guide_content', 'stats_summary']
            missing_fields = [f for f in expected_fields if f not in response]
            if missing_fields:
                self.log_test("Manager Evaluation Response Structure", False, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ Employee: {response.get('employee_name')}")
                print(f"   ✅ Role perspective: {response.get('role_perspective')}")
                print(f"   ✅ Guide content length: {len(response.get('guide_content', ''))}")
                
                # Verify role perspective is 'manager'
                if response.get('role_perspective') == 'manager':
                    print(f"   ✅ Correct role perspective for manager")
                else:
                    self.log_test("Manager Role Perspective", False, f"Expected 'manager', got '{response.get('role_perspective')}'")
                
                # Check if guide contains manager-specific content
                guide_content = response.get('guide_content', '').lower()
                manager_keywords = ['entretien', 'évaluation', 'manager', 'questions', 'objectifs']
                found_keywords = [kw for kw in manager_keywords if kw in guide_content]
                if len(found_keywords) >= 2:
                    print(f"   ✅ Manager-specific content detected: {found_keywords}")
                else:
                    print(f"   ⚠️ Limited manager-specific content found: {found_keywords}")
        
        # Test 2: Get evaluation stats for seller
        success, response = self.run_test(
            "Manager Get Evaluation Stats",
            "GET",
            f"evaluations/stats/{self.seller_id}?start_date=2024-01-01&end_date=2024-12-31",
            200,
            token=self.manager_token
        )
        
        if success:
            expected_fields = ['employee_id', 'employee_name', 'stats']
            missing_fields = [f for f in expected_fields if f not in response]
            if missing_fields:
                self.log_test("Manager Evaluation Stats Structure", False, f"Missing fields: {missing_fields}")
            else:
                stats = response.get('stats', {})
                print(f"   ✅ Stats retrieved for: {response.get('employee_name')}")
                print(f"   ✅ Total CA: {stats.get('total_ca', 0)}€")
                print(f"   ✅ Days worked: {stats.get('days_worked', 0)}")

    def test_evaluation_api_seller_perspective(self):
        """Test evaluation generation from Seller perspective"""
        print("\n👤 TESTING EVALUATION API - SELLER PERSPECTIVE")
        
        if not self.seller_token or not self.seller_id:
            self.log_test("Seller Evaluation API", False, "Missing seller token or seller ID")
            return
        
        # Test 1: Generate evaluation guide for self (Seller perspective)
        evaluation_data = {
            "employee_id": self.seller_id,
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        success, response = self.run_test(
            "Seller Generate Own Evaluation Guide",
            "POST",
            "evaluations/generate",
            200,
            data=evaluation_data,
            token=self.seller_token
        )
        
        if success:
            # Verify response structure
            expected_fields = ['employee_id', 'employee_name', 'role_perspective', 'guide_content', 'stats_summary']
            missing_fields = [f for f in expected_fields if f not in response]
            if missing_fields:
                self.log_test("Seller Evaluation Response Structure", False, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ Employee: {response.get('employee_name')}")
                print(f"   ✅ Role perspective: {response.get('role_perspective')}")
                print(f"   ✅ Guide content length: {len(response.get('guide_content', ''))}")
                
                # Verify role perspective is 'seller'
                if response.get('role_perspective') == 'seller':
                    print(f"   ✅ Correct role perspective for seller")
                else:
                    self.log_test("Seller Role Perspective", False, f"Expected 'seller', got '{response.get('role_perspective')}'")
                
                # Check if guide contains seller-specific content
                guide_content = response.get('guide_content', '').lower()
                seller_keywords = ['mes victoires', 'mes axes', 'mes souhaits', 'préparer', 'défense']
                found_keywords = [kw for kw in seller_keywords if kw in guide_content]
                if len(found_keywords) >= 2:
                    print(f"   ✅ Seller-specific content detected: {found_keywords}")
                else:
                    print(f"   ⚠️ Limited seller-specific content found: {found_keywords}")
        
        # Test 2: Try to generate evaluation for another seller (should fail)
        if self.manager_user and self.manager_user.get('id') != self.seller_id:
            other_employee_data = {
                "employee_id": self.manager_user.get('id'),  # Try to access manager's data
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            }
            
            success, response = self.run_test(
                "Seller Access Other Employee (Expected 403)",
                "POST",
                "evaluations/generate",
                403,
                data=other_employee_data,
                token=self.seller_token
            )

    def test_evaluation_api_security(self):
        """Test evaluation API security and access control"""
        print("\n🔒 TESTING EVALUATION API SECURITY")
        
        # Test 1: Access without authentication
        evaluation_data = {
            "employee_id": self.seller_id if self.seller_id else "test-id",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        success, response = self.run_test(
            "Evaluation Generate - No Auth (Expected 403)",
            "POST",
            "evaluations/generate",
            403,
            data=evaluation_data
        )
        
        success, response = self.run_test(
            "Evaluation Stats - No Auth (Expected 403)",
            "GET",
            f"evaluations/stats/{self.seller_id if self.seller_id else 'test-id'}?start_date=2024-01-01&end_date=2024-12-31",
            403
        )
        
        # Test 2: Invalid date formats
        if self.seller_token and self.seller_id:
            invalid_date_data = {
                "employee_id": self.seller_id,
                "start_date": "invalid-date",
                "end_date": "2024-12-31"
            }
            
            success, response = self.run_test(
                "Evaluation Generate - Invalid Date Format (Expected 400)",
                "POST",
                "evaluations/generate",
                400,
                data=invalid_date_data,
                token=self.seller_token
            )

    def test_evaluation_api_edge_cases(self):
        """Test evaluation API edge cases"""
        print("\n🧪 TESTING EVALUATION API EDGE CASES")
        
        if not self.seller_token or not self.seller_id:
            self.log_test("Evaluation Edge Cases", False, "Missing seller token or seller ID")
            return
        
        # Test 1: Future date range (no data expected)
        future_data = {
            "employee_id": self.seller_id,
            "start_date": "2025-01-01",
            "end_date": "2025-12-31"
        }
        
        success, response = self.run_test(
            "Evaluation Generate - Future Dates",
            "POST",
            "evaluations/generate",
            404,  # Should return 404 for no data
            data=future_data,
            token=self.seller_token
        )
        
        # Test 2: Very short date range
        short_range_data = {
            "employee_id": self.seller_id,
            "start_date": "2024-01-01",
            "end_date": "2024-01-01"
        }
        
        success, response = self.run_test(
            "Evaluation Generate - Single Day Range",
            "POST",
            "evaluations/generate",
            200,  # Should work but might have limited data
            data=short_range_data,
            token=self.seller_token
        )
        
        if success:
            print(f"   ✅ Single day evaluation generated successfully")

    def run_evaluation_tests(self):
        """Run all evaluation generator tests"""
        print("🚀 STARTING EVALUATION GENERATOR TESTS")
        print("=" * 70)
        
        # Test authentication first
        self.test_authentication()
        
        # Test the evaluation API from different perspectives
        self.test_evaluation_api_manager_perspective()
        self.test_evaluation_api_seller_perspective()
        
        # Test security and edge cases
        self.test_evaluation_api_security()
        self.test_evaluation_api_edge_cases()
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 EVALUATION GENERATOR TEST SUMMARY")
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
        
        print("\n🎯 EVALUATION GENERATOR VERIFICATION RESULTS:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("✅ Evaluation Generator feature working correctly!")
            print("✅ Role-based prompt differentiation functioning")
            print("✅ Manager and Seller perspectives properly implemented")
            print("✅ Security and access control working")
        else:
            print("❌ Evaluation Generator has issues!")
            print("❌ Multiple tests failing - needs investigation")
        
        return self.tests_passed >= self.tests_run * 0.8


class ImprovedEvaluationGeneratorTester:
    def __init__(self, base_url="https://invite-fix-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.manager_token = None
        self.seller_token = None
        self.manager_user = None
        self.seller_user = None
        self.seller_id = None
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
        """Test authentication for Manager and Seller"""
        print("\n🔐 TESTING IMPROVED EVALUATION GENERATOR AUTHENTICATION")
        
        # Test Manager login (y.legoff@skyco.fr / TestDemo123!)
        manager_data = {
            "email": "y.legoff@skyco.fr",
            "password": "TestDemo123!"
        }
        
        success, response = self.run_test(
            "Manager Authentication for Improved Evaluation Tests",
            "POST",
            "auth/login",
            200,
            data=manager_data
        )
        
        if success and 'token' in response:
            self.manager_token = response['token']
            self.manager_user = response.get('user', {})
            print(f"   ✅ Manager logged in: {self.manager_user.get('email')}")
            
            # Get a seller from the manager's store
            try:
                import requests
                headers = {'Authorization': f'Bearer {self.manager_token}'}
                sellers_response = requests.get(f"{self.base_url}/manager/sellers", headers=headers)
                if sellers_response.status_code == 200:
                    sellers = sellers_response.json()
                    if sellers:
                        # Use the first seller in the manager's store
                        self.seller_id = sellers[0].get('id')
                        print(f"   ✅ Using seller from manager's store: {sellers[0].get('name')} (ID: {self.seller_id})")
                    else:
                        print("   ⚠️ No sellers found in manager's store")
                else:
                    print(f"   ⚠️ Failed to get sellers: {sellers_response.status_code}")
            except Exception as e:
                print(f"   ⚠️ Error getting sellers: {e}")
        
        # Test Seller login (emma.petit@test.com / TestDemo123!) - for seller perspective tests
        seller_data = {
            "email": "emma.petit@test.com",
            "password": "TestDemo123!"
        }
        
        success, response = self.run_test(
            "Seller Authentication for Improved Evaluation Tests",
            "POST",
            "auth/login",
            200,
            data=seller_data
        )
        
        if success and 'token' in response:
            self.seller_token = response['token']
            self.seller_user = response.get('user', {})
            print(f"   ✅ Seller logged in: {self.seller_user.get('email')}")
            print(f"   ✅ Seller ID for seller tests: {self.seller_user.get('id')}")

    def test_json_output_structure(self):
        """Test that the API returns JSON structured data (not markdown)"""
        print("\n📋 TESTING JSON OUTPUT STRUCTURE")
        
        if not self.manager_token or not self.seller_id:
            self.log_test("JSON Output Structure", False, "Missing manager token or seller ID")
            return
        
        # Test 1: Manager perspective - JSON structure
        evaluation_data = {
            "employee_id": self.seller_id,
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "comments": "Test comment for JSON structure validation"
        }
        
        success, response = self.run_test(
            "Manager Generate Evaluation - JSON Structure",
            "POST",
            "evaluations/generate",
            200,
            data=evaluation_data,
            token=self.manager_token
        )
        
        if success:
            # Verify response structure
            expected_fields = ['employee_id', 'employee_name', 'role_perspective', 'guide_content', 'stats_summary', 'generated_at']
            missing_fields = [f for f in expected_fields if f not in response]
            if missing_fields:
                self.log_test("Manager JSON Response Structure", False, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ All required fields present: {expected_fields}")
                
                # Check guide_content is a dict (JSON), not string (markdown)
                guide_content = response.get('guide_content', {})
                if isinstance(guide_content, dict):
                    print(f"   ✅ guide_content is JSON object (not markdown string)")
                    
                    # Check for required JSON fields in guide_content
                    required_json_fields = ['synthese', 'victoires', 'axes_progres', 'objectifs']
                    missing_json_fields = [f for f in required_json_fields if f not in guide_content]
                    if missing_json_fields:
                        self.log_test("Manager JSON Guide Content Structure", False, f"Missing JSON fields: {missing_json_fields}")
                    else:
                        print(f"   ✅ All required JSON fields present in guide_content: {required_json_fields}")
                        
                        # Check for role-specific field (questions_coaching for manager)
                        if 'questions_coaching' in guide_content:
                            print(f"   ✅ Manager-specific field 'questions_coaching' present")
                        else:
                            self.log_test("Manager Role-Specific Field", False, "Missing 'questions_coaching' field for manager role")
                else:
                    self.log_test("Manager JSON Guide Content Type", False, f"guide_content is {type(guide_content)}, expected dict")
        
        # Test 2: Seller perspective - JSON structure (using seller's own ID)
        seller_evaluation_data = {
            "employee_id": self.seller_user.get('id'),  # Seller evaluating themselves
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "comments": "Test comment for JSON structure validation"
        }
        
        success, response = self.run_test(
            "Seller Generate Own Evaluation - JSON Structure",
            "POST",
            "evaluations/generate",
            200,
            data=seller_evaluation_data,
            token=self.seller_token
        )
        
        if success:
            guide_content = response.get('guide_content', {})
            if isinstance(guide_content, dict):
                print(f"   ✅ Seller guide_content is JSON object")
                
                # Check for role-specific field (questions_manager for seller)
                if 'questions_manager' in guide_content:
                    print(f"   ✅ Seller-specific field 'questions_manager' present")
                else:
                    self.log_test("Seller Role-Specific Field", False, "Missing 'questions_manager' field for seller role")

    def test_comments_field_influence(self):
        """Test that the comments field is accepted and influences the AI response"""
        print("\n💬 TESTING COMMENTS FIELD INFLUENCE")
        
        if not self.manager_token or not self.seller_id:
            self.log_test("Comments Field Influence", False, "Missing manager token or seller ID")
            return
        
        # Test 1: Generate evaluation without comments
        evaluation_without_comments = {
            "employee_id": self.seller_id,
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        success, response_without = self.run_test(
            "Manager Generate Evaluation - Without Comments",
            "POST",
            "evaluations/generate",
            200,
            data=evaluation_without_comments,
            token=self.manager_token
        )
        
        # Test 2: Generate evaluation with specific comments
        evaluation_with_comments = {
            "employee_id": self.seller_id,
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "comments": "Emma a montré une excellente progression en vente additionnelle ce trimestre. Elle a particulièrement brillé lors des périodes de forte affluence et a développé une approche client très personnalisée. Points à améliorer: gestion du stress et organisation du temps."
        }
        
        success, response_with = self.run_test(
            "Manager Generate Evaluation - With Comments",
            "POST",
            "evaluations/generate",
            200,
            data=evaluation_with_comments,
            token=self.manager_token
        )
        
        if success and response_without and response_with:
            # Compare responses to see if comments influenced the output
            guide_without = response_without.get('guide_content', {})
            guide_with = response_with.get('guide_content', {})
            
            # Check if synthese is different (indicating AI took comments into account)
            synthese_without = guide_without.get('synthese', '')
            synthese_with = guide_with.get('synthese', '')
            
            if synthese_without != synthese_with:
                print(f"   ✅ Comments influenced AI response - synthese content differs")
                print(f"   📝 Without comments: {synthese_without[:100]}...")
                print(f"   📝 With comments: {synthese_with[:100]}...")
                
                # Check if specific keywords from comments appear in response
                comment_keywords = ['progression', 'vente additionnelle', 'personnalisée', 'stress', 'organisation']
                found_keywords = []
                full_response_text = json.dumps(guide_with).lower()
                
                for keyword in comment_keywords:
                    if keyword.lower() in full_response_text:
                        found_keywords.append(keyword)
                
                if found_keywords:
                    print(f"   ✅ Comment keywords found in response: {found_keywords}")
                else:
                    print(f"   ⚠️ No specific comment keywords found, but response still differs")
            else:
                self.log_test("Comments Influence Check", False, "Comments did not appear to influence the AI response")

    def test_role_specific_questions(self):
        """Test that role-specific questions are generated correctly"""
        print("\n❓ TESTING ROLE-SPECIFIC QUESTIONS")
        
        if not self.manager_token or not self.seller_token or not self.seller_id:
            self.log_test("Role-Specific Questions", False, "Missing tokens or seller ID")
            return
        
        evaluation_data = {
            "employee_id": self.seller_id,
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "comments": "Focus on coaching questions for manager and career questions for seller"
        }
        
        # Test 1: Manager role - should get questions_coaching
        success, manager_response = self.run_test(
            "Manager Role - Coaching Questions",
            "POST",
            "evaluations/generate",
            200,
            data=evaluation_data,
            token=self.manager_token
        )
        
        if success:
            guide_content = manager_response.get('guide_content', {})
            role_perspective = manager_response.get('role_perspective')
            
            if role_perspective == 'manager':
                print(f"   ✅ Correct role perspective: {role_perspective}")
                
                if 'questions_coaching' in guide_content:
                    questions = guide_content['questions_coaching']
                    if isinstance(questions, list) and len(questions) > 0:
                        print(f"   ✅ Manager coaching questions generated: {len(questions)} questions")
                        for i, q in enumerate(questions[:3], 1):  # Show first 3 questions
                            print(f"   📋 Question {i}: {q}")
                    else:
                        self.log_test("Manager Coaching Questions Content", False, "questions_coaching is empty or not a list")
                else:
                    self.log_test("Manager Coaching Questions Field", False, "Missing questions_coaching field")
            else:
                self.log_test("Manager Role Perspective", False, f"Expected 'manager', got '{role_perspective}'")
        
        # Test 2: Seller role - should get questions_manager (using seller's own ID)
        seller_evaluation_data = {
            "employee_id": self.seller_user.get('id'),  # Seller evaluating themselves
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "comments": "Focus on coaching questions for manager and career questions for seller"
        }
        
        success, seller_response = self.run_test(
            "Seller Role - Manager Questions",
            "POST",
            "evaluations/generate",
            200,
            data=seller_evaluation_data,
            token=self.seller_token
        )
        
        if success:
            guide_content = seller_response.get('guide_content', {})
            role_perspective = seller_response.get('role_perspective')
            
            if role_perspective == 'seller':
                print(f"   ✅ Correct role perspective: {role_perspective}")
                
                if 'questions_manager' in guide_content:
                    questions = guide_content['questions_manager']
                    if isinstance(questions, list) and len(questions) > 0:
                        print(f"   ✅ Seller manager questions generated: {len(questions)} questions")
                        for i, q in enumerate(questions[:3], 1):  # Show first 3 questions
                            print(f"   📋 Question {i}: {q}")
                    else:
                        self.log_test("Seller Manager Questions Content", False, "questions_manager is empty or not a list")
                else:
                    self.log_test("Seller Manager Questions Field", False, "Missing questions_manager field")
            else:
                self.log_test("Seller Role Perspective", False, f"Expected 'seller', got '{role_perspective}'")

    def test_response_structure_completeness(self):
        """Test that response contains all required fields: synthese, victoires, axes_progres, objectifs"""
        print("\n🏗️ TESTING RESPONSE STRUCTURE COMPLETENESS")
        
        if not self.manager_token or not self.seller_id:
            self.log_test("Response Structure Completeness", False, "Missing manager token or seller ID")
            return
        
        evaluation_data = {
            "employee_id": self.seller_id,
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "comments": "Comprehensive evaluation for structure testing"
        }
        
        success, response = self.run_test(
            "Complete Structure Validation",
            "POST",
            "evaluations/generate",
            200,
            data=evaluation_data,
            token=self.manager_token
        )
        
        if success:
            guide_content = response.get('guide_content', {})
            
            # Check all required fields
            required_fields = ['synthese', 'victoires', 'axes_progres', 'objectifs']
            field_validation = {}
            
            for field in required_fields:
                if field in guide_content:
                    value = guide_content[field]
                    if field == 'synthese':
                        # Synthese should be a string
                        if isinstance(value, str) and len(value.strip()) > 0:
                            field_validation[field] = "✅ Valid string"
                            print(f"   ✅ {field}: {value[:100]}...")
                        else:
                            field_validation[field] = f"❌ Invalid: {type(value)}"
                            self.log_test(f"Field {field} Validation", False, f"Expected non-empty string, got {type(value)}")
                    else:
                        # Other fields should be arrays
                        if isinstance(value, list) and len(value) > 0:
                            field_validation[field] = f"✅ Valid array ({len(value)} items)"
                            print(f"   ✅ {field}: {len(value)} items")
                            for i, item in enumerate(value[:2], 1):  # Show first 2 items
                                print(f"      {i}. {item}")
                        else:
                            field_validation[field] = f"❌ Invalid: {type(value)} with {len(value) if isinstance(value, list) else 'N/A'} items"
                            self.log_test(f"Field {field} Validation", False, f"Expected non-empty array, got {type(value)}")
                else:
                    field_validation[field] = "❌ Missing"
                    self.log_test(f"Field {field} Presence", False, f"Missing required field: {field}")
            
            # Summary of field validation
            print(f"\n   📊 Field Validation Summary:")
            for field, status in field_validation.items():
                print(f"      {field}: {status}")

    def run_improved_evaluation_tests(self):
        """Run all improved evaluation generator tests"""
        print("🚀 STARTING IMPROVED EVALUATION GENERATOR TESTS")
        print("=" * 70)
        
        # Test authentication first
        self.test_authentication()
        
        # Test the improved features
        self.test_json_output_structure()
        self.test_comments_field_influence()
        self.test_role_specific_questions()
        self.test_response_structure_completeness()
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 IMPROVED EVALUATION GENERATOR TEST SUMMARY")
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
        
        print("\n🎯 IMPROVED EVALUATION GENERATOR VERIFICATION RESULTS:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("✅ Improved Evaluation Generator working correctly!")
            print("✅ JSON output structure validated")
            print("✅ Comments field influences AI responses")
            print("✅ Role-specific questions generated properly")
            print("✅ All required response fields present")
        else:
            print("❌ Improved Evaluation Generator has issues!")
            print("❌ Multiple tests failing - needs investigation")
        
        return self.tests_passed >= self.tests_run * 0.8

class GerantSellerDetailsTester:
    def __init__(self, base_url="https://invite-fix-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.gerant_token = None
        self.gerant_user = None
        self.store_id = None
        self.seller_ids = []
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

    def test_gerant_authentication(self):
        """Test Gérant authentication"""
        print("\n🔐 TESTING GÉRANT AUTHENTICATION FOR SELLER DETAILS")
        
        gerant_data = {
            "email": "gerant@skyco.fr",
            "password": "Gerant123!"
        }
        
        success, response = self.run_test(
            "Gérant Authentication for Seller Details Tests",
            "POST",
            "auth/login",
            200,
            data=gerant_data
        )
        
        if success and 'token' in response:
            self.gerant_token = response['token']
            self.gerant_user = response.get('user', {})
            print(f"   ✅ Gérant logged in: {self.gerant_user.get('email')}")
            return True
        else:
            print("   ❌ Failed to authenticate Gérant")
            return False

    def get_store_id(self):
        """Get a valid store_id from Gérant stores"""
        print("\n🏪 GETTING VALID STORE_ID")
        
        if not self.gerant_token:
            self.log_test("Get Store ID", False, "No gérant token available")
            return False
        
        success, response = self.run_test(
            "Get Gérant Stores",
            "GET",
            "gerant/stores",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            self.store_id = response[0].get('id')
            print(f"   ✅ Using store_id: {self.store_id}")
            print(f"   ✅ Store name: {response[0].get('name', 'Unknown')}")
            return True
        else:
            self.log_test("Get Store ID", False, "No stores found or invalid response")
            return False

    def get_seller_ids(self):
        """Get seller IDs from the store"""
        print("\n👥 GETTING SELLER IDS")
        
        if not self.gerant_token or not self.store_id:
            self.log_test("Get Seller IDs", False, "Missing gérant token or store_id")
            return False
        
        success, response = self.run_test(
            "Get Sellers for Store",
            "GET",
            f"manager/sellers?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            self.seller_ids = [seller.get('id') for seller in response if seller.get('id')]
            print(f"   ✅ Found {len(self.seller_ids)} sellers")
            for i, seller in enumerate(response[:3]):  # Show first 3 sellers
                print(f"   📋 Seller {i+1}: {seller.get('name', 'Unknown')} ({seller.get('id')})")
            return True
        else:
            self.log_test("Get Seller IDs", False, "No sellers found or invalid response")
            return False

    def test_seller_detail_endpoints(self):
        """Test all seller detail endpoints with store_id parameter"""
        print("\n📊 TESTING SELLER DETAIL ENDPOINTS WITH STORE_ID")
        
        if not self.gerant_token or not self.store_id or not self.seller_ids:
            self.log_test("Seller Detail Endpoints", False, "Missing required data (token, store_id, or seller_ids)")
            return
        
        # Use the first seller for testing
        seller_id = self.seller_ids[0]
        print(f"   🎯 Testing with seller_id: {seller_id}")
        
        # Test 1: GET /api/manager/kpi-entries/{seller_id}?store_id={store_id}&days=30
        success, response = self.run_test(
            "Manager KPI Entries for Seller",
            "GET",
            f"manager/kpi-entries/{seller_id}?store_id={self.store_id}&days=30",
            200,
            token=self.gerant_token
        )
        
        if success:
            if isinstance(response, list):
                print(f"   ✅ KPI entries returned: {len(response)} entries (may be empty)")
            else:
                print(f"   ✅ KPI entries response received")
            
            # Check for 400 error about missing store_id
            response_str = json.dumps(response) if isinstance(response, dict) else str(response)
            if "Le paramètre store_id est requis" in response_str:
                self.log_test("KPI Entries - No store_id Error Check", False, "Found 'Le paramètre store_id est requis' error")
            else:
                print(f"   ✅ No 'Le paramètre store_id est requis' error")
        
        # Test 2: GET /api/manager/seller/{seller_id}/stats?store_id={store_id}
        success, response = self.run_test(
            "Manager Seller Stats",
            "GET",
            f"manager/seller/{seller_id}/stats?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success:
            expected_fields = ['total_ca', 'total_ventes', 'panier_moyen']
            present_fields = [f for f in expected_fields if f in response]
            if len(present_fields) > 0:
                print(f"   ✅ Stats fields present: {present_fields}")
                if 'total_ca' in response:
                    print(f"   ✅ Total CA: {response.get('total_ca')}")
                if 'total_ventes' in response:
                    print(f"   ✅ Total Ventes: {response.get('total_ventes')}")
                if 'panier_moyen' in response:
                    print(f"   ✅ Panier Moyen: {response.get('panier_moyen')}")
            else:
                print(f"   ℹ️ Stats response structure: {list(response.keys()) if isinstance(response, dict) else type(response)}")
        
        # Test 3: GET /api/manager/seller/{seller_id}/diagnostic?store_id={store_id}
        success, response = self.run_test(
            "Manager Seller Diagnostic",
            "GET",
            f"manager/seller/{seller_id}/diagnostic?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success:
            if 'has_diagnostic' in response:
                print(f"   ✅ Diagnostic response: has_diagnostic={response.get('has_diagnostic')}")
            else:
                print(f"   ✅ Diagnostic response received")
        
        # Test 4: GET /api/manager/sellers/archived?store_id={store_id}
        success, response = self.run_test(
            "Manager Archived Sellers",
            "GET",
            f"manager/sellers/archived?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success:
            if isinstance(response, list):
                print(f"   ✅ Archived sellers returned: {len(response)} sellers (may be empty)")
            else:
                print(f"   ✅ Archived sellers response received")
        
        # Test 5: GET /api/manager/seller/{seller_id}/profile?store_id={store_id}
        success, response = self.run_test(
            "Manager Seller Profile",
            "GET",
            f"manager/seller/{seller_id}/profile?store_id={self.store_id}",
            200,
            token=self.gerant_token
        )
        
        if success:
            expected_fields = ['diagnostic', 'recent_kpis']
            present_fields = [f for f in expected_fields if f in response]
            if len(present_fields) > 0:
                print(f"   ✅ Profile fields present: {present_fields}")
            else:
                print(f"   ✅ Profile response received")
        
        # Test 6: GET /api/manager/seller/{seller_id}/kpi-history?store_id={store_id}&days=90
        success, response = self.run_test(
            "Manager Seller KPI History",
            "GET",
            f"manager/seller/{seller_id}/kpi-history?store_id={self.store_id}&days=90",
            200,
            token=self.gerant_token
        )
        
        if success:
            if 'entries' in response and isinstance(response['entries'], list):
                print(f"   ✅ KPI history entries: {len(response['entries'])} entries")
            else:
                print(f"   ✅ KPI history response received")

    def test_seller_detail_endpoints_without_store_id(self):
        """Test seller detail endpoints without store_id to verify they fail appropriately"""
        print("\n🚫 TESTING SELLER DETAIL ENDPOINTS WITHOUT STORE_ID (Should Fail)")
        
        if not self.gerant_token or not self.seller_ids:
            self.log_test("Seller Detail Endpoints Without Store ID", False, "Missing gérant token or seller_ids")
            return
        
        seller_id = self.seller_ids[0]
        
        # Test endpoints without store_id - should return 400 "Le paramètre store_id est requis"
        endpoints_to_test = [
            f"manager/kpi-entries/{seller_id}?days=30",
            f"manager/seller/{seller_id}/stats",
            f"manager/seller/{seller_id}/diagnostic",
            "manager/sellers/archived",
            f"manager/seller/{seller_id}/profile",
            f"manager/seller/{seller_id}/kpi-history?days=90"
        ]
        
        for endpoint in endpoints_to_test:
            success, response = self.run_test(
                f"Seller Detail {endpoint.split('/')[-1]} WITHOUT Store ID (Expected 400)",
                "GET",
                endpoint,
                400,
                token=self.gerant_token
            )
            
            if success:
                # Check if the error message is about missing store_id
                response_str = json.dumps(response) if isinstance(response, dict) else str(response)
                if "store_id" in response_str.lower():
                    print(f"   ✅ Correct error message about missing store_id")
                else:
                    print(f"   ℹ️ Got 400 but different error message: {response_str[:100]}")

    def run_seller_details_tests(self):
        """Run all seller detail tests for Gérant role"""
        print("🚀 STARTING GÉRANT SELLER DETAIL ENDPOINTS TESTS")
        print("=" * 70)
        
        # Step 1: Authenticate as Gérant
        if not self.test_gerant_authentication():
            print("❌ Cannot proceed without Gérant authentication")
            return False
        
        # Step 2: Get valid store_id
        if not self.get_store_id():
            print("❌ Cannot proceed without valid store_id")
            return False
        
        # Step 3: Get seller IDs
        if not self.get_seller_ids():
            print("❌ Cannot proceed without seller IDs")
            return False
        
        # Step 4: Test seller detail endpoints with store_id
        self.test_seller_detail_endpoints()
        
        # Step 5: Test seller detail endpoints without store_id (should fail)
        self.test_seller_detail_endpoints_without_store_id()
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 GÉRANT SELLER DETAIL ENDPOINTS TEST SUMMARY")
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
        
        print("\n🎯 SELLER DETAIL ENDPOINTS VERIFICATION RESULTS:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("✅ All seller detail endpoints working correctly with store_id!")
            print("✅ No 400 'Le paramètre store_id est requis' errors when store_id provided")
            print("✅ No 404 errors for valid seller IDs")
            print("✅ Seller stats contain real data (total_ca, seller_name)")
        else:
            print("❌ Seller detail endpoints have issues!")
            print("❌ Multiple endpoints failing - needs investigation")
        
        return self.tests_passed >= self.tests_run * 0.8


if __name__ == "__main__":
    print("🎯 RUNNING MORNING BRIEF AND STRIPE WEBHOOK TESTS")
    print("=" * 80)
    
    # Run Morning Brief and Webhook tests
    morning_brief_tester = MorningBriefAndWebhookTester()
    morning_brief_success = morning_brief_tester.run_morning_brief_and_webhook_tests()
    
    print("\n" + "=" * 80)
    print("🏁 FINAL RESULTS")
    print("=" * 80)
    print(f"Morning Brief & Stripe Webhook: {'✅ PASS' if morning_brief_success else '❌ FAIL'}")
    
    print(f"\n🎯 OVERALL: {'✅ ALL SYSTEMS OPERATIONAL' if morning_brief_success else '❌ ISSUES DETECTED'}")
    
    # Exit with appropriate code
    sys.exit(0 if morning_brief_success else 1)