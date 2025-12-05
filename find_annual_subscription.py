#!/usr/bin/env python3
"""
Find a manager account with annual subscription to test the downgrade blocking.
"""

import requests
import json

def test_manager_accounts():
    base_url = "https://dashview-enhance.preview.emergentagent.com/api"
    
    # List of potential manager accounts to test
    manager_accounts = [
        {"email": "Manager12@test.com", "password": "demo123"},
        {"email": "manager@demo.com", "password": "demo123"},
        {"email": "manager1@test.com", "password": "password123"},
        {"email": "manager2@test.com", "password": "password123"},
    ]
    
    annual_price_id = "price_1SSyK4IVM4C8dIGveBYOSf1m"
    
    for account in manager_accounts:
        print(f"\n🔍 Testing {account['email']}...")
        
        # Try to login
        login_response = requests.post(f"{base_url}/auth/login", json=account)
        
        if login_response.status_code != 200:
            print(f"   ❌ Login failed")
            continue
            
        token = login_response.json()['token']
        user = login_response.json()['user']
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        
        print(f"   ✅ Login successful: {user.get('name')}")
        
        # Get subscription status
        status_response = requests.get(f"{base_url}/subscription/status", headers=headers)
        
        if status_response.status_code == 200:
            status_data = status_response.json()
            subscription = status_data.get('subscription', {})
            workspace = status_data.get('workspace', {})
            
            billing_interval = subscription.get('billing_interval')
            stripe_price_id = workspace.get('stripe_price_id')
            
            print(f"   📊 Billing: {billing_interval}")
            print(f"   💳 Price ID: {stripe_price_id}")
            
            if stripe_price_id == annual_price_id:
                print(f"   🎯 FOUND ANNUAL SUBSCRIPTION!")
                print(f"   Account: {account['email']}")
                print(f"   Manager: {user.get('name')}")
                print(f"   This account can be used to test annual->monthly downgrade blocking")
                
                # Test the downgrade blocking
                print(f"\n   🧪 Testing downgrade blocking...")
                checkout_data = {
                    "plan": "professional",
                    "quantity": 8,
                    "billing_period": "monthly",
                    "origin_url": "https://dashview-enhance.preview.emergentagent.com/dashboard"
                }
                
                downgrade_response = requests.post(f"{base_url}/checkout/create-session",
                                                 json=checkout_data, headers=headers)
                
                print(f"   Response Status: {downgrade_response.status_code}")
                
                if downgrade_response.status_code == 400:
                    error_data = downgrade_response.json()
                    error_message = error_data.get('detail', '')
                    print(f"   ✅ BLOCKING WORKS! Error: {error_message}")
                    
                    if "Impossible de passer d'un abonnement annuel à mensuel" in error_message:
                        print(f"   ✅ Correct French error message!")
                        return True
                    else:
                        print(f"   ⚠️  Wrong error message")
                else:
                    print(f"   ❌ Expected 400, got {downgrade_response.status_code}")
                    try:
                        print(f"   Response: {downgrade_response.json()}")
                    except:
                        print(f"   Response text: {downgrade_response.text}")
                
                return False
            else:
                print(f"   ℹ️  Not annual (price_id: {stripe_price_id})")
        else:
            print(f"   ❌ Could not get subscription status")
    
    print(f"\n❌ No manager accounts found with annual subscriptions")
    print(f"   Annual price ID to look for: {annual_price_id}")
    return False

if __name__ == "__main__":
    test_manager_accounts()