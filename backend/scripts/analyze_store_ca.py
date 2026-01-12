"""
Script d'analyse des sommes CA des magasins
Identifie les erreurs potentielles dans le calcul des chiffres d'affaires
"""
import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Ajouter le répertoire backend au path
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

from core.database import database
from core.config import settings


async def analyze_store_ca(store_id: str = None, period_type: str = 'month', period_offset: int = 0):
    """
    Analyse le calcul du CA pour un magasin ou tous les magasins
    
    Vérifie :
    1. Doublons potentiels (manager qui saisit aussi en tant que seller)
    2. Incohérences entre les collections kpi_entries et manager_kpis
    3. Données manquantes ou invalides
    4. Calculs incorrects
    """
    await database.connect()
    db = database.db
    
    # Calculer les dates de période
    today_date = datetime.now(timezone.utc)
    
    if period_type == 'week':
        days_since_monday = today_date.weekday()
        current_monday = today_date - timedelta(days=days_since_monday)
        target_monday = current_monday + timedelta(weeks=period_offset)
        target_sunday = target_monday + timedelta(days=6)
        period_start = target_monday.strftime('%Y-%m-%d')
        period_end = target_sunday.strftime('%Y-%m-%d')
    elif period_type == 'month':
        target_month = today_date.replace(day=1) + timedelta(days=32 * period_offset)
        target_month = target_month.replace(day=1)
        period_start = target_month.strftime('%Y-%m-%d')
        next_month = target_month.replace(day=28) + timedelta(days=4)
        period_end = (next_month.replace(day=1) - timedelta(days=1)).strftime('%Y-%m-%d')
    elif period_type == 'year':
        target_year = today_date.year + period_offset
        period_start = f"{target_year}-01-01"
        period_end = f"{target_year}-12-31"
    else:
        raise ValueError("Invalid period_type")
    
    print(f"\n{'='*80}")
    print(f"ANALYSE DES SOMMES CA - PÉRIODE: {period_type.upper()}")
    print(f"Du {period_start} au {period_end}")
    print(f"{'='*80}\n")
    
    # Récupérer tous les magasins ou un magasin spécifique
    if store_id:
        stores = await db.stores.find({"id": store_id}, {"_id": 0}).to_list(100)
    else:
        stores = await db.stores.find({}, {"_id": 0}).to_list(100)
    
    if not stores:
        print("❌ Aucun magasin trouvé")
        return
    
    for store in stores:
        store_id = store['id']
        store_name = store.get('name', 'Sans nom')
        print(f"\n{'─'*80}")
        print(f"🏪 MAGASIN: {store_name} (ID: {store_id})")
        print(f"{'─'*80}")
        
        # 1. Analyser les KPIs sellers
        seller_entries = await db.kpi_entries.find({
            "store_id": store_id,
            "date": {"$gte": period_start, "$lte": period_end}
        }, {"_id": 0}).to_list(10000)
        
        seller_ca_total = 0
        seller_ventes_total = 0
        seller_entries_by_date = {}
        seller_entries_by_seller = {}
        
        for entry in seller_entries:
            seller_id = entry.get('seller_id', 'unknown')
            date = entry.get('date', 'unknown')
            ca = entry.get('seller_ca') or entry.get('ca_journalier') or 0
            ventes = entry.get('nb_ventes') or 0
            
            seller_ca_total += ca
            seller_ventes_total += ventes
            
            if date not in seller_entries_by_date:
                seller_entries_by_date[date] = []
            seller_entries_by_date[date].append(entry)
            
            if seller_id not in seller_entries_by_seller:
                seller_entries_by_seller[seller_id] = []
            seller_entries_by_seller[seller_id].append(entry)
        
        print(f"\n📊 KPIs SELLERS (kpi_entries):")
        print(f"   • Nombre d'entrées: {len(seller_entries)}")
        print(f"   • CA total: {seller_ca_total:,.2f} €")
        print(f"   • Ventes totales: {seller_ventes_total}")
        print(f"   • Vendeurs uniques: {len(seller_entries_by_seller)}")
        print(f"   • Jours avec données: {len(seller_entries_by_date)}")
        
        # 2. Analyser les KPIs managers
        manager_entries = await db.manager_kpis.find({
            "store_id": store_id,
            "date": {"$gte": period_start, "$lte": period_end}
        }, {"_id": 0}).to_list(10000)
        
        manager_ca_total = 0
        manager_ventes_total = 0
        manager_entries_by_date = {}
        manager_entries_by_manager = {}
        
        for entry in manager_entries:
            manager_id = entry.get('manager_id', 'unknown')
            date = entry.get('date', 'unknown')
            ca = entry.get('ca_journalier') or 0
            ventes = entry.get('nb_ventes') or 0
            
            manager_ca_total += ca
            manager_ventes_total += ventes
            
            if date not in manager_entries_by_date:
                manager_entries_by_date[date] = []
            manager_entries_by_date[date].append(entry)
            
            if manager_id not in manager_entries_by_manager:
                manager_entries_by_manager[manager_id] = []
            manager_entries_by_manager[manager_id].append(entry)
        
        print(f"\n👔 KPIs MANAGERS (manager_kpis):")
        print(f"   • Nombre d'entrées: {len(manager_entries)}")
        print(f"   • CA total: {manager_ca_total:,.2f} €")
        print(f"   • Ventes totales: {manager_ventes_total}")
        print(f"   • Managers uniques: {len(manager_entries_by_manager)}")
        print(f"   • Jours avec données: {len(manager_entries_by_date)}")
        
        # 3. CA TOTAL CALCULÉ (comme dans le code actuel)
        total_ca_calculated = seller_ca_total + manager_ca_total
        total_ventes_calculated = seller_ventes_total + manager_ventes_total
        
        print(f"\n💰 CA TOTAL CALCULÉ (Sellers + Managers):")
        print(f"   • CA: {total_ca_calculated:,.2f} €")
        print(f"   • Ventes: {total_ventes_calculated}")
        
        # 4. VÉRIFICATION DES DOUBLONS POTENTIELS
        # Vérifier si un manager a aussi des entrées dans kpi_entries
        print(f"\n🔍 VÉRIFICATION DES DOUBLONS POTENTIELS:")
        
        # Récupérer les managers du magasin
        managers = await db.users.find({
            "store_id": store_id,
            "role": "manager",
            "status": "active"
        }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        
        potential_duplicates = []
        for manager in managers:
            manager_id = manager['id']
            manager_name = manager.get('name', 'Sans nom')
            
            # Vérifier si ce manager a des entrées dans kpi_entries
            manager_as_seller_entries = [e for e in seller_entries if e.get('seller_id') == manager_id]
            
            if manager_as_seller_entries:
                ca_as_seller = sum(e.get('seller_ca') or e.get('ca_journalier') or 0 for e in manager_as_seller_entries)
                potential_duplicates.append({
                    'manager_id': manager_id,
                    'manager_name': manager_name,
                    'entries_count': len(manager_as_seller_entries),
                    'ca_as_seller': ca_as_seller
                })
        
        if potential_duplicates:
            print(f"   ⚠️  ATTENTION: {len(potential_duplicates)} manager(s) ont aussi des KPIs en tant que seller:")
            for dup in potential_duplicates:
                print(f"      • {dup['manager_name']} (ID: {dup['manager_id']})")
                print(f"        → {dup['entries_count']} entrées, CA: {dup['ca_as_seller']:,.2f} €")
                print(f"        ⚠️  RISQUE DE DOUBLE COMPTAGE si ce manager saisit aussi dans manager_kpis!")
        else:
            print(f"   ✅ Aucun doublon détecté")
        
        # 5. VÉRIFICATION DES JOURS AVEC DONNÉES DES DEUX CÔTÉS
        common_dates = set(seller_entries_by_date.keys()) & set(manager_entries_by_date.keys())
        if common_dates:
            print(f"\n📅 JOURS AVEC DONNÉES SELLERS ET MANAGERS ({len(common_dates)} jours):")
            print(f"   ⚠️  Ces jours ont des données des deux côtés - vérifier qu'il n'y a pas de double comptage")
            if len(common_dates) <= 10:
                for date in sorted(common_dates):
                    seller_ca_day = sum(e.get('seller_ca') or e.get('ca_journalier') or 0 
                                      for e in seller_entries_by_date[date])
                    manager_ca_day = sum(e.get('ca_journalier') or 0 
                                       for e in manager_entries_by_date[date])
                    print(f"      • {date}: Sellers={seller_ca_day:,.2f}€, Managers={manager_ca_day:,.2f}€")
        
        # 6. VÉRIFICATION DES DONNÉES INCOHÉRENTES
        print(f"\n🔎 VÉRIFICATIONS DE COHÉRENCE:")
        
        # Vérifier les entrées avec CA = 0 mais ventes > 0
        zero_ca_with_sales = [e for e in seller_entries + manager_entries 
                             if (e.get('seller_ca') or e.get('ca_journalier') or 0) == 0 
                             and (e.get('nb_ventes') or 0) > 0]
        if zero_ca_with_sales:
            print(f"   ⚠️  {len(zero_ca_with_sales)} entrées avec CA=0 mais ventes>0")
        
        # Vérifier les entrées avec CA > 0 mais ventes = 0
        ca_without_sales = [e for e in seller_entries + manager_entries 
                          if (e.get('seller_ca') or e.get('ca_journalier') or 0) > 0 
                          and (e.get('nb_ventes') or 0) == 0]
        if ca_without_sales:
            print(f"   ⚠️  {len(ca_without_sales)} entrées avec CA>0 mais ventes=0")
        
        # Vérifier les valeurs négatives
        negative_ca = [e for e in seller_entries + manager_entries 
                      if (e.get('seller_ca') or e.get('ca_journalier') or 0) < 0]
        if negative_ca:
            print(f"   ⚠️  {len(negative_ca)} entrées avec CA négatif")
        
        # 7. COMPARAISON AVEC LE CALCUL BACKEND
        # Utiliser la même logique que get_store_stats
        period_sellers_agg = await db.kpi_entries.aggregate([
            {"$match": {"store_id": store_id, "date": {"$gte": period_start, "$lte": period_end}}},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
            }}
        ]).to_list(1)
        
        period_managers_agg = await db.manager_kpis.aggregate([
            {"$match": {"store_id": store_id, "date": {"$gte": period_start, "$lte": period_end}}},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
            }}
        ]).to_list(1)
        
        backend_seller_ca = period_sellers_agg[0].get("total_ca", 0) if period_sellers_agg else 0
        backend_manager_ca = period_managers_agg[0].get("total_ca", 0) if period_managers_agg else 0
        backend_total_ca = backend_seller_ca + backend_manager_ca
        
        print(f"\n🔧 CALCUL BACKEND (via aggregation MongoDB):")
        print(f"   • CA Sellers (agg): {backend_seller_ca:,.2f} €")
        print(f"   • CA Managers (agg): {backend_manager_ca:,.2f} €")
        print(f"   • CA Total (agg): {backend_total_ca:,.2f} €")
        
        # Comparer avec le calcul manuel
        if abs(total_ca_calculated - backend_total_ca) > 0.01:
            print(f"\n   ❌ ERREUR: Différence entre calcul manuel et aggregation!")
            print(f"      Manuel: {total_ca_calculated:,.2f} €")
            print(f"      Aggregation: {backend_total_ca:,.2f} €")
            print(f"      Différence: {abs(total_ca_calculated - backend_total_ca):,.2f} €")
        else:
            print(f"\n   ✅ Les calculs correspondent")
        
        # 8. RÉSUMÉ
        print(f"\n📋 RÉSUMÉ:")
        print(f"   • CA affiché dans le dashboard: {backend_total_ca:,.2f} €")
        print(f"   • Ventes affichées: {total_ventes_calculated}")
        if potential_duplicates:
            total_duplicate_ca = sum(d['ca_as_seller'] for d in potential_duplicates)
            print(f"   ⚠️  CA potentiellement dupliqué: {total_duplicate_ca:,.2f} €")
            print(f"      (Si ces managers saisissent aussi dans manager_kpis)")
    
    await database.disconnect()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Analyser les sommes CA des magasins")
    parser.add_argument("--store-id", type=str, help="ID du magasin à analyser (optionnel)")
    parser.add_argument("--period", type=str, choices=['week', 'month', 'year'], default='month', 
                       help="Type de période (default: month)")
    parser.add_argument("--offset", type=int, default=0, 
                       help="Offset de période (0=actuel, -1=précédent, etc.)")
    
    args = parser.parse_args()
    
    asyncio.run(analyze_store_ca(
        store_id=args.store_id,
        period_type=args.period,
        period_offset=args.offset
    ))
