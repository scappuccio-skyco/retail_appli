import requests
import sys
import json
from datetime import datetime

class RetailCoachAPITester:
    def __init__(self, base_url="https://retailmentor.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.seller_token = None
        self.manager_token = None
        self.seller_user = None
        self.manager_user = None
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

    def test_user_registration(self):
        """Test user registration for both seller and manager"""
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Test seller registration
        seller_data = {
            "name": f"Test Seller {timestamp}",
            "email": f"seller{timestamp}@test.com",
            "password": "TestPass123!",
            "role": "seller"
        }
        
        success, response = self.run_test(
            "Seller Registration",
            "POST",
            "auth/register",
            200,
            data=seller_data
        )
        
        if success and 'token' in response:
            self.seller_token = response['token']
            self.seller_user = response['user']
            print(f"   Seller ID: {self.seller_user['id']}")
        
        # Test manager registration
        manager_data = {
            "name": f"Test Manager {timestamp}",
            "email": f"manager{timestamp}@test.com",
            "password": "TestPass123!",
            "role": "manager"
        }
        
        success, response = self.run_test(
            "Manager Registration",
            "POST",
            "auth/register",
            200,
            data=manager_data
        )
        
        if success and 'token' in response:
            self.manager_token = response['token']
            self.manager_user = response['user']
            print(f"   Manager ID: {self.manager_user['id']}")

    def test_user_login(self):
        """Test user login"""
        if not self.seller_user:
            self.log_test("Login Test", False, "No seller user to test login")
            return
            
        login_data = {
            "email": self.seller_user['email'],
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )

    def test_auth_me(self):
        """Test getting current user info"""
        if not self.seller_token:
            self.log_test("Auth Me Test", False, "No seller token available")
            return
            
        self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200,
            token=self.seller_token
        )

    def test_sales_operations(self):
        """Test sales CRUD operations"""
        if not self.seller_token:
            self.log_test("Sales Operations", False, "No seller token available")
            return

        # Create sale
        sale_data = {
            "store_name": "Test Store",
            "total_amount": 150.50,
            "comments": "Test sale comment"
        }
        
        success, response = self.run_test(
            "Create Sale",
            "POST",
            "sales",
            200,
            data=sale_data,
            token=self.seller_token
        )
        
        sale_id = None
        if success and 'id' in response:
            sale_id = response['id']
            print(f"   Created Sale ID: {sale_id}")

        # Get sales
        self.run_test(
            "Get Sales",
            "GET",
            "sales",
            200,
            token=self.seller_token
        )
        
        return sale_id

    def test_evaluation_operations(self, sale_id):
        """Test evaluation CRUD operations with AI feedback"""
        if not self.seller_token or not sale_id:
            self.log_test("Evaluation Operations", False, "No seller token or sale ID available")
            return

        # Create evaluation
        eval_data = {
            "sale_id": sale_id,
            "accueil": 4,
            "decouverte": 3,
            "argumentation": 5,
            "closing": 4,
            "fidelisation": 3,
            "auto_comment": "Test evaluation comment"
        }
        
        print("   Creating evaluation with AI feedback (may take a few seconds)...")
        success, response = self.run_test(
            "Create Evaluation with AI Feedback",
            "POST",
            "evaluations",
            200,
            data=eval_data,
            token=self.seller_token
        )
        
        if success and 'ai_feedback' in response:
            print(f"   AI Feedback received: {response['ai_feedback'][:100]}...")

        # Get evaluations
        self.run_test(
            "Get Evaluations",
            "GET",
            "evaluations",
            200,
            token=self.seller_token
        )

    def test_manager_operations(self):
        """Test manager-specific operations"""
        if not self.manager_token:
            self.log_test("Manager Operations", False, "No manager token available")
            return

        # Get sellers list
        self.run_test(
            "Get Sellers List",
            "GET",
            "manager/sellers",
            200,
            token=self.manager_token
        )

        # Test seller stats (using seller ID if available)
        if self.seller_user:
            self.run_test(
                "Get Seller Stats",
                "GET",
                f"manager/seller/{self.seller_user['id']}/stats",
                404,  # Expected 404 since seller doesn't belong to this manager
                token=self.manager_token
            )

    def test_error_cases(self):
        """Test error handling"""
        # Test invalid login
        self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@test.com", "password": "wrong"}
        )

        # Test unauthorized access
        self.run_test(
            "Unauthorized Access",
            "GET",
            "sales",
            401  # No token provided
        )

        # Test duplicate registration
        if self.seller_user:
            self.run_test(
                "Duplicate Registration",
                "POST",
                "auth/register",
                400,
                data={
                    "name": "Duplicate User",
                    "email": self.seller_user['email'],
                    "password": "TestPass123!",
                    "role": "seller"
                }
            )

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Retail Coach 2.0 API Tests")
        print("=" * 50)

        # Authentication tests
        self.test_user_registration()
        self.test_user_login()
        self.test_auth_me()

        # Sales operations
        sale_id = self.test_sales_operations()

        # Evaluation operations (with AI feedback)
        self.test_evaluation_operations(sale_id)

        # Manager operations
        self.test_manager_operations()

        # Error handling
        self.test_error_cases()

        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check details above.")
            return 1

def main():
    tester = RetailCoachAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())