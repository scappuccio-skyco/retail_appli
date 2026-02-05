"""
Debug Reset Token - Test token generation and validation
"""
import os
import sys
import asyncio
sys.path.insert(0, '/app/backend')

TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "TestPassword123!")

from datetime import datetime, timezone, timedelta
from core.database import database
from services.auth_service import AuthService


async def test_reset_token_flow():
    """Test the complete reset token flow"""
    print("\n" + "="*60)
    print("🧪 RESET TOKEN DEBUG TEST")
    print("="*60)
    
    # Initialize database connection
    await database.connect()
    db = database.db
    
    # Test email (use existing user)
    test_email = "gerant@skyco.fr"
    
    # Step 1: Check if user exists
    print(f"\n📋 Step 1: Checking if user exists...")
    user = await db.users.find_one({"email": test_email}, {"_id": 0})
    if not user:
        print(f"❌ User {test_email} not found in database")
        return
    print(f"✅ User found: {user.get('name', 'N/A')} ({test_email})")
    
    # Step 2: Generate token manually (simulate request_password_reset)
    print(f"\n🔑 Step 2: Generating reset token...")
    import secrets
    reset_token = secrets.token_urlsafe(32)
    
    now_utc = datetime.now(timezone.utc)
    expires_at_utc = now_utc + timedelta(hours=1)
    
    token_doc = {
        "email": test_email,
        "token": reset_token,
        "created_at": now_utc.isoformat(),
        "expires_at": expires_at_utc.isoformat()
    }
    
    print(f"✅ Token generated: {reset_token[:20]}...")
    print(f"   Created at:  {token_doc['created_at']}")
    print(f"   Expires at:  {token_doc['expires_at']}")
    
    # Step 3: Save to database
    print(f"\n💾 Step 3: Saving token to database...")
    await db.password_resets.delete_many({"email": test_email})  # Clean old tokens
    result = await db.password_resets.insert_one(token_doc)
    print(f"✅ Token saved to DB (inserted_id: {result.inserted_id})")
    
    # Step 4: Verify token is in database
    print(f"\n🔍 Step 4: Verifying token in database...")
    saved_token = await db.password_resets.find_one({"token": reset_token}, {"_id": 0})
    if saved_token:
        print(f"✅ Token found in DB:")
        print(f"   Email:      {saved_token['email']}")
        print(f"   Token:      {saved_token['token'][:20]}...")
        print(f"   Created:    {saved_token['created_at']}")
        print(f"   Expires:    {saved_token['expires_at']}")
    else:
        print(f"❌ Token NOT found in database!")
        return
    
    # Step 5: Test validation logic
    print(f"\n✅ Step 5: Testing validation logic...")
    try:
        now_check = datetime.now(timezone.utc)
        expires_check = datetime.fromisoformat(saved_token['expires_at'])
        
        print(f"   Current time (UTC):  {now_check.isoformat()}")
        print(f"   Expiration time:     {expires_check.isoformat()}")
        print(f"   Time remaining:      {(expires_check - now_check).total_seconds():.0f} seconds")
        
        if now_check > expires_check:
            print(f"❌ Token is EXPIRED!")
        else:
            print(f"✅ Token is VALID!")
            
            # Calculate exact expiration time
            remaining = expires_check - now_check
            hours = remaining.total_seconds() / 3600
            print(f"   ⏰ Valid for: {hours:.2f} hours")
    except Exception as e:
        print(f"❌ Validation error: {e}")
    
    # Step 6: Test with AuthService
    print(f"\n🧪 Step 6: Testing with AuthService.reset_password()...")
    try:
        from repositories.user_repository import UserRepository
        user_repo = UserRepository(db)
        auth_service = AuthService(db, user_repo)
        
        # Try to reset password with the token
        new_password = TEST_PASSWORD
        success = await auth_service.reset_password(reset_token, new_password)
        
        if success:
            print(f"✅ AuthService validation PASSED!")
            print(f"   Password reset successful")
        else:
            print(f"❌ AuthService validation FAILED!")
    except Exception as e:
        print(f"❌ AuthService error: {e}")
    
    # Cleanup
    print(f"\n🧹 Cleanup...")
    await db.password_resets.delete_many({"email": test_email})
    print(f"✅ Test tokens cleaned up")
    
    print("\n" + "="*60)
    print("✅ TEST COMPLETED")
    print("="*60)
    
    await database.disconnect()


if __name__ == "__main__":
    asyncio.run(test_reset_token_flow())
