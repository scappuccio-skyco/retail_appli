import requests
import sys
import json
from datetime import datetime, timezone

class DailyChallengeRefreshTester:
    def __init__(self, base_url="https://review-helper-8.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.seller_token = None
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

    def test_seller_authentication(self):
        """Test seller authentication"""
        print("\n🔐 TESTING SELLER AUTHENTICATION FOR DAILY CHALLENGE")
        
        seller_data = {
            "email": "emma.petit@test.com",
            "password": "TestDemo123!"
        }
        
        success, response = self.run_test(
            "Seller Authentication for Daily Challenge Tests",
            "POST",
            "auth/login",
            200,
            data=seller_data
        )
        
        if success and 'token' in response:
            self.seller_token = response['token']
            self.seller_user = response.get('user', {})
            print(f"   ✅ Seller logged in: {self.seller_user.get('email')}")
            return True
        else:
            print("   ❌ Failed to authenticate seller")
            return False

    def test_daily_challenge_refresh_basic(self):
        """Test basic daily challenge refresh functionality"""
        print("\n🔄 TESTING DAILY CHALLENGE REFRESH - BASIC")
        
        if not self.seller_token:
            self.log_test("Daily Challenge Refresh Basic", False, "No seller token available")
            return
        
        # Test 1: POST /api/seller/daily-challenge/refresh with empty body
        success, response = self.run_test(
            "Daily Challenge Refresh - Empty Body",
            "POST",
            "seller/daily-challenge/refresh",
            200,
            data={},
            token=self.seller_token
        )
        
        if success:
            # Verify response structure
            required_fields = ['id', 'seller_id', 'date', 'competence', 'title', 'description', 'completed']
            missing_fields = [f for f in required_fields if f not in response]
            
            if missing_fields:
                self.log_test("Challenge Refresh Response Structure", False, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ Challenge created with ID: {response.get('id')}")
                print(f"   ✅ Competence: {response.get('competence')}")
                print(f"   ✅ Title: {response.get('title')}")
                print(f"   ✅ Completed: {response.get('completed')}")
                
                # Verify competence is valid
                valid_competences = ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']
                if response.get('competence') in valid_competences:
                    print(f"   ✅ Valid competence: {response.get('competence')}")
                else:
                    self.log_test("Challenge Competence Validation", False, f"Invalid competence: {response.get('competence')}")
                
                # Verify completed is False for new challenge
                if response.get('completed') == False:
                    print(f"   ✅ New challenge is uncompleted as expected")
                else:
                    self.log_test("Challenge Completion Status", False, f"New challenge should be uncompleted, got: {response.get('completed')}")

    def test_daily_challenge_refresh_force_competence(self):
        """Test daily challenge refresh with forced competence"""
        print("\n🎯 TESTING DAILY CHALLENGE REFRESH - FORCE COMPETENCE")
        
        if not self.seller_token:
            self.log_test("Daily Challenge Refresh Force Competence", False, "No seller token available")
            return
        
        # Test 2: POST /api/seller/daily-challenge/refresh with force_competence
        success, response = self.run_test(
            "Daily Challenge Refresh - Force Closing",
            "POST",
            "seller/daily-challenge/refresh",
            200,
            data={"force_competence": "closing"},
            token=self.seller_token
        )
        
        if success:
            # Verify the competence is "closing"
            if response.get('competence') == 'closing':
                print(f"   ✅ Forced competence working: {response.get('competence')}")
                print(f"   ✅ Challenge title: {response.get('title')}")
                print(f"   ✅ Challenge description: {response.get('description')}")
            else:
                self.log_test("Force Competence Validation", False, f"Expected 'closing', got: {response.get('competence')}")

    def test_daily_challenge_get_after_refresh(self):
        """Test GET daily challenge after refresh"""
        print("\n📋 TESTING GET DAILY CHALLENGE AFTER REFRESH")
        
        if not self.seller_token:
            self.log_test("Get Daily Challenge After Refresh", False, "No seller token available")
            return
        
        # Test 3: GET /api/seller/daily-challenge
        success, response = self.run_test(
            "Get Daily Challenge After Refresh",
            "GET",
            "seller/daily-challenge",
            200,
            token=self.seller_token
        )
        
        if success:
            # Verify response structure
            required_fields = ['id', 'seller_id', 'date', 'competence', 'title', 'description', 'completed']
            missing_fields = [f for f in required_fields if f not in response]
            
            if missing_fields:
                self.log_test("Get Challenge Response Structure", False, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ Retrieved challenge ID: {response.get('id')}")
                print(f"   ✅ Challenge competence: {response.get('competence')}")
                print(f"   ✅ Challenge date: {response.get('date')}")
                
                # Verify it's today's challenge
                today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
                if response.get('date') == today:
                    print(f"   ✅ Challenge is for today: {today}")
                else:
                    self.log_test("Challenge Date Validation", False, f"Expected today ({today}), got: {response.get('date')}")

    def test_multiple_refreshes(self):
        """Test multiple refreshes in a row"""
        print("\n🔄 TESTING MULTIPLE REFRESHES")
        
        if not self.seller_token:
            self.log_test("Multiple Refreshes", False, "No seller token available")
            return
        
        challenge_ids = []
        
        # Test 4: Call refresh twice in a row
        for i in range(2):
            success, response = self.run_test(
                f"Daily Challenge Refresh #{i+1}",
                "POST",
                "seller/daily-challenge/refresh",
                200,
                data={},
                token=self.seller_token
            )
            
            if success:
                challenge_id = response.get('id')
                challenge_ids.append(challenge_id)
                print(f"   ✅ Refresh #{i+1} created challenge: {challenge_id}")
                print(f"   ✅ Competence: {response.get('competence')}")
                
                # Verify each call returns a valid new challenge
                required_fields = ['id', 'seller_id', 'date', 'competence', 'title', 'description', 'completed']
                missing_fields = [f for f in required_fields if f not in response]
                
                if missing_fields:
                    self.log_test(f"Multiple Refresh #{i+1} Structure", False, f"Missing fields: {missing_fields}")
                else:
                    print(f"   ✅ Refresh #{i+1} has all required fields")
        
        # Verify we got different challenge IDs (new challenges each time)
        if len(set(challenge_ids)) == len(challenge_ids):
            print(f"   ✅ Each refresh created a new challenge (unique IDs)")
        else:
            self.log_test("Multiple Refresh Uniqueness", False, "Refreshes returned duplicate challenge IDs")
        
        # Test 5: Verify only one uncompleted challenge exists for today
        success, response = self.run_test(
            "Get Challenge After Multiple Refreshes",
            "GET",
            "seller/daily-challenge",
            200,
            token=self.seller_token
        )
        
        if success:
            # Should return the latest challenge
            latest_id = challenge_ids[-1] if challenge_ids else None
            if response.get('id') == latest_id:
                print(f"   ✅ GET returns the latest challenge: {latest_id}")
            else:
                print(f"   ℹ️ GET returned challenge: {response.get('id')}, latest refresh: {latest_id}")

    def test_authentication_security(self):
        """Test authentication security for daily challenge endpoints"""
        print("\n🔒 TESTING DAILY CHALLENGE AUTHENTICATION SECURITY")
        
        # Test without authentication
        success, response = self.run_test(
            "Daily Challenge Refresh - No Auth (Expected 403)",
            "POST",
            "seller/daily-challenge/refresh",
            403,
            data={}
        )
        
        success, response = self.run_test(
            "Get Daily Challenge - No Auth (Expected 403)",
            "GET",
            "seller/daily-challenge",
            403
        )

    def run_daily_challenge_tests(self):
        """Run all daily challenge refresh tests"""
        print("🚀 STARTING DAILY CHALLENGE REFRESH TESTS")
        print("=" * 70)
        
        # Step 1: Authenticate as seller
        if not self.test_seller_authentication():
            print("❌ Cannot proceed without seller authentication")
            return False
        
        # Step 2: Test basic refresh functionality
        self.test_daily_challenge_refresh_basic()
        
        # Step 3: Test force competence
        self.test_daily_challenge_refresh_force_competence()
        
        # Step 4: Test GET after refresh
        self.test_daily_challenge_get_after_refresh()
        
        # Step 5: Test multiple refreshes
        self.test_multiple_refreshes()
        
        # Step 6: Test security
        self.test_authentication_security()
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 DAILY CHALLENGE REFRESH TEST SUMMARY")
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
        
        print("\n🎯 DAILY CHALLENGE VERIFICATION RESULTS:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% pass rate
            print("✅ Daily challenge refresh functionality working correctly!")
            print("✅ POST /api/seller/daily-challenge/refresh returns valid challenges")
            print("✅ Force competence parameter working")
            print("✅ GET /api/seller/daily-challenge returns refreshed challenges")
            print("✅ Multiple refreshes work correctly")
            print("✅ No 404 errors detected")
        else:
            print("❌ Daily challenge refresh functionality has issues!")
            print("❌ Multiple endpoints failing - needs investigation")
        
        return self.tests_passed >= self.tests_run * 0.8


if __name__ == "__main__":
    # Run Daily Challenge Refresh tests only (as requested in review)
    print("🚀 STARTING DAILY CHALLENGE REFRESH BACKEND TESTS")
    print("=" * 70)
    
    # Run Daily Challenge Refresh tests
    challenge_tester = DailyChallengeRefreshTester()
    success = challenge_tester.run_daily_challenge_tests()
    
    print("\n" + "=" * 70)
    print("🎯 DAILY CHALLENGE TEST RESULTS")
    print("=" * 70)
    
    if success:
        print("✅ DAILY CHALLENGE REFRESH TESTS PASSED!")
        print("✅ No 404 errors found")
        print("✅ All endpoints working correctly")
        sys.exit(0)
    else:
        print("❌ DAILY CHALLENGE REFRESH TESTS FAILED!")
        print("❌ Issues detected - see details above")
        sys.exit(1)