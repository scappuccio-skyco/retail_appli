#!/usr/bin/env python3
"""
Test Objective Visibility Filtering for Sellers
Review Request: Test filtering of objectives based on visible_to_sellers field
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "https://saas-billing-2.preview.emergentagent.com/api"

def login(email, password):
    """Login and return token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password},
        timeout=30
    )
    if response.status_code == 200:
        data = response.json()
        return data.get('token'), data.get('user')
    return None, None

def get_active_objectives(token):
    """Get active objectives for seller"""
    response = requests.get(
        f"{BASE_URL}/seller/objectives/active",
        headers={'Authorization': f'Bearer {token}'},
        timeout=30
    )
    if response.status_code == 200:
        return response.json()
    return None

def create_objective(token, objective_data):
    """Create objective as manager"""
    response = requests.post(
        f"{BASE_URL}/manager/objectives",
        json=objective_data,
        headers={'Authorization': f'Bearer {token}'},
        timeout=30
    )
    if response.status_code == 200:
        return response.json()
    return None

def get_sellers(token):
    """Get sellers under manager"""
    response = requests.get(
        f"{BASE_URL}/manager/sellers",
        headers={'Authorization': f'Bearer {token}'},
        timeout=30
    )
    if response.status_code == 200:
        return response.json()
    return None

