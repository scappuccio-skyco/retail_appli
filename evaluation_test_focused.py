#!/usr/bin/env python3
"""
Focused Evaluation Generator Test
Tests the new evaluation feature with proper store relationships
"""
import requests
import json
import sys

class EvaluationFocusedTester:
    def __init__(self):
        self.base_url = "https://review-helper-8.preview.emergentagent.com/api"
        self.manager_token = None
        self.seller_token = None
        self.manager_user = None
        self.seller_user = None
        self.manager_store_seller_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name}: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def test_authentication(self):
        """Test authentication and get proper seller from manager's store"""
        print("\n🔐 AUTHENTICATION & SETUP")
        
        # Login as Manager
        manager_data = {"email": "y.legoff@skyco.fr", "password": "TestDemo123!"}
        response = requests.post(f"{self.base_url}/auth/login", json=manager_data, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            self.manager_token = data['token']
            self.manager_user = data['user']
            self.log_test("Manager Authentication", True)
            print(f"   Manager: {self.manager_user.get('email')} (Store: {self.manager_user.get('store_id')})")
        else:
            self.log_test("Manager Authentication", False, f"Status {response.status_code}")
            return False
        
        # Get sellers from manager's store
        headers = {'Authorization': f'Bearer {self.manager_token}'}
        response = requests.get(f"{self.base_url}/manager/sellers", headers=headers, timeout=30)
        
        if response.status_code == 200:
            sellers = response.json()
            if sellers:
                self.manager_store_seller_id = sellers[0]['id']
                seller_name = sellers[0]['name']
                self.log_test("Get Manager Store Sellers", True)
                print(f"   Using seller: {seller_name} ({self.manager_store_seller_id})")
            else:
                self.log_test("Get Manager Store Sellers", False, "No sellers found")
                return False
        else:
            self.log_test("Get Manager Store Sellers", False, f"Status {response.status_code}")
            return False
        
        # Login as Seller (Emma Petit for self-evaluation)
        seller_data = {"email": "emma.petit@test.com", "password": "TestDemo123!"}
        response = requests.post(f"{self.base_url}/auth/login", json=seller_data, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            self.seller_token = data['token']
            self.seller_user = data['user']
            self.log_test("Seller Authentication", True)
            print(f"   Seller: {self.seller_user.get('email')} (Store: {self.seller_user.get('store_id')})")
        else:
            self.log_test("Seller Authentication", False, f"Status {response.status_code}")
            return False
        
        return True

    def test_manager_evaluation_generation(self):
        """Test evaluation generation from Manager perspective"""
        print("\n👔 MANAGER EVALUATION GENERATION")
        
        if not self.manager_token or not self.manager_store_seller_id:
            self.log_test("Manager Evaluation Setup", False, "Missing manager token or seller ID")
            return
        
        # Generate evaluation for seller in manager's store
        evaluation_data = {
            "employee_id": self.manager_store_seller_id,
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        headers = {'Authorization': f'Bearer {self.manager_token}', 'Content-Type': 'application/json'}
        response = requests.post(f"{self.base_url}/evaluations/generate", json=evaluation_data, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            self.log_test("Manager Generate Evaluation", True)
            
            # Verify response structure
            required_fields = ['employee_id', 'employee_name', 'role_perspective', 'guide_content', 'stats_summary']
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                self.log_test("Manager Evaluation Response Structure", False, f"Missing: {missing_fields}")
            else:
                self.log_test("Manager Evaluation Response Structure", True)
                print(f"   Employee: {data.get('employee_name')}")
                print(f"   Role perspective: {data.get('role_perspective')}")
                print(f"   Guide length: {len(data.get('guide_content', ''))} chars")
                
                # Verify role perspective is 'manager'
                if data.get('role_perspective') == 'manager':
                    self.log_test("Manager Role Perspective Correct", True)
                else:
                    self.log_test("Manager Role Perspective Correct", False, f"Got '{data.get('role_perspective')}'")
                
                # Check for manager-specific content
                guide_content = data.get('guide_content', '').lower()
                manager_keywords = ['analyse factuelle', 'soft skills', 'questions de coaching', 'objectifs']
                found_keywords = [kw for kw in manager_keywords if kw in guide_content]
                
                if len(found_keywords) >= 2:
                    self.log_test("Manager-Specific Content", True)
                    print(f"   Manager keywords found: {found_keywords}")
                else:
                    self.log_test("Manager-Specific Content", False, f"Only found: {found_keywords}")
        else:
            error_detail = ""
            try:
                error_detail = response.json().get('detail', '')
            except:
                error_detail = response.text[:200]
            self.log_test("Manager Generate Evaluation", False, f"Status {response.status_code}: {error_detail}")

    def test_seller_evaluation_generation(self):
        """Test evaluation generation from Seller perspective"""
        print("\n👤 SELLER EVALUATION GENERATION")
        
        if not self.seller_token or not self.seller_user:
            self.log_test("Seller Evaluation Setup", False, "Missing seller token or user data")
            return
        
        # Generate evaluation for self
        evaluation_data = {
            "employee_id": self.seller_user.get('id'),
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        headers = {'Authorization': f'Bearer {self.seller_token}', 'Content-Type': 'application/json'}
        response = requests.post(f"{self.base_url}/evaluations/generate", json=evaluation_data, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            self.log_test("Seller Generate Own Evaluation", True)
            
            # Verify response structure
            required_fields = ['employee_id', 'employee_name', 'role_perspective', 'guide_content', 'stats_summary']
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                self.log_test("Seller Evaluation Response Structure", False, f"Missing: {missing_fields}")
            else:
                self.log_test("Seller Evaluation Response Structure", True)
                print(f"   Employee: {data.get('employee_name')}")
                print(f"   Role perspective: {data.get('role_perspective')}")
                print(f"   Guide length: {len(data.get('guide_content', ''))} chars")
                
                # Verify role perspective is 'seller'
                if data.get('role_perspective') == 'seller':
                    self.log_test("Seller Role Perspective Correct", True)
                else:
                    self.log_test("Seller Role Perspective Correct", False, f"Got '{data.get('role_perspective')}'")
                
                # Check for seller-specific content
                guide_content = data.get('guide_content', '').lower()
                seller_keywords = ['mes victoires', 'mes axes', 'mes souhaits', 'mes questions']
                found_keywords = [kw for kw in seller_keywords if kw in guide_content]
                
                if len(found_keywords) >= 2:
                    self.log_test("Seller-Specific Content", True)
                    print(f"   Seller keywords found: {found_keywords}")
                else:
                    self.log_test("Seller-Specific Content", False, f"Only found: {found_keywords}")
        else:
            error_detail = ""
            try:
                error_detail = response.json().get('detail', '')
            except:
                error_detail = response.text[:200]
            self.log_test("Seller Generate Own Evaluation", False, f"Status {response.status_code}: {error_detail}")

    def test_evaluation_stats_endpoint(self):
        """Test evaluation stats endpoint"""
        print("\n📊 EVALUATION STATS ENDPOINT")
        
        if not self.manager_token or not self.manager_store_seller_id:
            self.log_test("Stats Endpoint Setup", False, "Missing manager token or seller ID")
            return
        
        # Get stats for seller in manager's store
        headers = {'Authorization': f'Bearer {self.manager_token}'}
        url = f"{self.base_url}/evaluations/stats/{self.manager_store_seller_id}?start_date=2024-01-01&end_date=2024-12-31"
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            self.log_test("Manager Get Evaluation Stats", True)
            
            # Verify response structure
            required_fields = ['employee_id', 'employee_name', 'stats']
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                self.log_test("Stats Response Structure", False, f"Missing: {missing_fields}")
            else:
                self.log_test("Stats Response Structure", True)
                stats = data.get('stats', {})
                print(f"   Employee: {data.get('employee_name')}")
                print(f"   Total CA: {stats.get('total_ca', 0)}€")
                print(f"   Days worked: {stats.get('days_worked', 0)}")
                print(f"   Total ventes: {stats.get('total_ventes', 0)}")
        else:
            error_detail = ""
            try:
                error_detail = response.json().get('detail', '')
            except:
                error_detail = response.text[:200]
            self.log_test("Manager Get Evaluation Stats", False, f"Status {response.status_code}: {error_detail}")

    def test_security_access_control(self):
        """Test security and access control"""
        print("\n🔒 SECURITY & ACCESS CONTROL")
        
        # Test 1: Unauthenticated access
        evaluation_data = {
            "employee_id": "test-id",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        response = requests.post(f"{self.base_url}/evaluations/generate", json=evaluation_data, timeout=30)
        
        if response.status_code == 403:
            self.log_test("Unauthenticated Access Blocked", True)
        else:
            self.log_test("Unauthenticated Access Blocked", False, f"Got status {response.status_code}")
        
        # Test 2: Seller trying to access another seller's evaluation
        if self.seller_token and self.manager_store_seller_id and self.seller_user.get('id') != self.manager_store_seller_id:
            evaluation_data = {
                "employee_id": self.manager_store_seller_id,
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            }
            
            headers = {'Authorization': f'Bearer {self.seller_token}', 'Content-Type': 'application/json'}
            response = requests.post(f"{self.base_url}/evaluations/generate", json=evaluation_data, headers=headers, timeout=30)
            
            if response.status_code == 403:
                self.log_test("Cross-Seller Access Blocked", True)
            else:
                self.log_test("Cross-Seller Access Blocked", False, f"Got status {response.status_code}")

    def run_all_tests(self):
        """Run all evaluation tests"""
        print("🎯 EVALUATION GENERATOR FOCUSED TESTING")
        print("=" * 60)
        
        # Setup authentication and relationships
        if not self.test_authentication():
            print("❌ Authentication failed - cannot continue")
            return False
        
        # Test core functionality
        self.test_manager_evaluation_generation()
        self.test_seller_evaluation_generation()
        self.test_evaluation_stats_endpoint()
        self.test_security_access_control()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
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
        
        success_rate = self.tests_passed / self.tests_run if self.tests_run > 0 else 0
        return success_rate >= 0.8  # 80% pass rate

if __name__ == "__main__":
    tester = EvaluationFocusedTester()
    success = tester.run_all_tests()
    
    print(f"\n🏁 RESULT: {'✅ SUCCESS' if success else '❌ FAILURE'}")
    sys.exit(0 if success else 1)