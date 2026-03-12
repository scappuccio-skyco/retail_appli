"""
Shared MongoDB aggregation pipeline for seller KPI metrics.

Single source of truth — imported by both SellerService and ManagerKpiService
so that dashboard vendeur and dashboard manager always produce identical totals.
"""
from typing import Dict, List


EMPTY_KPI_METRICS: Dict = {
    "nb_jours": 0,
    "ca": 0,
    "ventes": 0,
    "articles": 0,
    "prospects": 0,
    "panier_moyen": 0,
    "indice_vente": 0,
    "taux_transformation": 0,
}


def build_seller_kpi_pipeline(seller_id: str, start_date: str, end_date: str) -> List[Dict]:
    """
    Return a MongoDB aggregation pipeline that computes all KPI metrics
    for a given seller over [start_date, end_date] (inclusive, YYYY-MM-DD strings).

    Output document fields:
        nb_jours, ca, ventes, articles, prospects,
        panier_moyen, indice_vente, taux_transformation
    """
    return [
        {
            "$match": {
                "seller_id": seller_id,
                "date": {"$gte": start_date, "$lte": end_date},
            }
        },
        {
            "$group": {
                "_id": None,
                "nb_jours":        {"$sum": 1},
                "total_ca":        {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes":    {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles":  {"$sum": {"$ifNull": ["$nb_articles", 0]}},
                "total_prospects": {"$sum": {"$ifNull": ["$nb_prospects", 0]}},
            }
        },
        {
            "$project": {
                "_id": 0,
                "nb_jours": 1,
                "ca":        "$total_ca",
                "ventes":    "$total_ventes",
                "articles":  "$total_articles",
                "prospects": "$total_prospects",
                "panier_moyen": {
                    "$cond": [
                        {"$gt": ["$total_ventes", 0]},
                        {"$divide": ["$total_ca", "$total_ventes"]},
                        0,
                    ]
                },
                "indice_vente": {
                    "$cond": [
                        {"$gt": ["$total_ventes", 0]},
                        {"$divide": ["$total_articles", "$total_ventes"]},
                        0,
                    ]
                },
                "taux_transformation": {
                    "$cond": [
                        {"$gt": ["$total_prospects", 0]},
                        {"$multiply": [
                            {"$divide": ["$total_ventes", "$total_prospects"]},
                            100,
                        ]},
                        0,
                    ]
                },
            }
        },
    ]
