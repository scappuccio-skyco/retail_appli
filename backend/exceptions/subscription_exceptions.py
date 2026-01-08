"""
Custom exceptions for subscription operations.
"""
from typing import List, Dict, Optional


class MultipleActiveSubscriptionsError(Exception):
    """
    Raised when multiple active subscriptions are detected and explicit targeting is required.
    
    Attributes:
        message: Human-readable error message
        active_subscriptions: List of active subscriptions with details
        recommended_action: What the user should do next
    """
    def __init__(
        self,
        message: str,
        active_subscriptions: List[Dict],
        recommended_action: str = "USE_STRIPE_SUBSCRIPTION_ID"
    ):
        self.message = message
        self.active_subscriptions = active_subscriptions
        self.recommended_action = recommended_action
        super().__init__(self.message)
