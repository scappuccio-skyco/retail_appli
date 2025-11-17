#!/usr/bin/env python3
"""
Test the annual to monthly downgrade blocking scenario.
Since Manager12@test.com currently has monthly billing, we need to:
1. First understand the current state
2. Test the blocking logic with proper request format
"""

import requests
import json
import sys

def test_downgrade_blocking():
    base_url = "https://sale-insights.preview.emergentagent.com/api"
    
    # Login
    print("🔐 Logging in as Manager12@test.com...")
    login_response = requests.post(f"{base_url}/auth/login", json={
        "email": "Manager12@test.com",
        "password": "demo123"
    })
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return False
    
    token = login_response.json()['token']
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    # Get current subscription status
    print("\n📊 Getting current subscription status...")
    status_response = requests.get(f"{base_url}/subscription/status", headers=headers)
    
    if status_response.status_code == 200:
        status_data = status_response.json()
        subscription = status_data.get('subscription', {})
        billing_interval = subscription.get('billing_interval')
        print(f"   Current billing: {billing_interval}")
        print(f"   Subscription ID: {subscription.get('stripe_subscription_id')}")
        print(f"   Price ID: {status_data.get('workspace', {}).get('stripe_price_id')}")
    
    # Test 1: Try monthly billing (should work if currently monthly)
    print("\n🧪 Test 1: Monthly billing request...")
    monthly_data = {
        "plan": "professional",
        "quantity": 8,
        "billing_period": "monthly",
        "origin_url": "https://sale-insights.preview.emergentagent.com/dashboard"
    }
    
    monthly_response = requests.post(f"{base_url}/checkout/create-session", 
                                   json=monthly_data, headers=headers)
    
    print(f"   Status: {monthly_response.status_code}")
    if monthly_response.status_code != 200:
        try:
            error_data = monthly_response.json()
            print(f"   Error: {error_data}")
        except:
            print(f"   Error text: {monthly_response.text}")
    else:
        print(f"   Success: Monthly checkout session created")
    
    # Test 2: Try annual billing (should work)
    print("\n🧪 Test 2: Annual billing request...")
    annual_data = {
        "plan": "professional", 
        "quantity": 8,
        "billing_period": "annual",
        "origin_url": "https://sale-insights.preview.emergentagent.com/dashboard"
    }
    
    annual_response = requests.post(f"{base_url}/checkout/create-session",
                                  json=annual_data, headers=headers)
    
    print(f"   Status: {annual_response.status_code}")
    if annual_response.status_code != 200:
        try:
            error_data = annual_response.json()
            print(f"   Error: {error_data}")
        except:
            print(f"   Error text: {annual_response.text}")
    else:
        print(f"   Success: Annual checkout session created")
        
    # Test 3: Check if we can simulate the scenario by examining the backend logic
    print("\n🔍 Analysis:")
    print("   The downgrade blocking logic only triggers when:")
    print("   1. User currently has ANNUAL subscription (price_1SSyK4IVM4C8dIGveBYOSf1m)")
    print("   2. User tries to switch to MONTHLY (price_1SS2XxIVM4C8dIGvpBRcYSNX)")
    print("   3. Manager12@test.com currently has monthly, so blocking won't trigger")
    
    return True

if __name__ == "__main__":
    test_downgrade_blocking()