def main():
    print("=" * 80)
    print("🔍 Testing Objective Visibility Filtering for Sellers")
    print("=" * 80)
    print()
    
    # Step 1: Login as manager
    print("📋 Step 1: Login as manager...")
    manager_credentials = [
        ("manager@test.com", "demo123"),
        ("manager@demo.com", "demo123"),
        ("manager1@test.com", "password123")
    ]
    
    manager_token = None
    manager_info = None
    
    for email, password in manager_credentials:
        print(f"   Trying {email}...")
        token, user = login(email, password)
        if token:
            manager_token = token
            manager_info = user
            print(f"   ✅ Logged in as: {user.get('name')} ({user.get('email')})")
            break
    
    if not manager_token:
        print("   ❌ Could not login as manager")
        return
    
    # Step 2: Get sellers under manager
    print("\n📋 Step 2: Get sellers under manager...")
    sellers = get_sellers(manager_token)
    
    if not sellers:
        print("   ❌ Could not get sellers")
        return
    
    print(f"   ✅ Found {len(sellers)} seller(s)")
    
    # Find Sophie, Thomas, and Marie
    sophie_id = None
    thomas_id = None
    marie_id = None
    
    for seller in sellers:
        email = seller.get('email', '').lower()
        name = seller.get('name', '').lower()
        
        if 'sophie' in email or 'sophie' in name:
            sophie_id = seller.get('id')
            print(f"   ✅ Found Sophie: {seller.get('name')} ({seller.get('email')}) - ID: {sophie_id}")
        elif 'thomas' in email or 'thomas' in name:
            thomas_id = seller.get('id')
            print(f"   ✅ Found Thomas: {seller.get('name')} ({seller.get('email')}) - ID: {thomas_id}")
        elif 'marie' in email or 'marie' in name:
            marie_id = seller.get('id')
            print(f"   ✅ Found Marie: {seller.get('name')} ({seller.get('email')}) - ID: {marie_id}")
    
    if not sophie_id or not thomas_id or not marie_id:
        print(f"\n   ⚠️  Could not find all required sellers:")
        print(f"      Sophie ID: {sophie_id}")
        print(f"      Thomas ID: {thomas_id}")
        print(f"      Marie ID: {marie_id}")
        print("\n   Available sellers:")
        for seller in sellers:
            print(f"      - {seller.get('name')} ({seller.get('email')}) - ID: {seller.get('id')}")
        return
    
    # Step 3: Create test objective visible only to Sophie and Thomas
    print("\n📋 Step 3: Create test objective visible only to Sophie and Thomas...")
    
    today = datetime.now()
    start_date = today.strftime('%Y-%m-%d')
    end_date = (today + timedelta(days=30)).strftime('%Y-%m-%d')
    
    objective_data = {
        "title": "Objectif Sophie & Thomas uniquement",
        "type": "collective",
        "visible": True,
        "visible_to_sellers": [sophie_id, thomas_id],
        "ca_target": 50000.0,
        "period_start": start_date,
        "period_end": end_date
    }
    
    created_objective = create_objective(manager_token, objective_data)
    
    if not created_objective:
        print("   ❌ Could not create objective")
        return
    
    objective_id = created_objective.get('id')
    print(f"   ✅ Created objective: {created_objective.get('title')}")
    print(f"   ✅ Objective ID: {objective_id}")
    print(f"   ✅ Visible to sellers: {created_objective.get('visible_to_sellers')}")
    
    # Step 4: Test with Sophie
    print("\n📋 Step 4: Test with Sophie (should SEE the objective)...")
    
    sophie_credentials = [
        ("sophie@test.com", "demo123"),
        ("sophie@test.com", "password123")
    ]
    
    sophie_token = None
    for email, password in sophie_credentials:
        token, user = login(email, password)
        if token:
            sophie_token = token
            print(f"   ✅ Logged in as Sophie: {user.get('name')}")
            break
    
    if not sophie_token:
        print("   ❌ Could not login as Sophie")
        return
    
    sophie_objectives = get_active_objectives(sophie_token)
    
    if sophie_objectives is None:
        print("   ❌ Could not get Sophie's objectives")
        return
    
    print(f"   ✅ Sophie has {len(sophie_objectives)} active objective(s)")
    
    found_in_sophie = False
    for obj in sophie_objectives:
        if obj.get('id') == objective_id:
            found_in_sophie = True
            print(f"   ✅ SUCCESS: Sophie can see 'Objectif Sophie & Thomas uniquement'")
            break
    
    if not found_in_sophie:
        print(f"   ❌ FAILURE: Sophie CANNOT see 'Objectif Sophie & Thomas uniquement'")
        print(f"   Sophie's objectives:")
        for obj in sophie_objectives:
            print(f"      - {obj.get('title')} (ID: {obj.get('id')})")
    
    # Step 5: Test with Thomas
    print("\n📋 Step 5: Test with Thomas (should SEE the objective)...")
    
    thomas_credentials = [
        ("thomas@test.com", "demo123"),
        ("thomas@test.com", "password123")
    ]
    
    thomas_token = None
    for email, password in thomas_credentials:
        token, user = login(email, password)
        if token:
            thomas_token = token
            print(f"   ✅ Logged in as Thomas: {user.get('name')}")
            break
    
    if not thomas_token:
        print("   ❌ Could not login as Thomas")
        return
    
    thomas_objectives = get_active_objectives(thomas_token)
    
    if thomas_objectives is None:
        print("   ❌ Could not get Thomas's objectives")
        return
    
    print(f"   ✅ Thomas has {len(thomas_objectives)} active objective(s)")
    
    found_in_thomas = False
    for obj in thomas_objectives:
        if obj.get('id') == objective_id:
            found_in_thomas = True
            print(f"   ✅ SUCCESS: Thomas can see 'Objectif Sophie & Thomas uniquement'")
            break
    
    if not found_in_thomas:
        print(f"   ❌ FAILURE: Thomas CANNOT see 'Objectif Sophie & Thomas uniquement'")
        print(f"   Thomas's objectives:")
        for obj in thomas_objectives:
            print(f"      - {obj.get('title')} (ID: {obj.get('id')})")
    
    # Step 6: Test with Marie
    print("\n📋 Step 6: Test with Marie (should NOT SEE the objective)...")
    
    marie_credentials = [
        ("marie@test.com", "demo123"),
        ("marie@test.com", "password123")
    ]
    
    marie_token = None
    for email, password in marie_credentials:
        token, user = login(email, password)
        if token:
            marie_token = token
            print(f"   ✅ Logged in as Marie: {user.get('name')}")
            break
    
    if not marie_token:
        print("   ❌ Could not login as Marie")
        return
    
    marie_objectives = get_active_objectives(marie_token)
    
    if marie_objectives is None:
        print("   ❌ Could not get Marie's objectives")
        return
    
    print(f"   ✅ Marie has {len(marie_objectives)} active objective(s)")
    
    found_in_marie = False
    for obj in marie_objectives:
        if obj.get('id') == objective_id:
            found_in_marie = True
            break
    
    if not found_in_marie:
        print(f"   ✅ SUCCESS: Marie CANNOT see 'Objectif Sophie & Thomas uniquement' (as expected)")
    else:
        print(f"   ❌ FAILURE: Marie CAN see 'Objectif Sophie & Thomas uniquement' (should be hidden)")
        print(f"   Marie's objectives:")
        for obj in marie_objectives:
            print(f"      - {obj.get('title')} (ID: {obj.get('id')})")
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    print(f"✅ Sophie can see objective: {found_in_sophie}")
    print(f"✅ Thomas can see objective: {found_in_thomas}")
    print(f"✅ Marie CANNOT see objective: {not found_in_marie}")
    print()
    
    if found_in_sophie and found_in_thomas and not found_in_marie:
        print("🎉 ALL TESTS PASSED - Objective visibility filtering is working correctly!")
    else:
        print("❌ SOME TESTS FAILED - Objective visibility filtering has issues")
        if not found_in_sophie:
            print("   - Sophie should see the objective but doesn't")
        if not found_in_thomas:
            print("   - Thomas should see the objective but doesn't")
        if found_in_marie:
            print("   - Marie should NOT see the objective but does")

if __name__ == "__main__":
    main()
