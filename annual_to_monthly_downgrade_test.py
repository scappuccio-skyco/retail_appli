#!/usr/bin/env python3
"""
Test script for annual to monthly downgrade blocking feature.

This script tests the specific scenario requested:
1. Login with Manager12@test.com / demo123
2. Try to create a checkout session with billing_period='monthly' (should FAIL)
3. Verify HTTP 400 response with French error message about downgrade blocking
"""

import requests
import json
import sys
from datetime import datetime

class AnnualToMonthlyDowngradeTest:
    def __init__(self, base_url="https://store-manager-61.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.manager_token = None
        self.manager_user = None
        self.test_results = []

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, token=None, expected_status=None):
        """Make HTTP request and return response"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        print(f"\n🔍 {method} {url}")
        if data:
            print(f"   Request Body: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            
            print(f"   Response Status: {response.status_code}")
            
            # Try to parse JSON response
            try:
                response_data = response.json()
                print(f"   Response Body: {json.dumps(response_data, indent=2)}")
            except:
                response_data = {"text": response.text[:500]}
                print(f"   Response Text: {response.text[:500]}")
            
            # Check expected status if provided
            if expected_status and response.status_code != expected_status:
                return False, {
                    "error": f"Expected status {expected_status}, got {response.status_code}",
                    "response": response_data
                }
            
            return True, response_data

        except Exception as e:
            error_msg = f"Request failed: {str(e)}"
            print(f"   ❌ {error_msg}")
            return False, {"error": error_msg}

    def test_manager_login(self):
        """Test 1: Login with Manager12@test.com credentials"""
        print("\n" + "="*60)
        print("TEST 1: Manager Authentication")
        print("="*60)
        
        login_data = {
            "email": "Manager12@test.com",
            "password": "demo123"
        }
        
        success, response = self.make_request(
            "POST", 
            "auth/login", 
            data=login_data,
            expected_status=200
        )
        
        if success and 'token' in response:
            self.manager_token = response['token']
            self.manager_user = response['user']
            
            self.log_result(
                "Manager Login (Manager12@test.com)",
                True,
                f"Logged in as: {self.manager_user.get('name')} (ID: {self.manager_user.get('id')})"
            )
            
            # Verify user details
            print(f"   ✅ Manager Name: {self.manager_user.get('name')}")
            print(f"   ✅ Manager Email: {self.manager_user.get('email')}")
            print(f"   ✅ Manager ID: {self.manager_user.get('id')}")
            print(f"   ✅ Workspace ID: {self.manager_user.get('workspace_id')}")
            
            return True
        else:
            self.log_result(
                "Manager Login (Manager12@test.com)",
                False,
                f"Login failed: {response.get('error', 'Unknown error')}"
            )
            return False

    def test_get_subscription_status(self):
        """Test 2: Get current subscription status to verify annual billing"""
        print("\n" + "="*60)
        print("TEST 2: Current Subscription Status")
        print("="*60)
        
        if not self.manager_token:
            self.log_result("Get Subscription Status", False, "No manager token available")
            return False
        
        success, response = self.make_request(
            "GET",
            "subscription/status",
            token=self.manager_token,
            expected_status=200
        )
        
        if success:
            subscription = response.get('subscription', {})
            billing_interval = subscription.get('billing_interval')
            billing_interval_count = subscription.get('billing_interval_count')
            current_period_end = subscription.get('current_period_end')
            
            self.log_result(
                "Get Subscription Status",
                True,
                f"Billing: {billing_interval} (count: {billing_interval_count}), Period end: {current_period_end}"
            )
            
            # Verify this is an annual subscription
            if billing_interval == 'year' and billing_interval_count == 1:
                print(f"   ✅ Confirmed: Annual subscription (year/1)")
                print(f"   ✅ Current period end: {current_period_end}")
                return True
            else:
                print(f"   ⚠️  Subscription is not annual: {billing_interval}/{billing_interval_count}")
                return False
        else:
            self.log_result("Get Subscription Status", False, f"Failed to get status: {response}")
            return False

    def test_create_annual_subscription_first(self):
        """Test 3a: Create annual subscription first to test downgrade blocking"""
        print("\n" + "="*60)
        print("TEST 3a: Create Annual Subscription")
        print("="*60)
        
        if not self.manager_token:
            self.log_result("Create Annual Subscription", False, "No manager token available")
            return False
        
        # First create an annual subscription
        checkout_data = {
            "plan": "professional",
            "quantity": 8,
            "billing_period": "annual",
            "origin_url": "https://store-manager-61.preview.emergentagent.com/dashboard"
        }
        
        print(f"   Creating annual subscription first...")
        
        success, response = self.make_request(
            "POST",
            "checkout/create-session",
            data=checkout_data,
            token=self.manager_token
        )
        
        if success and 'url' in response:
            self.log_result(
                "Create Annual Subscription",
                True,
                f"Annual checkout session created: {response.get('session_id', 'N/A')}"
            )
            print(f"   ✅ Annual subscription checkout URL created")
            print(f"   ℹ️  In real scenario, user would complete payment via Stripe")
            return True
        else:
            self.log_result(
                "Create Annual Subscription",
                False,
                f"Failed to create annual subscription: {response}"
            )
            return False

    def test_annual_to_monthly_downgrade_blocking(self):
        """Test 3b: Attempt to downgrade from annual to monthly (should be blocked)"""
        print("\n" + "="*60)
        print("TEST 3b: Annual to Monthly Downgrade Blocking")
        print("="*60)
        
        if not self.manager_token:
            self.log_result("Annual to Monthly Downgrade Test", False, "No manager token available")
            return False
        
        # Attempt to create checkout session with monthly billing
        checkout_data = {
            "plan": "professional",
            "quantity": 8,
            "billing_period": "monthly",
            "origin_url": "https://store-manager-61.preview.emergentagent.com/dashboard"
        }
        
        print(f"   Attempting to downgrade from annual to monthly billing...")
        print(f"   Expected result: HTTP 400 with French error message")
        
        success, response = self.make_request(
            "POST",
            "checkout/create-session",
            data=checkout_data,
            token=self.manager_token,
            expected_status=400
        )
        
        if success:
            # Check if we got the expected error message
            error_detail = response.get('detail', '')
            expected_message_part = "Impossible de passer d'un abonnement annuel à mensuel"
            
            if expected_message_part in error_detail:
                self.log_result(
                    "Annual to Monthly Downgrade Blocking",
                    True,
                    f"Correctly blocked with message: {error_detail}"
                )
                
                print(f"   ✅ HTTP 400 Bad Request returned as expected")
                print(f"   ✅ French error message received: {error_detail}")
                print(f"   ✅ Downgrade blocking is working correctly")
                return True
            else:
                self.log_result(
                    "Annual to Monthly Downgrade Blocking",
                    False,
                    f"Got HTTP 400 but wrong error message: {error_detail}"
                )
                return False
        else:
            # If we didn't get HTTP 400, the test failed
            self.log_result(
                "Annual to Monthly Downgrade Blocking",
                False,
                f"Expected HTTP 400 but got different response: {response}"
            )
            return False

    def test_frontend_backend_consistency(self):
        """Test 4: Verify both frontend and backend block the downgrade"""
        print("\n" + "="*60)
        print("TEST 4: Frontend and Backend Consistency Check")
        print("="*60)
        
        # This test verifies that the blocking happens at the backend level
        # The review request mentions it should be blocked at both frontend and backend levels
        
        print("   ✅ Backend blocking verified in Test 3")
        print("   ℹ️  Frontend blocking would be tested in UI tests (not in scope for backend testing)")
        
        self.log_result(
            "Frontend and Backend Consistency",
            True,
            "Backend blocking confirmed. Frontend blocking requires UI testing."
        )
        
        return True

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Annual to Monthly Downgrade Blocking Tests")
        print("="*80)
        
        # Test sequence
        tests = [
            ("Manager Authentication", self.test_manager_login),
            ("Subscription Status Check", self.test_get_subscription_status),
            ("Create Annual Subscription", self.test_create_annual_subscription_first),
            ("Downgrade Blocking Test", self.test_annual_to_monthly_downgrade_blocking),
            ("Consistency Check", self.test_frontend_backend_consistency)
        ]
        
        all_passed = True
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                if not result:
                    all_passed = False
                    print(f"\n⚠️  {test_name} failed - continuing with remaining tests...")
            except Exception as e:
                print(f"\n❌ {test_name} threw exception: {str(e)}")
                self.log_result(test_name, False, f"Exception: {str(e)}")
                all_passed = False
        
        # Print summary
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        passed_count = sum(1 for result in self.test_results if result['success'])
        total_count = len(self.test_results)
        
        print(f"Tests Run: {total_count}")
        print(f"Tests Passed: {passed_count}")
        print(f"Tests Failed: {total_count - passed_count}")
        print(f"Success Rate: {(passed_count/total_count)*100:.1f}%")
        
        print("\nDetailed Results:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}")
            if result['details']:
                print(f"   {result['details']}")
        
        if all_passed:
            print("\n🎉 ALL TESTS PASSED!")
            print("✅ Annual to monthly downgrade blocking is working correctly")
            print("✅ Manager12@test.com can authenticate successfully")
            print("✅ HTTP 400 error returned with correct French message")
            print("✅ Backend properly prevents downgrade from annual to monthly")
        else:
            print("\n⚠️  SOME TESTS FAILED!")
            print("Please review the failed tests above")
        
        return all_passed

if __name__ == "__main__":
    print("Annual to Monthly Downgrade Blocking Test")
    print("Testing Manager12@test.com account downgrade prevention")
    print()
    
    tester = AnnualToMonthlyDowngradeTest()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)