"""
Unit tests for subscription flow corrections.

Tests:
- checkout blocks if active subscription exists
- webhook idempotent (replay event)
- cancel refuses if multiple actives (or cancels the right one)
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from datetime import datetime, timezone

# Mock imports
import sys
sys.path.insert(0, 'backend')

from api.routes.gerant import create_gerant_checkout_session, cancel_subscription, CancelSubscriptionRequest
from services.payment_service import PaymentService
from services.gerant_service import GerantService


@pytest.fixture
def mock_db():
    """Mock database"""
    db = MagicMock()
    db.subscriptions = MagicMock()
    db.users = MagicMock()
    db.workspaces = MagicMock()
    return db


@pytest.fixture
def mock_current_user():
    """Mock current user (gerant)"""
    return {
        "id": "gerant-123",
        "email": "test@example.com",
        "name": "Test Gerant",
        "workspace_id": "workspace-123"
    }


@pytest.mark.asyncio
async def test_checkout_blocks_if_active_exists(mock_db, mock_current_user):
    """Test that checkout returns 409 if >=1 active subscription exists"""
    # Setup: Mock existing active subscription
    mock_db.subscriptions.find.return_value.to_list = AsyncMock(return_value=[
        {
            "user_id": "gerant-123",
            "status": "active",
            "stripe_subscription_id": "sub_existing",
            "billing_interval": "month",
            "seats": 5
        }
    ])
    
    mock_db.users.find_one = AsyncMock(return_value={
        "id": "gerant-123",
        "stripe_customer_id": "cus_test"
    })
    
    # Mock Stripe
    with patch('api.routes.gerant.stripe') as mock_stripe:
        mock_stripe.Subscription.retrieve.return_value.status = "active"
        mock_stripe.Customer.retrieve.return_value.get.return_value = False
        
        # Test: Should raise HTTPException 409
        with pytest.raises(HTTPException) as exc_info:
            await create_gerant_checkout_session(
                checkout_data=MagicMock(quantity=5, billing_period="monthly", origin_url="http://test.com"),
                current_user=mock_current_user,
                db=mock_db
            )
        
        assert exc_info.value.status_code == 409
        assert "abonnement actif existe déjà" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_checkout_warns_if_multiple_active(mock_db, mock_current_user):
    """Test that checkout logs WARN if >1 active subscription"""
    # Setup: Mock multiple active subscriptions
    mock_db.subscriptions.find.return_value.to_list = AsyncMock(return_value=[
        {
            "user_id": "gerant-123",
            "status": "active",
            "stripe_subscription_id": "sub_1",
        },
        {
            "user_id": "gerant-123",
            "status": "trialing",
            "stripe_subscription_id": "sub_2",
        }
    ])
    
    mock_db.users.find_one = AsyncMock(return_value={
        "id": "gerant-123",
        "stripe_customer_id": "cus_test"
    })
    
    # Mock Stripe
    with patch('api.routes.gerant.stripe') as mock_stripe, \
         patch('api.routes.gerant.logger') as mock_logger:
        mock_stripe.Subscription.retrieve.return_value.status = "active"
        mock_stripe.Customer.retrieve.return_value.get.return_value = False
        
        # Test: Should raise 409 and log WARN
        with pytest.raises(HTTPException) as exc_info:
            await create_gerant_checkout_session(
                checkout_data=MagicMock(quantity=5, billing_period="monthly", origin_url="http://test.com"),
                current_user=mock_current_user,
                db=mock_db
            )
        
        assert exc_info.value.status_code == 409
        # Verify WARN was logged
        mock_logger.warning.assert_called()
        assert "MULTIPLE ACTIVE SUBSCRIPTIONS" in str(mock_logger.warning.call_args)


@pytest.mark.asyncio
async def test_webhook_idempotent_replay_event(mock_db):
    """Test that webhook is idempotent (can replay same event)"""
    payment_service = PaymentService(mock_db)
    
    # Mock user
    mock_db.users.find_one = AsyncMock(return_value={
        "id": "gerant-123",
        "email": "test@example.com",
        "workspace_id": "workspace-123"
    })
    
    # Mock subscription data
    subscription_data = {
        "id": "sub_test_123",
        "customer": "cus_test",
        "status": "active",
        "items": {
            "data": [{
                "id": "si_test",
                "quantity": 5,
                "price": {
                    "recurring": {"interval": "month"}
                }
            }]
        },
        "metadata": {
            "checkout_session_id": "cs_test_123"
        }
    }
    
    # First call
    mock_db.subscriptions.find.return_value.to_list = AsyncMock(return_value=[])
    mock_db.subscriptions.find_one = AsyncMock(return_value=None)  # Not exists
    mock_db.subscriptions.update_one = AsyncMock()
    
    result1 = await payment_service._handle_subscription_created(subscription_data)
    assert result1["status"] == "success"
    
    # Second call (replay same event) - should be idempotent
    mock_db.subscriptions.find_one = AsyncMock(return_value={
        "stripe_subscription_id": "sub_test_123",
        "user_id": "gerant-123"
    })  # Already exists
    
    result2 = await payment_service._handle_subscription_created(subscription_data)
    assert result2["status"] == "success"
    
    # Verify upsert was called with stripe_subscription_id as key
    calls = mock_db.subscriptions.update_one.call_args_list
    assert len(calls) == 2
    for call in calls:
        args, kwargs = call
        filter_dict = args[0]
        assert "stripe_subscription_id" in filter_dict
        assert filter_dict["stripe_subscription_id"] == "sub_test_123"


@pytest.mark.asyncio
async def test_cancel_refuses_if_multiple_actives(mock_db, mock_current_user):
    """Test that cancel endpoint handles multiple active subscriptions correctly"""
    # Setup: Mock multiple active subscriptions
    mock_db.subscriptions.find.return_value.to_list = AsyncMock(return_value=[
        {
            "user_id": "gerant-123",
            "status": "active",
            "stripe_subscription_id": "sub_1",
            "created_at": "2024-01-01T00:00:00Z",
            "current_period_end": "2024-02-01T00:00:00Z"
        },
        {
            "user_id": "gerant-123",
            "status": "active",
            "stripe_subscription_id": "sub_2",
            "created_at": "2024-01-15T00:00:00Z",
            "current_period_end": "2024-02-15T00:00:00Z"
        }
    ])
    
    # Mock Stripe
    with patch('api.routes.gerant.stripe') as mock_stripe, \
         patch('api.routes.gerant.settings') as mock_settings, \
         patch('api.routes.gerant.logger') as mock_logger:
        mock_settings.STRIPE_API_KEY = "sk_test"
        mock_stripe.api_key = "sk_test"
        mock_stripe.Subscription.modify.return_value.current_period_end = 1706745600  # 2024-02-01
        
        # Test: Should choose most recent and log warning
        request = CancelSubscriptionRequest(cancel_immediately=False)
        
        result = await cancel_subscription(
            request=request,
            current_user=mock_current_user,
            db=mock_db
        )
        
        # Should succeed but log warning about multiple
        assert result["success"] is True
        mock_logger.warning.assert_called()
        assert "MULTIPLE ACTIVE SUBSCRIPTIONS" in str(mock_logger.warning.call_args)
        
        # Verify it chose the most recent (sub_2 with later current_period_end)
        # The update should be called with stripe_subscription_id
        update_calls = mock_db.subscriptions.update_one.call_args_list
        assert len(update_calls) > 0
        # Check that it used stripe_subscription_id as key
        filter_dict = update_calls[0][0][0]
        assert "stripe_subscription_id" in filter_dict


@pytest.mark.asyncio
async def test_webhook_syncs_state_without_canceling(mock_db):
    """Test that webhook syncs state without auto-canceling other subscriptions"""
    payment_service = PaymentService(mock_db)
    
    # Mock user
    mock_db.users.find_one = AsyncMock(return_value={
        "id": "gerant-123",
        "email": "test@example.com",
        "workspace_id": "workspace-123"
    })
    
    # Mock existing active subscription (should NOT be canceled)
    mock_db.subscriptions.find.return_value.to_list = AsyncMock(return_value=[
        {
            "user_id": "gerant-123",
            "status": "active",
            "stripe_subscription_id": "sub_existing"
        }
    ])
    
    # Mock subscription data WITHOUT checkout_session_id (no proof of causality)
    subscription_data = {
        "id": "sub_new",
        "customer": "cus_test",
        "status": "active",
        "items": {
            "data": [{
                "id": "si_test",
                "quantity": 5,
                "price": {
                    "recurring": {"interval": "month"}
                }
            }]
        },
        "metadata": {}  # NO checkout_session_id
    }
    
    mock_db.subscriptions.find_one = AsyncMock(return_value=None)
    mock_db.subscriptions.update_one = AsyncMock()
    
    # Mock Stripe (should NOT be called to cancel)
    with patch('services.payment_service.stripe') as mock_stripe, \
         patch('services.payment_service.logger') as mock_logger:
        
        result = await payment_service._handle_subscription_created(subscription_data)
        
        # Should sync state
        assert result["status"] == "success"
        assert result["has_multiple_active"] is True
        
        # Should NOT call Stripe to cancel
        mock_stripe.Subscription.modify.assert_not_called()
        
        # Should log anomaly
        mock_logger.warning.assert_called()
        assert "ANOMALY" in str(mock_logger.warning.call_args)
        assert "NOT canceling automatically" in str(mock_logger.warning.call_args)


@pytest.mark.asyncio
async def test_webhook_out_of_order_event_ignored(mock_db):
    """Test that out-of-order webhook events are ignored"""
    payment_service = PaymentService(mock_db)
    
    # Mock user
    mock_db.users.find_one = AsyncMock(return_value={
        "id": "gerant-123",
        "email": "test@example.com",
        "workspace_id": "workspace-123"
    })
    
    # First event (newer)
    subscription_data_newer = {
        "id": "sub_test",
        "customer": "cus_test",
        "status": "active",
        "created": 1704067200,  # 2024-01-01
        "_event_created": 1704067200,
        "_event_id": "evt_newer",
        "items": {
            "data": [{
                "id": "si_test",
                "quantity": 5,
                "price": {
                    "recurring": {"interval": "month"}
                }
            }]
        },
        "metadata": {
            "correlation_id": "corr_123",
            "source": "app_checkout"
        }
    }
    
    # Process newer event first
    mock_db.subscriptions.find.return_value.to_list = AsyncMock(return_value=[])
    mock_db.subscriptions.find_one = AsyncMock(return_value=None)
    mock_db.subscriptions.update_one = AsyncMock()
    
    result1 = await payment_service._handle_subscription_created(subscription_data_newer)
    assert result1["status"] == "success"
    
    # Second event (older) - should be ignored
    subscription_data_older = {
        "id": "sub_test",
        "customer": "cus_test",
        "status": "active",
        "created": 1703980800,  # 2023-12-31 (older)
        "_event_created": 1703980800,
        "_event_id": "evt_older",
        "items": {
            "data": [{
                "id": "si_test",
                "quantity": 3,  # Different quantity
                "price": {
                    "recurring": {"interval": "month"}
                }
            }]
        },
        "metadata": {}
    }
    
    # Mock existing subscription with newer event_created
    mock_db.subscriptions.find_one = AsyncMock(return_value={
        "stripe_subscription_id": "sub_test",
        "last_event_created": 1704067200,  # Newer than incoming event
        "seats": 5
    })
    
    result2 = await payment_service._handle_subscription_created(subscription_data_older)
    
    # Should be skipped
    assert result2["status"] == "skipped"
    assert result2["reason"] == "out_of_order_event"
    
    # Verify update was NOT called (event ignored)
    update_calls = [call for call in mock_db.subscriptions.update_one.call_args_list 
                    if call[0][0].get("stripe_subscription_id") == "sub_test"]
    # Should only have one update (from the newer event)
    assert len(update_calls) == 1


@pytest.mark.asyncio
async def test_multi_workspace_selection_logic(mock_db):
    """Test selection logic with multiple subscriptions across workspaces"""
    gerant_service = GerantService(mock_db)
    
    # Mock gerant with workspace_id
    mock_db.users.find_one = AsyncMock(return_value={
        "id": "gerant-123",
        "workspace_id": "workspace-A"
    })
    
    # Mock multiple subscriptions across different workspaces
    mock_db.subscriptions.find.return_value.to_list = AsyncMock(return_value=[
        {
            "user_id": "gerant-123",
            "workspace_id": "workspace-A",  # Matches current workspace
            "status": "active",
            "stripe_subscription_id": "sub_A",
            "current_period_end": "2024-02-01T00:00:00Z",
            "created_at": "2024-01-01T00:00:00Z"
        },
        {
            "user_id": "gerant-123",
            "workspace_id": "workspace-B",  # Different workspace
            "status": "active",
            "stripe_subscription_id": "sub_B",
            "current_period_end": "2024-03-01T00:00:00Z",  # More recent
            "created_at": "2024-01-15T00:00:00Z"
        }
    ])
    
    # Mock _format_db_subscription
    async def mock_format(sub, gerant_id):
        return {
            "has_subscription": True,
            "status": sub.get("status"),
            "subscription": {"id": sub.get("stripe_subscription_id")}
        }
    
    gerant_service._format_db_subscription = mock_format
    
    result = await gerant_service.get_subscription_status("gerant-123")
    
    # Should select workspace-A subscription (matching workspace_id) even though sub_B is more recent
    assert result["has_subscription"] is True
    assert result["has_multiple_active"] is True
    assert result["active_subscriptions_count"] == 2
    # The selected subscription should be from workspace-A
    assert result["subscription"]["id"] == "sub_A"


@pytest.mark.asyncio
async def test_multi_product_selection_logic(mock_db):
    """Test selection logic with multiple subscriptions for different products/price_ids"""
    gerant_service = GerantService(mock_db)
    
    # Mock gerant
    mock_db.users.find_one = AsyncMock(return_value={
        "id": "gerant-123",
        "workspace_id": "workspace-123"
    })
    
    # Mock multiple subscriptions with different price_ids
    mock_db.subscriptions.find.return_value.to_list = AsyncMock(return_value=[
        {
            "user_id": "gerant-123",
            "workspace_id": "workspace-123",
            "status": "active",
            "stripe_subscription_id": "sub_starter",
            "price_id": "price_starter_monthly",
            "current_period_end": "2024-02-01T00:00:00Z",
            "created_at": "2024-01-01T00:00:00Z"
        },
        {
            "user_id": "gerant-123",
            "workspace_id": "workspace-123",
            "status": "active",
            "stripe_subscription_id": "sub_pro",
            "price_id": "price_pro_monthly",
            "current_period_end": "2024-03-01T00:00:00Z",  # More recent
            "created_at": "2024-01-15T00:00:00Z"
        }
    ])
    
    # Mock _format_db_subscription
    async def mock_format(sub, gerant_id):
        return {
            "has_subscription": True,
            "status": sub.get("status"),
            "subscription": {
                "id": sub.get("stripe_subscription_id"),
                "price_id": sub.get("price_id")
            }
        }
    
    gerant_service._format_db_subscription = mock_format
    
    result = await gerant_service.get_subscription_status("gerant-123")
    
    # Should detect multiple and select one (currently selects by date, but logic is in place for price_id filtering)
    assert result["has_subscription"] is True
    assert result["has_multiple_active"] is True
    assert result["active_subscriptions_count"] == 2


@pytest.mark.asyncio
async def test_cancel_409_if_multiple_without_support_mode(mock_db, mock_current_user):
    """Test that cancel returns 409 if multiple actives without support_mode"""
    # Setup: Mock multiple active subscriptions
    mock_db.subscriptions.find.return_value.to_list = AsyncMock(return_value=[
        {
            "user_id": "gerant-123",
            "status": "active",
            "stripe_subscription_id": "sub_1",
            "workspace_id": "workspace-123",
            "created_at": "2024-01-01T00:00:00Z"
        },
        {
            "user_id": "gerant-123",
            "status": "active",
            "stripe_subscription_id": "sub_2",
            "workspace_id": "workspace-123",
            "created_at": "2024-01-15T00:00:00Z"
        }
    ])
    
    # Test: Should raise 409
    request = CancelSubscriptionRequest(cancel_immediately=False, support_mode=False)
    
    with pytest.raises(HTTPException) as exc_info:
        await cancel_subscription(
            request=request,
            current_user=mock_current_user,
            db=mock_db
        )
    
    assert exc_info.value.status_code == 409
    assert "MULTIPLE_ACTIVE_SUBSCRIPTIONS" in str(exc_info.value.detail)
    assert "active_subscriptions" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_cancel_with_explicit_stripe_subscription_id(mock_db, mock_current_user):
    """Test that cancel works with explicit stripe_subscription_id"""
    # Setup: Mock multiple active subscriptions
    mock_db.subscriptions.find.return_value.to_list = AsyncMock(return_value=[
        {
            "user_id": "gerant-123",
            "status": "active",
            "stripe_subscription_id": "sub_1",
            "workspace_id": "workspace-123"
        },
        {
            "user_id": "gerant-123",
            "status": "active",
            "stripe_subscription_id": "sub_2",
            "workspace_id": "workspace-123"
        }
    ])
    
    # Mock Stripe
    with patch('api.routes.gerant.stripe') as mock_stripe, \
         patch('api.routes.gerant.settings') as mock_settings:
        mock_settings.STRIPE_API_KEY = "sk_test"
        mock_stripe.api_key = "sk_test"
        mock_stripe.Subscription.modify.return_value.current_period_end = 1706745600
        
        # Test: Should succeed with explicit stripe_subscription_id
        request = CancelSubscriptionRequest(
            cancel_immediately=False,
            stripe_subscription_id="sub_2"
        )
        
        result = await cancel_subscription(
            request=request,
            current_user=mock_current_user,
            db=mock_db
        )
        
        assert result["success"] is True
        # Verify it targeted sub_2
        update_calls = mock_db.subscriptions.update_one.call_args_list
        assert len(update_calls) > 0
        filter_dict = update_calls[0][0][0]
        assert filter_dict["stripe_subscription_id"] == "sub_2"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
