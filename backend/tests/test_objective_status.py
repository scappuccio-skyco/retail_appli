"""
Test rapide pour vérifier que le status des objectifs est correctement calculé.
Teste spécifiquement le cas où current_value=0 doit donner status="active".
"""
import pytest
from datetime import datetime, timedelta, timezone
from services.seller_service import SellerService


def test_compute_status_active_at_creation():
    """Test: create objective target=18 current=0 end_date future -> status doit être "active" """
    # Mock db (not used in static method)
    db = None
    service = SellerService(db)
    
    # Cas 1: Objectif avec current_value=0, target=18, end_date future
    end_date_future = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
    status = service.compute_status(current_value=0, target_value=18, end_date=end_date_future)
    assert status == "active", f"Expected 'active', got '{status}' for current_value=0, target=18"
    
    # Cas 2: Objectif avec current_value=0, target=4999.98, end_date future
    status2 = service.compute_status(current_value=0, target_value=4999.98, end_date=end_date_future)
    assert status2 == "active", f"Expected 'active', got '{status2}' for current_value=0, target=4999.98"
    
    # Cas 3: Objectif avec current_value=20, target=18, end_date future -> achieved
    status3 = service.compute_status(current_value=20, target_value=18, end_date=end_date_future)
    assert status3 == "achieved", f"Expected 'achieved', got '{status3}' for current_value=20, target=18"
    
    # Cas 4: Objectif avec current_value=10, target=18, end_date passée -> failed
    end_date_past = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    status4 = service.compute_status(current_value=10, target_value=18, end_date=end_date_past)
    assert status4 == "failed", f"Expected 'failed', got '{status4}' for current_value=10, target=18, end_date past"
    
    # Cas 5: Objectif avec current_value=20, target=18, end_date passée -> achieved
    status5 = service.compute_status(current_value=20, target_value=18, end_date=end_date_past)
    assert status5 == "achieved", f"Expected 'achieved', got '{status5}' for current_value=20, target=18, end_date past"
    
    # Cas 6: Objectif avec target=0 (edge case)
    status6 = service.compute_status(current_value=0, target_value=0, end_date=end_date_future)
    assert status6 == "active", f"Expected 'active', got '{status6}' for current_value=0, target=0"
    
    print("✅ Tous les tests de compute_status() sont passés")


if __name__ == "__main__":
    test_compute_status_active_at_creation()
    print("\n✅ Test réussi: Un objectif avec current_value=0 a toujours status='active'")

