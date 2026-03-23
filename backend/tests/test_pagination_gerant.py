"""
Tests unitaires pour la pagination des routes gérant (get_all_sellers / get_all_managers).

Vérifie :
- Calcul correct de skip = (page-1) * size
- Cap sur size : min 1, max 200
- Structure de réponse : {items, total, page, size, pages}
- Calcul de pages = ceil(total / size)
- Les filtres transmis au repo (gerant_id, role, status)

Exécution :
  pytest tests/test_pagination_gerant.py -v
  python -m unittest tests.test_pagination_gerant -v
"""
import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock
import sys
import os

if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _make_staff_mixin(total_count: int = 25, items: list = None):
    """
    Crée une instance de StaffMixin avec user_repo mocké.
    total_count : valeur retournée par count_by_gerant
    items : liste retournée par find_many (slice simulé)
    """
    from services.gerant_service._staff_mixin import StaffMixin

    class ConcreteStaff(StaffMixin):
        pass

    svc = ConcreteStaff.__new__(ConcreteStaff)
    svc.user_repo = MagicMock()
    svc.user_repo.count_by_gerant = AsyncMock(return_value=total_count)
    svc.user_repo.find_many = AsyncMock(return_value=items or [])
    return svc


class TestGetAllSellersPagination(unittest.TestCase):

    # --- Structure de réponse ---

    def test_response_has_required_keys(self):
        svc = _make_staff_mixin(total_count=5, items=[{"id": "u1"}])
        result = asyncio.run(svc.get_all_sellers("gerant1"))
        for key in ("items", "total", "page", "size", "pages"):
            self.assertIn(key, result, f"Clé manquante : {key}")

    def test_response_values_match_inputs(self):
        items = [{"id": f"u{i}"} for i in range(10)]
        svc = _make_staff_mixin(total_count=45, items=items)
        result = asyncio.run(svc.get_all_sellers("gerant1", page=2, size=10))
        self.assertEqual(result["total"], 45)
        self.assertEqual(result["page"], 2)
        self.assertEqual(result["size"], 10)
        self.assertEqual(result["items"], items)

    # --- Calcul de pages (ceiling division) ---

    def test_pages_calculation_exact_division(self):
        svc = _make_staff_mixin(total_count=20)
        result = asyncio.run(svc.get_all_sellers("g", page=1, size=10))
        self.assertEqual(result["pages"], 2)

    def test_pages_calculation_with_remainder(self):
        svc = _make_staff_mixin(total_count=21)
        result = asyncio.run(svc.get_all_sellers("g", page=1, size=10))
        self.assertEqual(result["pages"], 3)

    def test_pages_calculation_zero_total(self):
        svc = _make_staff_mixin(total_count=0)
        result = asyncio.run(svc.get_all_sellers("g"))
        self.assertEqual(result["pages"], 0)

    # --- Calcul de skip ---

    def test_skip_page1(self):
        """Page 1 → skip 0."""
        svc = _make_staff_mixin(total_count=50)
        asyncio.run(svc.get_all_sellers("g", page=1, size=20))
        call_kwargs = svc.user_repo.find_many.call_args[1]
        self.assertEqual(call_kwargs["skip"], 0)

    def test_skip_page2(self):
        """Page 2, size=10 → skip=10."""
        svc = _make_staff_mixin(total_count=50)
        asyncio.run(svc.get_all_sellers("g", page=2, size=10))
        call_kwargs = svc.user_repo.find_many.call_args[1]
        self.assertEqual(call_kwargs["skip"], 10)

    def test_skip_page3(self):
        """Page 3, size=25 → skip=50."""
        svc = _make_staff_mixin(total_count=100)
        asyncio.run(svc.get_all_sellers("g", page=3, size=25))
        call_kwargs = svc.user_repo.find_many.call_args[1]
        self.assertEqual(call_kwargs["skip"], 50)

    # --- Cap sur size ---

    def test_size_cap_maximum(self):
        """size > 200 doit être ramené à 200."""
        svc = _make_staff_mixin(total_count=1000)
        result = asyncio.run(svc.get_all_sellers("g", page=1, size=999))
        self.assertEqual(result["size"], 200)
        call_kwargs = svc.user_repo.find_many.call_args[1]
        self.assertEqual(call_kwargs["limit"], 200)

    def test_size_cap_minimum(self):
        """size < 1 doit être ramené à 1."""
        svc = _make_staff_mixin(total_count=10)
        result = asyncio.run(svc.get_all_sellers("g", page=1, size=0))
        self.assertEqual(result["size"], 1)

    def test_size_boundary_200(self):
        """size=200 est valide."""
        svc = _make_staff_mixin(total_count=500)
        result = asyncio.run(svc.get_all_sellers("g", page=1, size=200))
        self.assertEqual(result["size"], 200)

    # --- Filtres transmis au repo ---

    def test_filter_role_is_seller(self):
        """find_many doit être appelé avec role='seller' pour get_all_sellers."""
        svc = _make_staff_mixin(total_count=5)
        asyncio.run(svc.get_all_sellers("gerant42"))
        filter_arg = svc.user_repo.find_many.call_args[0][0]
        self.assertEqual(filter_arg["role"], "seller")

    def test_filter_gerant_id(self):
        svc = _make_staff_mixin(total_count=5)
        asyncio.run(svc.get_all_sellers("gerant42"))
        filter_arg = svc.user_repo.find_many.call_args[0][0]
        self.assertEqual(filter_arg["gerant_id"], "gerant42")

    def test_filter_excludes_deleted(self):
        """Les utilisateurs supprimés ne doivent pas apparaître."""
        svc = _make_staff_mixin(total_count=5)
        asyncio.run(svc.get_all_sellers("g"))
        filter_arg = svc.user_repo.find_many.call_args[0][0]
        self.assertEqual(filter_arg["status"], {"$ne": "deleted"})

    def test_sort_is_by_name_ascending(self):
        svc = _make_staff_mixin(total_count=5)
        asyncio.run(svc.get_all_sellers("g"))
        call_kwargs = svc.user_repo.find_many.call_args[1]
        self.assertIn(("name", 1), call_kwargs.get("sort", []))


class TestGetAllManagersPagination(unittest.TestCase):
    """Mêmes garanties pour get_all_managers."""

    def test_filter_role_is_manager(self):
        svc = _make_staff_mixin(total_count=3)
        asyncio.run(svc.get_all_managers("gerant1"))
        filter_arg = svc.user_repo.find_many.call_args[0][0]
        self.assertEqual(filter_arg["role"], "manager")

    def test_response_structure(self):
        svc = _make_staff_mixin(total_count=3, items=[{"id": "m1"}, {"id": "m2"}])
        result = asyncio.run(svc.get_all_managers("gerant1", page=1, size=10))
        self.assertEqual(result["total"], 3)
        self.assertEqual(result["pages"], 1)
        self.assertEqual(len(result["items"]), 2)

    def test_skip_page2_size5(self):
        svc = _make_staff_mixin(total_count=15)
        asyncio.run(svc.get_all_managers("g", page=2, size=5))
        call_kwargs = svc.user_repo.find_many.call_args[1]
        self.assertEqual(call_kwargs["skip"], 5)


if __name__ == "__main__":
    unittest.main()
