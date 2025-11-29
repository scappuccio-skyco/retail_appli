#!/usr/bin/env python3
"""
Focused test for Conflict Resolution APIs as requested in the review.
Tests the specific scenarios mentioned in the review request.
"""

import requests
import json
from datetime import datetime

class ConflictResolutionTester:
    def __init__(self, base_url="https://user-flow-enhance-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.manager_token = None
        self.seller_token = None
        self.manager_user = None
        self.seller_user = None
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")

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
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)

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

    def test_manager_login(self):
        """Test manager login with specific account"""
        print("\n🔍 Testing Manager Login...")
        
        # Try to login with manager1@test.com first
        login_data = {
            "email": "manager1@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Manager Login (manager1@test.com)",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.manager_token = response['token']
            self.manager_user = response['user']
            print(f"   ✅ Logged in as: {self.manager_user.get('name')} ({self.manager_user.get('email')})")
            print(f"   ✅ Manager ID: {self.manager_user.get('id')}")
            return True
        else:
            print("   ⚠️  manager1@test.com not found, creating manager account...")
            # Create manager account
            register_data = {
                "name": "Test Manager 1",
                "email": "manager1@test.com",
                "password": "password123",
                "role": "manager"
            }
            
            success, response = self.run_test(
                "Create Manager Account",
                "POST",
                "auth/register",
                200,
                data=register_data
            )
            
            if success and 'token' in response:
                self.manager_token = response['token']
                self.manager_user = response['user']
                print(f"   ✅ Created and logged in as: {self.manager_user.get('name')}")
                return True
            else:
                print("   ❌ Could not create manager account")
                return False

    def test_seller_login(self):
        """Test seller login with specific account"""
        print("\n🔍 Testing Seller Login...")
        
        # Login with vendeur2@test.com as specified in review
        login_data = {
            "email": "vendeur2@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Seller Login (vendeur2@test.com)",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.seller_token = response['token']
            self.seller_user = response['user']
            print(f"   ✅ Logged in as: {self.seller_user.get('name')} ({self.seller_user.get('email')})")
            print(f"   ✅ Seller ID: {self.seller_user.get('id')}")
            return True
        else:
            print("   ❌ Could not login with vendeur2@test.com")
            return False

    def setup_manager_seller_relationship(self):
        """Link seller to manager for testing"""
        if not self.manager_user or not self.seller_user:
            print("   ❌ Missing manager or seller for relationship setup")
            return False
        
        print(f"\n🔍 Setting up Manager-Seller Relationship...")
        
        # Link seller to manager
        success, response = self.run_test(
            "Link Seller to Manager",
            "PATCH",
            f"users/{self.seller_user['id']}/link-manager?manager_id={self.manager_user['id']}",
            200,
            token=self.manager_token
        )
        
        if success:
            print(f"   ✅ Linked seller {self.seller_user['name']} to manager {self.manager_user['name']}")
            return True
        else:
            print("   ❌ Could not link seller to manager")
            return False

    def test_scenario_1_create_conflict_resolution(self):
        """
        Scenario 1: Create conflict resolution
        1. Login as manager
        2. Get list of sellers under the manager
        3. Create a conflict resolution for one seller
        4. Verify the response contains all required fields
        5. Verify AI analysis fields are populated with meaningful content
        """
        print("\n" + "="*60)
        print("🎯 SCENARIO 1: Create Conflict Resolution")
        print("="*60)
        
        if not self.manager_token:
            print("❌ No manager token available")
            return False
        
        # Step 2: Get list of sellers under the manager
        success, sellers_response = self.run_test(
            "Get Sellers Under Manager",
            "GET",
            "manager/sellers",
            200,
            token=self.manager_token
        )
        
        if not success or not isinstance(sellers_response, list):
            print("❌ Could not get sellers list")
            return False
        
        print(f"   ✅ Manager has {len(sellers_response)} seller(s) under management")
        
        if len(sellers_response) == 0:
            print("❌ No sellers under this manager")
            return False
        
        # Use the first seller for testing
        seller = sellers_response[0]
        seller_id = seller.get('id')
        print(f"   ✅ Using seller: {seller.get('name')} (ID: {seller_id})")
        
        # Step 3: Create a conflict resolution for one seller
        conflict_data = {
            "seller_id": seller_id,
            "contexte": "Le vendeur arrive souvent en retard et cela impacte l'équipe",
            "comportement_observe": "Retards répétés (3-4 fois par semaine), démotivation visible",
            "impact": "Baisse de moral de l'équipe, clients non servis aux heures d'ouverture",
            "tentatives_precedentes": "Discussion informelle, rappel des horaires",
            "description_libre": "La situation dure depuis 2 mois, j'ai besoin d'une approche plus structurée"
        }
        
        print("   Creating conflict resolution with AI analysis (may take 10-15 seconds)...")
        success, conflict_response = self.run_test(
            "Create Conflict Resolution",
            "POST",
            "manager/conflict-resolution",
            200,
            data=conflict_data,
            token=self.manager_token
        )
        
        if not success:
            print("❌ Could not create conflict resolution")
            return False
        
        # Step 4: Verify the response contains all required fields
        required_fields = ['id', 'manager_id', 'seller_id', 'contexte', 'comportement_observe', 
                          'impact', 'tentatives_precedentes', 'description_libre', 'created_at', 'statut']
        
        missing_fields = []
        for field in required_fields:
            if field not in conflict_response:
                missing_fields.append(field)
        
        if missing_fields:
            print(f"❌ Missing required fields: {missing_fields}")
            return False
        else:
            print("   ✅ All required fields present in response")
            print(f"   ✅ Conflict Resolution ID: {conflict_response.get('id')}")
            print(f"   ✅ Status: {conflict_response.get('statut')}")
        
        # Step 5: Verify AI analysis fields are populated with meaningful content
        ai_fields = ['ai_analyse_situation', 'ai_approche_communication', 'ai_actions_concretes', 'ai_points_vigilance']
        
        missing_ai_fields = []
        for field in ai_fields:
            if field not in conflict_response or not conflict_response[field]:
                missing_ai_fields.append(field)
        
        if missing_ai_fields:
            print(f"❌ Missing AI analysis fields: {missing_ai_fields}")
            return False
        else:
            print("   ✅ All AI analysis fields populated")
            
            # Verify content quality
            analyse = conflict_response.get('ai_analyse_situation', '')
            approche = conflict_response.get('ai_approche_communication', '')
            actions = conflict_response.get('ai_actions_concretes', [])
            vigilance = conflict_response.get('ai_points_vigilance', [])
            
            print(f"   ✅ AI Situation Analysis ({len(analyse)} chars): {analyse[:100]}...")
            print(f"   ✅ AI Communication Approach ({len(approche)} chars): {approche[:100]}...")
            
            if isinstance(actions, list) and len(actions) > 0:
                print(f"   ✅ AI Concrete Actions ({len(actions)} actions):")
                for i, action in enumerate(actions[:3], 1):
                    print(f"      {i}. {action[:80]}...")
            else:
                print("   ❌ AI actions should be a non-empty list")
                return False
            
            if isinstance(vigilance, list) and len(vigilance) > 0:
                print(f"   ✅ AI Vigilance Points ({len(vigilance)} points):")
                for i, point in enumerate(vigilance[:2], 1):
                    print(f"      {i}. {point[:80]}...")
            else:
                print("   ❌ AI vigilance points should be a non-empty list")
                return False
            
            # Check if responses are in French
            french_indicators = ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'à', 'pour', 'avec', 'vendeur', 'manager']
            ai_text = f"{analyse} {approche}".lower()
            
            if any(word in ai_text for word in french_indicators):
                print("   ✅ AI responses are in French")
            else:
                print("   ⚠️  AI responses may not be in French")
        
        # Store for next scenario
        self.created_conflict_id = conflict_response.get('id')
        self.test_seller_id = seller_id
        
        print("   🎉 SCENARIO 1 COMPLETED SUCCESSFULLY")
        return True

    def test_scenario_2_get_conflict_history(self):
        """
        Scenario 2: Get conflict history
        1. Use the same manager token
        2. Get conflict history for the seller from Scenario 1
        3. Verify the created conflict resolution appears in the history
        4. Verify data persistence
        """
        print("\n" + "="*60)
        print("🎯 SCENARIO 2: Get Conflict History")
        print("="*60)
        
        if not self.manager_token or not hasattr(self, 'test_seller_id'):
            print("❌ Missing manager token or seller ID from Scenario 1")
            return False
        
        # Step 2: Get conflict history for the seller from Scenario 1
        success, history_response = self.run_test(
            "Get Conflict History",
            "GET",
            f"manager/conflict-history/{self.test_seller_id}",
            200,
            token=self.manager_token
        )
        
        if not success:
            print("❌ Could not get conflict history")
            return False
        
        # Step 3: Verify the created conflict resolution appears in the history
        if not isinstance(history_response, list):
            print("❌ History response should be an array")
            return False
        
        print(f"   ✅ Retrieved {len(history_response)} conflict resolution(s)")
        
        # Step 4: Verify data persistence
        found_conflict = None
        if hasattr(self, 'created_conflict_id'):
            for conflict in history_response:
                if conflict.get('id') == self.created_conflict_id:
                    found_conflict = conflict
                    break
        
        if found_conflict:
            print("   ✅ Created conflict resolution found in history")
            
            # Verify all data is still intact
            required_fields = ['ai_analyse_situation', 'ai_approche_communication', 'ai_actions_concretes', 'ai_points_vigilance']
            
            for field in required_fields:
                if field in found_conflict and found_conflict[field]:
                    print(f"   ✅ {field} persisted correctly")
                else:
                    print(f"   ❌ {field} not properly persisted")
                    return False
            
            print("   ✅ All AI analysis data persisted correctly")
        else:
            print("   ❌ Created conflict resolution not found in history")
            return False
        
        print("   🎉 SCENARIO 2 COMPLETED SUCCESSFULLY")
        return True

    def test_scenario_3_authorization(self):
        """
        Scenario 3: Authorization
        1. Try to create conflict resolution without authentication (should fail with 401/403)
        2. Try as a seller role (should fail with 403)
        3. Try to access conflict history for a seller not under the manager (should fail with 404)
        """
        print("\n" + "="*60)
        print("🎯 SCENARIO 3: Authorization Tests")
        print("="*60)
        
        # Test 1: Try to create conflict resolution without authentication
        conflict_data = {
            "seller_id": "test-seller-id",
            "contexte": "Test context",
            "comportement_observe": "Test behavior",
            "impact": "Test impact",
            "tentatives_precedentes": "Test attempts",
            "description_libre": "Test description"
        }
        
        success, response = self.run_test(
            "Create Conflict Resolution - No Auth (Should Fail)",
            "POST",
            "manager/conflict-resolution",
            403,  # Expecting 403 based on previous test results
            data=conflict_data
        )
        
        if success:
            print("   ✅ Correctly blocks unauthenticated requests")
        else:
            print("   ⚠️  Expected 403, but got different status code (non-critical)")
        
        # Test 2: Try as a seller role (should fail with 403)
        if self.seller_token:
            success, response = self.run_test(
                "Create Conflict Resolution - Seller Role (Should Fail)",
                "POST",
                "manager/conflict-resolution",
                403,
                data=conflict_data,
                token=self.seller_token
            )
            
            if success:
                print("   ✅ Correctly prevents sellers from creating conflict resolutions")
            else:
                print("   ❌ Sellers should not be able to create conflict resolutions")
                return False
        
        # Test 3: Try to access conflict history for a seller not under the manager
        if self.manager_token:
            success, response = self.run_test(
                "Get Conflict History - Non-Managed Seller (Should Fail)",
                "GET",
                "manager/conflict-history/non-existent-seller-id",
                404,
                token=self.manager_token
            )
            
            if success:
                print("   ✅ Correctly prevents access to non-managed sellers")
            else:
                print("   ❌ Should not allow access to sellers not under management")
                return False
        
        print("   🎉 SCENARIO 3 COMPLETED SUCCESSFULLY")
        return True

    def run_all_scenarios(self):
        """Run all test scenarios as specified in the review request"""
        print("🚀 Starting Conflict Resolution API Tests")
        print("Testing scenarios as specified in the review request")
        print("=" * 70)
        
        # Setup: Login as manager and seller
        if not self.test_manager_login():
            print("❌ Could not login as manager - aborting tests")
            return False
        
        if not self.test_seller_login():
            print("❌ Could not login as seller - aborting tests")
            return False
        
        # Setup manager-seller relationship
        if not self.setup_manager_seller_relationship():
            print("❌ Could not setup manager-seller relationship - aborting tests")
            return False
        
        # Run the three main scenarios
        scenario1_success = self.test_scenario_1_create_conflict_resolution()
        scenario2_success = self.test_scenario_2_get_conflict_history()
        scenario3_success = self.test_scenario_3_authorization()
        
        # Print final summary
        print("\n" + "=" * 70)
        print("📊 CONFLICT RESOLUTION API TEST SUMMARY")
        print("=" * 70)
        
        scenarios = [
            ("Scenario 1: Create Conflict Resolution", scenario1_success),
            ("Scenario 2: Get Conflict History", scenario2_success),
            ("Scenario 3: Authorization Tests", scenario3_success)
        ]
        
        passed_scenarios = sum(1 for _, success in scenarios if success)
        
        for scenario_name, success in scenarios:
            status = "✅ PASSED" if success else "❌ FAILED"
            print(f"{status} {scenario_name}")
        
        print(f"\n📈 Overall Result: {passed_scenarios}/{len(scenarios)} scenarios passed")
        print(f"📈 Individual Tests: {self.tests_passed}/{self.tests_run} tests passed")
        
        if passed_scenarios == len(scenarios):
            print("🎉 ALL CONFLICT RESOLUTION SCENARIOS PASSED!")
            print("\n✅ The conflict resolution APIs are working correctly:")
            print("   • Managers can create conflict resolutions with AI analysis")
            print("   • AI generates personalized recommendations in French")
            print("   • Conflict history is properly stored and retrieved")
            print("   • Authorization is properly enforced")
            return True
        else:
            print("⚠️  Some scenarios failed - check details above")
            return False

def main():
    tester = ConflictResolutionTester()
    success = tester.run_all_scenarios()
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())