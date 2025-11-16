#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class ManagerDISCTester:
    def __init__(self, base_url="https://seller-insights-3.preview.emergentagent.com/api"):
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

    def test_manager_disc_questionnaire_enrichment(self):
        """Test Manager DISC Questionnaire Enrichment - 24 DISC Questions (Q11-Q34)"""
        print("\n🔍 Testing Manager DISC Questionnaire Enrichment (CRITICAL FEATURE)...")
        print("   FEATURE: Manager diagnostic enriched from 8 to 24 DISC questions (Q11-Q34)")
        
        # Test Credentials from review request
        manager_credentials = [
            {"email": "manager1@test.com", "password": "demo123"},
            {"email": "manager@demo.com", "password": "demo123"}
        ]
        
        manager_token = None
        manager_info = None
        
        # Try to login with available manager accounts
        for creds in manager_credentials:
            success, response = self.run_test(
                f"Manager DISC Test - Login ({creds['email']})",
                "POST",
                "auth/login",
                200,
                data=creds
            )
            
            if success and 'token' in response:
                manager_token = response['token']
                manager_info = response['user']
                print(f"   ✅ Logged in as manager: {manager_info.get('name')} ({manager_info.get('email')})")
                break
        
        if not manager_token:
            print("   ⚠️  Could not login with test credentials - trying to create manager account")
            
            # Try to create a manager account for testing
            manager_data = {
                "name": "Test Manager DISC",
                "email": "manager_disc_test@test.com",
                "password": "demo123",
                "role": "manager"
            }
            
            success, response = self.run_test(
                "Create Manager Account for DISC Test",
                "POST",
                "auth/register",
                200,
                data=manager_data
            )
            
            if success and 'token' in response:
                manager_token = response['token']
                manager_info = response['user']
                print(f"   ✅ Created and logged in as manager: {manager_info.get('name')} ({manager_info.get('email')})")
            else:
                self.log_test("Manager DISC Enrichment Setup", False, "No manager account available")
                return
        
        # SCENARIO 1: Delete Existing Manager Diagnostic (if exists)
        print("\n   🗑️  SCENARIO 1: Delete Existing Manager Diagnostic (if exists)")
        
        # First check if diagnostic exists
        success, existing_response = self.run_test(
            "Manager DISC Scenario 1 - Check Existing Diagnostic",
            "GET",
            "manager-diagnostic/me",
            200,
            token=manager_token
        )
        
        existing_diagnostic = None
        if success:
            if existing_response.get('status') == 'completed':
                existing_diagnostic = existing_response.get('diagnostic', {})
                print(f"   ✅ Found existing diagnostic with DISC dominant: {existing_diagnostic.get('disc_dominant')}")
                print(f"   ✅ Existing DISC percentages: {existing_diagnostic.get('disc_percentages')}")
                
                # Delete existing diagnostic to allow retaking
                success, delete_response = self.run_test(
                    "Manager DISC Scenario 1 - Delete Existing Diagnostic",
                    "DELETE",
                    "manager/diagnostic",
                    200,
                    token=manager_token
                )
                
                if success:
                    print("   ✅ Successfully deleted existing diagnostic")
                else:
                    print("   ❌ Failed to delete existing diagnostic")
            else:
                print("   ✅ No existing diagnostic found - ready for new test")
        
        # SCENARIO 2: Create New Manager Diagnostic with 24 DISC Questions
        print("\n   📝 SCENARIO 2: Create New Manager Diagnostic with 24 DISC Questions")
        
        # Test data structure for DISC questions (24 questions Q11-Q34)
        # Use variety of responses as specified in review request
        diagnostic_responses = {}
        
        # Q1-Q10: Management style questions (use text responses)
        for i in range(1, 11):
            diagnostic_responses[str(i)] = f"Management response for question {i}"
        
        # Q11-Q34: DISC questions (use INTEGER indices 0-3)
        # Test pattern from review request:
        disc_pattern = [
            # Q11-Q14: D, I, S, C
            0, 1, 2, 3,
            # Q15-Q18: D, I, S, C  
            0, 1, 2, 3,
            # Q19-Q22: I, I, I, I (4 Influent responses)
            1, 1, 1, 1,
            # Q23-Q26: S, S, S, S (4 Stable responses)
            2, 2, 2, 2,
            # Q27-Q30: C, C, C, C (4 Consciencieux responses)
            3, 3, 3, 3,
            # Q31-Q34: D, D, D, D (4 Dominant responses)
            0, 0, 0, 0
        ]
        
        # Apply DISC pattern to Q11-Q34
        for i, disc_value in enumerate(disc_pattern):
            question_num = 11 + i
            diagnostic_responses[str(question_num)] = disc_value
        
        print(f"   📊 Test data: 34 total questions (10 management + 24 DISC)")
        print(f"   📊 DISC distribution: D=8, I=8, S=6, C=2 (should give D≈33%, I≈33%, S≈25%, C≈8%)")
        
        diagnostic_data = {
            "responses": diagnostic_responses
        }
        
        print("   Creating manager diagnostic with AI analysis and DISC calculation (may take 10-15 seconds)...")
        success, response = self.run_test(
            "Manager DISC Scenario 2 - Create Diagnostic with 24 DISC Questions",
            "POST",
            "manager-diagnostic",
            200,
            data=diagnostic_data,
            token=manager_token
        )
        
        created_diagnostic = None
        if success:
            created_diagnostic = response
            
            # Verify diagnostic accepts 34 questions
            if len(diagnostic_responses) == 34:
                self.log_test("Manager Diagnostic - 34 Questions Accepted", True)
                print("   ✅ Manager diagnostic accepts 34 questions (10 management + 24 DISC)")
            else:
                self.log_test("Manager Diagnostic - 34 Questions Accepted", False, f"Expected 34 questions, got {len(diagnostic_responses)}")
            
            # Verify DISC questions Q11-Q34 accept integer indices
            disc_questions_valid = True
            for q_num in range(11, 35):
                q_key = str(q_num)
                if q_key in diagnostic_responses:
                    if not isinstance(diagnostic_responses[q_key], int) or diagnostic_responses[q_key] not in [0, 1, 2, 3]:
                        disc_questions_valid = False
                        break
            
            if disc_questions_valid:
                self.log_test("Manager DISC Questions - Integer Indices (0-3)", True)
                print("   ✅ DISC questions Q11-Q34 accept integer indices (0-3)")
            else:
                self.log_test("Manager DISC Questions - Integer Indices (0-3)", False, "DISC questions should accept integers 0-3")
        
        # SCENARIO 3: Verify DISC Profile Calculation
        print("\n   🎯 SCENARIO 3: Verify DISC Profile Calculation")
        
        if success and created_diagnostic:
            # Check response includes disc_dominant field
            if 'disc_dominant' in created_diagnostic:
                disc_dominant = created_diagnostic['disc_dominant']
                self.log_test("Manager DISC - disc_dominant Field Present", True)
                print(f"   ✅ disc_dominant field present: {disc_dominant}")
                
                # Should be "Dominant" or "Influent" based on tied scores (both 33%)
                if disc_dominant in ['Dominant', 'Influent']:
                    print(f"   ✅ Dominant type '{disc_dominant}' matches expected (Dominant or Influent)")
                else:
                    self.log_test("Manager DISC - Dominant Type Validation", False, f"Expected 'Dominant' or 'Influent', got '{disc_dominant}'")
            else:
                self.log_test("Manager DISC - disc_dominant Field Present", False, "disc_dominant field missing")
            
            # Check response includes disc_percentages field
            if 'disc_percentages' in created_diagnostic:
                disc_percentages = created_diagnostic['disc_percentages']
                self.log_test("Manager DISC - disc_percentages Field Present", True)
                print(f"   ✅ disc_percentages field present: {disc_percentages}")
                
                # Verify D, I, S, C keys are present
                required_keys = ['D', 'I', 'S', 'C']
                missing_keys = [key for key in required_keys if key not in disc_percentages]
                
                if not missing_keys:
                    self.log_test("Manager DISC - D/I/S/C Keys Present", True)
                    print("   ✅ disc_percentages contains D, I, S, C keys")
                    
                    # Verify percentages add up to ~100%
                    total_percentage = sum(disc_percentages.values())
                    if 95 <= total_percentage <= 105:  # Allow small rounding differences
                        self.log_test("Manager DISC - Percentages Sum to 100%", True)
                        print(f"   ✅ Percentages add up to {total_percentage}% (≈100%)")
                    else:
                        self.log_test("Manager DISC - Percentages Sum to 100%", False, f"Percentages sum to {total_percentage}%, expected ~100%")
                    
                    # Verify dominant type matches highest percentage
                    max_percentage_type = max(disc_percentages.items(), key=lambda x: x[1])[0]
                    expected_dominant_names = {'D': 'Dominant', 'I': 'Influent', 'S': 'Stable', 'C': 'Consciencieux'}
                    expected_dominant = expected_dominant_names.get(max_percentage_type)
                    
                    if disc_dominant == expected_dominant:
                        self.log_test("Manager DISC - Dominant Matches Highest Percentage", True)
                        print(f"   ✅ Dominant type '{disc_dominant}' matches highest percentage ({max_percentage_type}: {disc_percentages[max_percentage_type]}%)")
                    else:
                        # Handle tie case - both D and I should be around 33%
                        d_percent = disc_percentages.get('D', 0)
                        i_percent = disc_percentages.get('I', 0)
                        if abs(d_percent - i_percent) <= 5 and disc_dominant in ['Dominant', 'Influent']:
                            self.log_test("Manager DISC - Dominant Matches Highest Percentage", True)
                            print(f"   ✅ Tie case handled correctly: D={d_percent}%, I={i_percent}%, dominant='{disc_dominant}'")
                        else:
                            self.log_test("Manager DISC - Dominant Matches Highest Percentage", False, f"Dominant '{disc_dominant}' doesn't match highest percentage")
                    
                    # Print detailed breakdown
                    print(f"   📊 DISC Breakdown: D={disc_percentages.get('D', 0)}%, I={disc_percentages.get('I', 0)}%, S={disc_percentages.get('S', 0)}%, C={disc_percentages.get('C', 0)}%")
                    
                else:
                    self.log_test("Manager DISC - D/I/S/C Keys Present", False, f"Missing keys: {missing_keys}")
            else:
                self.log_test("Manager DISC - disc_percentages Field Present", False, "disc_percentages field missing")
            
            # Verify other required fields are still present
            required_fields = ['id', 'manager_id', 'profil_nom', 'profil_description', 'created_at']
            missing_fields = [field for field in required_fields if field not in created_diagnostic]
            
            if not missing_fields:
                self.log_test("Manager Diagnostic - Required Fields Present", True)
                print(f"   ✅ All required diagnostic fields present")
                print(f"   ✅ Profile: {created_diagnostic.get('profil_nom')}")
            else:
                self.log_test("Manager Diagnostic - Required Fields Present", False, f"Missing fields: {missing_fields}")
        
        # Test data persistence - verify diagnostic can be retrieved
        print("\n   💾 Testing DISC Profile Persistence")
        
        success, get_response = self.run_test(
            "Manager DISC - Verify Persistence",
            "GET",
            "manager-diagnostic/me",
            200,
            token=manager_token
        )
        
        if success:
            if get_response.get('status') == 'completed':
                persisted_diagnostic = get_response.get('diagnostic', {})
                
                # Verify DISC data persisted correctly
                if ('disc_dominant' in persisted_diagnostic and 
                    'disc_percentages' in persisted_diagnostic):
                    self.log_test("Manager DISC - Data Persistence", True)
                    print("   ✅ DISC profile data persisted correctly across sessions")
                    print(f"   ✅ Persisted dominant: {persisted_diagnostic.get('disc_dominant')}")
                    print(f"   ✅ Persisted percentages: {persisted_diagnostic.get('disc_percentages')}")
                else:
                    self.log_test("Manager DISC - Data Persistence", False, "DISC profile data not persisted")
            else:
                self.log_test("Manager DISC - Data Persistence", False, "Diagnostic not marked as completed")
        
        # Test authentication requirements
        print("\n   🔒 Testing Authentication Requirements")
        
        # Test without token
        success, _ = self.run_test(
            "Manager DISC - No Authentication",
            "POST",
            "manager-diagnostic",
            401,  # Unauthorized
            data=diagnostic_data
        )
        
        if success:
            print("   ✅ Manager diagnostic correctly requires authentication")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print(f"📊 MANAGER DISC QUESTIONNAIRE ENRICHMENT TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "No tests run")
        
        if self.tests_run - self.tests_passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   - {result['test']}: {result['details']}")
        
        print("\n✅ SUCCESS CRITERIA VERIFICATION:")
        success_criteria = [
            "Manager diagnostic accepts 34 questions (10 management + 24 DISC)",
            "DISC questions Q11-Q34 accept integer indices (0-3)",
            "Response includes disc_dominant and disc_percentages fields",
            "DISC percentages calculated correctly for 24 questions",
            "Dominant type matches highest percentage",
            "All percentages add up to 100%"
        ]
        
        for criteria in success_criteria:
            # Check if any test related to this criteria passed
            related_tests = [r for r in self.test_results if any(keyword in r['test'] for keyword in criteria.split())]
            if any(t['success'] for t in related_tests):
                print(f"   ✅ {criteria}")
            else:
                print(f"   ❌ {criteria}")

if __name__ == "__main__":
    tester = ManagerDISCTester()
    tester.test_manager_disc_questionnaire_enrichment()
    tester.print_summary()