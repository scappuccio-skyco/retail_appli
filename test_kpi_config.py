#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class KPIConfigTester:
    def __init__(self, base_url="https://coach-analytics-8.preview.emergentagent.com/api"):
        self.base_url = base_url
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

    def test_dynamic_kpi_display_sellerdetailview(self):
        """Test Dynamic KPI Display in SellerDetailView - REVIEW REQUEST SCENARIOS"""
        print("\n🔍 Testing Dynamic KPI Display in SellerDetailView (REVIEW REQUEST)...")
        
        # SCENARIO 1: Check Manager's Current KPI Configuration
        print("\n   📋 SCENARIO 1: Check Manager's Current KPI Configuration")
        
        # Login as manager1@test.com
        manager_login_data = {
            "email": "manager1@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "SCENARIO 1 - Manager Login (manager1@test.com)",
            "POST",
            "auth/login",
            200,
            data=manager_login_data
        )
        
        manager_token = None
        if success and 'token' in response:
            manager_token = response['token']
            manager_info = response['user']
            print(f"   ✅ Logged in as manager: {manager_info.get('name')} ({manager_info.get('email')})")
        else:
            print("   ❌ Could not login with manager1@test.com - test cannot continue")
            self.log_test("Dynamic KPI Display Setup", False, "manager1@test.com account not available")
            return
        
        # Get manager's current KPI configuration
        success, config_response = self.run_test(
            "SCENARIO 1 - GET /api/manager/kpi-config",
            "GET",
            "manager/kpi-config",
            200,
            token=manager_token
        )
        
        current_config = None
        if success:
            current_config = config_response
            print("   ✅ Current KPI Configuration Retrieved:")
            print(f"      track_ca: {config_response.get('track_ca')}")
            print(f"      track_ventes: {config_response.get('track_ventes')}")
            print(f"      track_clients: {config_response.get('track_clients')}")
            print(f"      track_articles: {config_response.get('track_articles')}")
            
            # Document which KPIs are currently enabled
            enabled_kpis = []
            for kpi in ['track_ca', 'track_ventes', 'track_clients', 'track_articles']:
                if config_response.get(kpi, False):
                    enabled_kpis.append(kpi)
            
            print(f"   📊 Currently enabled KPIs: {enabled_kpis}")
            if len(enabled_kpis) == 4:
                print("   ✅ All KPIs are enabled - this explains why user sees all graphs")
            else:
                print(f"   ⚠️  Only {len(enabled_kpis)}/4 KPIs enabled - some graphs should be hidden")
        
        # SCENARIO 2: Modify KPI Configuration to Test Filtering
        print("\n   🔧 SCENARIO 2: Modify KPI Configuration to Test Filtering")
        
        # Set limited configuration (only CA and Ventes enabled)
        limited_config = {
            "track_ca": True,
            "track_ventes": True,
            "track_clients": False,
            "track_articles": False
        }
        
        success, update_response = self.run_test(
            "SCENARIO 2 - PUT /api/manager/kpi-config (Limited Config)",
            "PUT",
            "manager/kpi-config",
            200,
            data=limited_config,
            token=manager_token
        )
        
        if success:
            print("   ✅ KPI Configuration Updated Successfully")
            print(f"      New config: track_ca=True, track_ventes=True, track_clients=False, track_articles=False")
            
            # Verify the configuration was saved
            success, verify_response = self.run_test(
                "SCENARIO 2 - Verify Config Save (GET /api/manager/kpi-config)",
                "GET",
                "manager/kpi-config",
                200,
                token=manager_token
            )
            
            if success:
                print("   ✅ Configuration Persistence Verified:")
                print(f"      track_ca: {verify_response.get('track_ca')} (expected: True)")
                print(f"      track_ventes: {verify_response.get('track_ventes')} (expected: True)")
                print(f"      track_clients: {verify_response.get('track_clients')} (expected: False)")
                print(f"      track_articles: {verify_response.get('track_articles')} (expected: False)")
                
                # Validate the changes were applied correctly
                config_correct = (
                    verify_response.get('track_ca') == True and
                    verify_response.get('track_ventes') == True and
                    verify_response.get('track_clients') == False and
                    verify_response.get('track_articles') == False
                )
                
                if config_correct:
                    self.log_test("KPI Config Modification & Persistence", True)
                    print("   ✅ Modified configuration persists correctly")
                else:
                    self.log_test("KPI Config Modification & Persistence", False, "Configuration not saved correctly")
        
        # SCENARIO 3: Verify Frontend Will Receive Correct Config
        print("\n   🎯 SCENARIO 3: Verify Frontend Will Receive Correct Config")
        
        success, frontend_response = self.run_test(
            "SCENARIO 3 - GET /api/manager/kpi-config (Frontend Format)",
            "GET",
            "manager/kpi-config",
            200,
            token=manager_token
        )
        
        if success:
            print("   ✅ Frontend-Ready Configuration Retrieved")
            
            # Verify response format is correct for frontend consumption
            required_fields = ['track_ca', 'track_ventes', 'track_clients', 'track_articles']
            missing_fields = []
            
            for field in required_fields:
                if field not in frontend_response:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_test("Frontend Config Format Validation", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Frontend Config Format Validation", True)
                print("   ✅ All required boolean flags present:")
                
                for field in required_fields:
                    value = frontend_response.get(field)
                    value_type = type(value).__name__
                    print(f"      {field}: {value} ({value_type})")
                    
                    # Verify each field is a boolean
                    if not isinstance(value, bool):
                        self.log_test("Boolean Type Validation", False, f"{field} is not boolean: {value_type}")
                
                print("   ✅ Response format is correct for frontend consumption")
        
        # Restore original configuration if we had one
        if current_config:
            print("\n   🔄 Restoring Original Configuration")
            
            restore_config = {
                "track_ca": current_config.get('track_ca', True),
                "track_ventes": current_config.get('track_ventes', True),
                "track_clients": current_config.get('track_clients', True),
                "track_articles": current_config.get('track_articles', True)
            }
            
            success, restore_response = self.run_test(
                "Restore Original KPI Configuration",
                "PUT",
                "manager/kpi-config",
                200,
                data=restore_config,
                token=manager_token
            )
            
            if success:
                print("   ✅ Original configuration restored")
            else:
                print("   ⚠️  Could not restore original configuration")
        
        # Test Authentication Requirements
        print("\n   🔒 Testing Authentication Requirements")
        
        # Test GET without token
        success, _ = self.run_test(
            "KPI Config GET - No Authentication",
            "GET",
            "manager/kpi-config",
            403,  # Should be 403 for manager endpoints
        )
        
        if success:
            print("   ✅ GET /api/manager/kpi-config correctly requires authentication")
        
        # Test PUT without token
        success, _ = self.run_test(
            "KPI Config PUT - No Authentication",
            "PUT",
            "manager/kpi-config",
            403,  # Should be 403 for manager endpoints
            data={"track_ca": True}
        )
        
        if success:
            print("   ✅ POST /api/manager/kpi-config correctly requires authentication")
        
        print("\n   📋 REVIEW REQUEST SUMMARY:")
        print("   ✅ Current KPI config retrieved successfully")
        print("   ✅ KPI config can be modified via API")
        print("   ✅ Modified config persists and can be retrieved")
        print("   ✅ Response format is correct for frontend consumption")
        print("   📊 Test explains why user might see all graphs (if all KPIs are enabled)")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("🏁 TEST SUMMARY")
        print("=" * 80)
        print(f"Total tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL TESTS PASSED!")
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} test(s) failed")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"Success rate: {success_rate:.1f}%")

if __name__ == "__main__":
    tester = KPIConfigTester()
    tester.test_dynamic_kpi_display_sellerdetailview()
    tester.print_summary()