import requests
import sys
import json
from datetime import datetime

class RetailCoachAPITester:
    def __init__(self, base_url="https://sales-feedback-1.preview.emergentagent.com/api"):
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

    def test_diagnostic_flow(self):
        """Test diagnostic flow - critical functionality"""
        if not self.seller_token:
            self.log_test("Diagnostic Flow", False, "No seller token available")
            return

        print("\n🔍 Testing Diagnostic Flow (Critical)...")
        
        # Test 1: Check diagnostic status before creation (should return 404 or not_completed)
        success, response = self.run_test(
            "Get Diagnostic Status (Before Creation)",
            "GET",
            "diagnostic/me",
            200,
            token=self.seller_token
        )
        
        if success:
            if response.get('status') == 'not_completed':
                print("   ✅ Diagnostic status correctly shows 'not_completed'")
            else:
                print(f"   ⚠️  Unexpected diagnostic status: {response.get('status')}")

        # Test 2: Submit diagnostic with 15 questions
        diagnostic_responses = {
            "1": "Je préfère écouter attentivement le client avant de proposer",
            "2": "J'aime créer une atmosphère détendue et conviviale",
            "3": "Je pose des questions ouvertes pour comprendre les besoins",
            "4": "Je présente les avantages en me basant sur ce que j'ai appris",
            "5": "Je laisse le client réfléchir sans pression",
            "6": "Je privilégie la relation à long terme",
            "7": "J'aime apprendre de nouvelles techniques de vente",
            "8": "Je me sens à l'aise avec tous types de clients",
            "9": "Je préfère travailler en équipe",
            "10": "J'aime les défis commerciaux",
            "11": "Je suis motivé par la satisfaction client",
            "12": "J'aime découvrir de nouveaux produits",
            "13": "Je préfère une approche consultative",
            "14": "J'aime recevoir des retours constructifs",
            "15": "Je suis patient dans mes négociations"
        }
        
        diagnostic_data = {
            "responses": diagnostic_responses
        }
        
        print("   Creating diagnostic with AI analysis (may take 10-15 seconds)...")
        success, response = self.run_test(
            "Create Diagnostic with AI Analysis",
            "POST",
            "diagnostic",
            200,
            data=diagnostic_data,
            token=self.seller_token
        )
        
        diagnostic_result = None
        if success:
            diagnostic_result = response
            # Verify required fields are present
            required_fields = ['style', 'level', 'motivation', 'ai_profile_summary']
            missing_fields = []
            
            for field in required_fields:
                if field not in response:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_test("Diagnostic Result Validation", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Diagnostic Result Validation", True)
                print(f"   ✅ Style: {response.get('style')}")
                print(f"   ✅ Level: {response.get('level')}")
                print(f"   ✅ Motivation: {response.get('motivation')}")
                print(f"   ✅ AI Summary: {response.get('ai_profile_summary', '')[:100]}...")

        # Test 3: Check diagnostic status after creation (should return completed)
        success, response = self.run_test(
            "Get Diagnostic Status (After Creation)",
            "GET",
            "diagnostic/me",
            200,
            token=self.seller_token
        )
        
        if success:
            if response.get('status') == 'completed':
                print("   ✅ Diagnostic status correctly shows 'completed'")
                diagnostic_data = response.get('diagnostic', {})
                if diagnostic_data:
                    print(f"   ✅ Diagnostic data persisted correctly")
                    # Verify the data matches what was created
                    if diagnostic_result:
                        if diagnostic_data.get('id') == diagnostic_result.get('id'):
                            print("   ✅ Diagnostic ID matches created diagnostic")
                        else:
                            self.log_test("Diagnostic Persistence Check", False, "Diagnostic ID mismatch")
            else:
                self.log_test("Diagnostic Status After Creation", False, f"Expected 'completed', got '{response.get('status')}'")

        # Test 4: Try to submit diagnostic again (should return 400 error)
        success, response = self.run_test(
            "Duplicate Diagnostic Submission",
            "POST",
            "diagnostic",
            400,
            data=diagnostic_data,
            token=self.seller_token
        )
        
        if success:
            print("   ✅ Correctly prevents duplicate diagnostic submission")

    def test_existing_seller_diagnostic_scenario(self):
        """Test Scenario 2: Existing seller with completed diagnostic"""
        if not self.seller_token:
            self.log_test("Existing Seller Diagnostic Scenario", False, "No seller token available")
            return

        print("\n🔍 Testing Existing Seller Diagnostic Scenario...")
        
        # Simulate login as existing seller (we already have a completed diagnostic from previous test)
        # Test that diagnostic data persists across "sessions"
        success, response = self.run_test(
            "Existing Seller - Get Diagnostic Status",
            "GET",
            "diagnostic/me",
            200,
            token=self.seller_token
        )
        
        if success:
            if response.get('status') == 'completed':
                print("   ✅ Existing seller diagnostic status correctly shows 'completed'")
                diagnostic_data = response.get('diagnostic', {})
                
                # Verify all required fields are present
                required_fields = ['style', 'level', 'motivation', 'ai_profile_summary', 'seller_id', 'responses']
                present_fields = []
                missing_fields = []
                
                for field in required_fields:
                    if field in diagnostic_data:
                        present_fields.append(field)
                    else:
                        missing_fields.append(field)
                
                if missing_fields:
                    self.log_test("Existing Seller Diagnostic Data Validation", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Existing Seller Diagnostic Data Validation", True)
                    print(f"   ✅ All diagnostic data fields present: {present_fields}")
                    print(f"   ✅ Seller ID: {diagnostic_data.get('seller_id')}")
                    print(f"   ✅ Style: {diagnostic_data.get('style')}")
                    print(f"   ✅ Level: {diagnostic_data.get('level')}")
                    print(f"   ✅ Motivation: {diagnostic_data.get('motivation')}")
            else:
                self.log_test("Existing Seller Diagnostic Status", False, f"Expected 'completed', got '{response.get('status')}'")

        # Test that existing seller cannot submit diagnostic again
        diagnostic_responses = {
            "1": "Different response this time",
            "2": "Another different response"
        }
        
        diagnostic_data = {
            "responses": diagnostic_responses
        }
        
        success, response = self.run_test(
            "Existing Seller - Prevent Duplicate Diagnostic",
            "POST",
            "diagnostic",
            400,
            data=diagnostic_data,
            token=self.seller_token
        )
        
        if success:
            print("   ✅ Existing seller correctly prevented from submitting new diagnostic")

    def test_debrief_flow(self):
        """Test comprehensive debrief functionality - CRITICAL FEATURE"""
        if not self.seller_token:
            self.log_test("Debrief Flow", False, "No seller token available")
            return

        print("\n🔍 Testing Debrief Flow (CRITICAL FEATURE)...")
        
        # Test 1: Create debrief with complete data (Happy Path)
        debrief_data = {
            "type_client": "Indécis / hésitant",
            "moment_journee": "Milieu",
            "emotion": "Confiant",
            "produit": "iPhone 15 Pro",
            "raisons_echec": "Manque d'argument convaincant",
            "moment_perte_client": "Argumentation",
            "sentiment": "Frustré de ne pas avoir su répondre aux objections",
            "amelioration_pensee": "J'aurais pu mieux préparer mes arguments sur les fonctionnalités",
            "action_future": "Je vais étudier les comparatifs produits et préparer des réponses aux objections courantes"
        }
        
        print("   Creating debrief with AI analysis (may take 10-15 seconds)...")
        success, response = self.run_test(
            "Create Debrief with AI Analysis",
            "POST",
            "debriefs",
            200,
            data=debrief_data,
            token=self.seller_token
        )
        
        created_debrief = None
        if success:
            created_debrief = response
            # Verify all input fields are present
            input_fields = list(debrief_data.keys())
            missing_input_fields = []
            
            for field in input_fields:
                if field not in response or response[field] != debrief_data[field]:
                    missing_input_fields.append(field)
            
            if missing_input_fields:
                self.log_test("Debrief Input Data Validation", False, f"Missing or incorrect input fields: {missing_input_fields}")
            else:
                self.log_test("Debrief Input Data Validation", True)
                print("   ✅ All input fields correctly saved")
            
            # Verify required system fields are present
            required_system_fields = ['id', 'seller_id', 'created_at']
            missing_system_fields = []
            
            for field in required_system_fields:
                if field not in response:
                    missing_system_fields.append(field)
            
            if missing_system_fields:
                self.log_test("Debrief System Fields Validation", False, f"Missing system fields: {missing_system_fields}")
            else:
                self.log_test("Debrief System Fields Validation", True)
                print(f"   ✅ Debrief ID: {response.get('id')}")
                print(f"   ✅ Seller ID: {response.get('seller_id')}")
                print(f"   ✅ Created At: {response.get('created_at')}")
            
            # Verify AI analysis fields are present and in French
            ai_fields = ['ai_analyse', 'ai_points_travailler', 'ai_recommandation']
            missing_ai_fields = []
            
            for field in ai_fields:
                if field not in response or not response[field]:
                    missing_ai_fields.append(field)
            
            if missing_ai_fields:
                self.log_test("Debrief AI Analysis Validation", False, f"Missing AI fields: {missing_ai_fields}")
            else:
                self.log_test("Debrief AI Analysis Validation", True)
                print(f"   ✅ AI Analysis: {response.get('ai_analyse', '')[:100]}...")
                
                # Verify ai_points_travailler is an array
                points = response.get('ai_points_travailler', [])
                if isinstance(points, list) and len(points) > 0:
                    print(f"   ✅ AI Points to Work On ({len(points)} items): {points[0][:50]}...")
                else:
                    self.log_test("AI Points Array Validation", False, "ai_points_travailler should be a non-empty array")
                
                print(f"   ✅ AI Recommendation: {response.get('ai_recommandation', '')[:100]}...")
                
                # Check if responses are in French (basic check for French words)
                french_indicators = ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'à', 'pour', 'avec', 'sur', 'dans']
                ai_text = f"{response.get('ai_analyse', '')} {response.get('ai_recommandation', '')}"
                
                if any(word in ai_text.lower() for word in french_indicators):
                    print("   ✅ AI responses appear to be in French")
                else:
                    print("   ⚠️  AI responses may not be in French")

        # Test 2: Get debriefs (should include the created debrief)
        success, response = self.run_test(
            "Get Debriefs",
            "GET",
            "debriefs",
            200,
            token=self.seller_token
        )
        
        if success:
            if isinstance(response, list):
                self.log_test("Get Debriefs Response Format", True)
                print(f"   ✅ Retrieved {len(response)} debrief(s)")
                
                # Verify the created debrief is in the list
                if created_debrief and len(response) > 0:
                    found_debrief = None
                    for debrief in response:
                        if debrief.get('id') == created_debrief.get('id'):
                            found_debrief = debrief
                            break
                    
                    if found_debrief:
                        self.log_test("Debrief Persistence Validation", True)
                        print("   ✅ Created debrief found in GET response")
                        
                        # Verify all fields are still present
                        if (found_debrief.get('ai_analyse') and 
                            found_debrief.get('ai_points_travailler') and 
                            found_debrief.get('ai_recommandation')):
                            print("   ✅ All AI analysis fields persisted correctly")
                        else:
                            self.log_test("Debrief AI Persistence", False, "AI analysis fields not properly persisted")
                    else:
                        self.log_test("Debrief Persistence Validation", False, "Created debrief not found in GET response")
            else:
                self.log_test("Get Debriefs Response Format", False, "Response should be an array")

    def test_debrief_validation_and_auth(self):
        """Test debrief input validation and authentication"""
        print("\n🔍 Testing Debrief Validation and Authentication...")
        
        # Test 3: Input validation - missing required fields
        incomplete_data = {
            "type_client": "Indécis / hésitant",
            "moment_journee": "Milieu"
            # Missing other required fields
        }
        
        success, response = self.run_test(
            "Debrief Input Validation (Missing Fields)",
            "POST",
            "debriefs",
            422,  # Validation error
            data=incomplete_data,
            token=self.seller_token
        )
        
        if success:
            print("   ✅ Correctly validates required fields")

        # Test 4: Authentication - no token
        complete_data = {
            "type_client": "Pressé",
            "moment_journee": "Fin",
            "emotion": "Stressé",
            "produit": "Samsung Galaxy",
            "raisons_echec": "Client pressé",
            "moment_perte_client": "Présentation",
            "sentiment": "Déçu",
            "amelioration_pensee": "Être plus concis",
            "action_future": "Préparer des présentations courtes"
        }
        
        success, response = self.run_test(
            "Debrief Authentication (No Token)",
            "POST",
            "debriefs",
            401,  # Unauthorized
            data=complete_data
        )
        
        if success:
            print("   ✅ Correctly requires authentication")

        # Test 5: Authentication - GET without token
        success, response = self.run_test(
            "Get Debriefs Authentication (No Token)",
            "GET",
            "debriefs",
            401,  # Unauthorized
        )
        
        if success:
            print("   ✅ GET debriefs correctly requires authentication")

    def test_existing_seller_login_scenario(self):
        """Test login with existing seller account (vendeur2@test.com)"""
        print("\n🔍 Testing Existing Seller Login Scenario...")
        
        # Login with the specific seller account mentioned in the review request
        login_data = {
            "email": "vendeur2@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Existing Seller Login (vendeur2@test.com)",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        existing_seller_token = None
        if success and 'token' in response:
            existing_seller_token = response['token']
            existing_seller = response['user']
            print(f"   ✅ Logged in as: {existing_seller.get('name')} ({existing_seller.get('email')})")
            print(f"   ✅ Seller ID: {existing_seller.get('id')}")
            
            # Test debrief creation with existing seller
            debrief_data = {
                "type_client": "Curieux / intéressé",
                "moment_journee": "Début",
                "emotion": "Motivé",
                "produit": "MacBook Pro",
                "raisons_echec": "Prix trop élevé pour le budget",
                "moment_perte_client": "Présentation du prix",
                "sentiment": "Compréhensif mais déçu",
                "amelioration_pensee": "J'aurais pu proposer des alternatives de financement",
                "action_future": "Préparer des options de paiement échelonné et des produits alternatifs"
            }
            
            print("   Creating debrief with existing seller account...")
            success, response = self.run_test(
                "Existing Seller - Create Debrief",
                "POST",
                "debriefs",
                200,
                data=debrief_data,
                token=existing_seller_token
            )
            
            if success:
                print(f"   ✅ Debrief created successfully for existing seller")
                print(f"   ✅ AI Analysis: {response.get('ai_analyse', '')[:80]}...")
                
                # Test getting debriefs for existing seller
                success, get_response = self.run_test(
                    "Existing Seller - Get Debriefs",
                    "GET",
                    "debriefs",
                    200,
                    token=existing_seller_token
                )
                
                if success and isinstance(get_response, list):
                    print(f"   ✅ Retrieved {len(get_response)} debrief(s) for existing seller")
                    
                    # Verify the just-created debrief is in the response
                    found = any(d.get('id') == response.get('id') for d in get_response)
                    if found:
                        print("   ✅ Created debrief found in seller's debrief list")
                    else:
                        self.log_test("Existing Seller Debrief Retrieval", False, "Created debrief not found in list")
        else:
            print("   ⚠️  Could not login with vendeur2@test.com - account may not exist")
            print("   This is expected if the account hasn't been created yet")

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

        # CRITICAL: Diagnostic flow tests (as requested)
        self.test_diagnostic_flow()
        
        # Test existing seller scenario
        self.test_existing_seller_diagnostic_scenario()

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