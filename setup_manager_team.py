import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import uuid
import random
from passlib.context import CryptContext

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client.retail_coach

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Noms français pour les vendeurs
PRENOMS = ["Sophie", "Lucas", "Marie", "Thomas", "Camille", "Alexandre"]
NOMS = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Petit"]

# Profils DISC variés
PROFILS_DISC = [
    {
        "dominance": 75, "influence": 60, "stabilite": 40, "conformite": 35,
        "profil_principal": "Dominance", "profil_secondaire": "Influence",
        "forces": ["Leadership naturel", "Prise de décision rapide", "Orientation résultats"],
        "axes_amelioration": ["Écoute active", "Patience avec les détails", "Collaboration"],
        "style_communication": "Direct et concis",
        "environnement_ideal": "Autonomie et challenges"
    },
    {
        "dominance": 65, "influence": 80, "stabilite": 55, "conformite": 30,
        "profil_principal": "Influence", "profil_secondaire": "Dominance",
        "forces": ["Communication persuasive", "Enthousiasme contagieux", "Relation client"],
        "axes_amelioration": ["Organisation", "Suivi administratif", "Concentration"],
        "style_communication": "Chaleureux et expressif",
        "environnement_ideal": "Interaction sociale et reconnaissance"
    },
    {
        "dominance": 30, "influence": 45, "stabilite": 85, "conformite": 60,
        "profil_principal": "Stabilité", "profil_secondaire": "Conformité",
        "forces": ["Fiabilité", "Écoute empathique", "Travail d'équipe"],
        "axes_amelioration": ["Assertivité", "Gestion du changement", "Prise d'initiative"],
        "style_communication": "Calme et patient",
        "environnement_ideal": "Stabilité et harmonie"
    },
    {
        "dominance": 35, "influence": 40, "stabilite": 55, "conformite": 85,
        "profil_principal": "Conformité", "profil_secondaire": "Stabilité",
        "forces": ["Précision", "Analyse détaillée", "Respect des process"],
        "axes_amelioration": ["Flexibilité", "Prise de risque", "Communication émotionnelle"],
        "style_communication": "Précis et structuré",
        "environnement_ideal": "Clarté des règles et standards"
    },
    {
        "dominance": 70, "influence": 70, "stabilite": 50, "conformite": 40,
        "profil_principal": "Dominance", "profil_secondaire": "Influence",
        "forces": ["Dynamisme", "Persuasion", "Gestion de la pression"],
        "axes_amelioration": ["Écoute prolongée", "Patience", "Analyse approfondie"],
        "style_communication": "Énergique et motivant",
        "environnement_ideal": "Compétition et reconnaissance"
    },
    {
        "dominance": 50, "influence": 75, "stabilite": 70, "conformite": 45,
        "profil_principal": "Influence", "profil_secondaire": "Stabilité",
        "forces": ["Médiation", "Optimisme", "Support d'équipe"],
        "axes_amelioration": ["Fermeté", "Gestion des conflits", "Organisation"],
        "style_communication": "Encourageant et positif",
        "environnement_ideal": "Environnement collaboratif"
    }
]

async def create_sellers_for_manager(manager_email: str):
    """Crée 6 vendeurs avec données complètes pour un manager"""
    
    # 1. Trouver le manager
    manager = await db.users.find_one({"email": manager_email, "role": "manager"}, {"_id": 0})
    if not manager:
        print(f"❌ Manager {manager_email} non trouvé")
        return
    
    print(f"✅ Manager trouvé: {manager['name']} (ID: {manager['id']})")
    print(f"   Workspace: {manager['workspace_id']}")
    
    workspace = await db.workspaces.find_one({"id": manager['workspace_id']}, {"_id": 0})
    if not workspace:
        print(f"❌ Workspace non trouvé")
        return
    
    print(f"✅ Workspace: {workspace['name']}")
    
    # 2. Créer 6 vendeurs
    sellers_created = []
    
    for i in range(6):
        seller_id = str(uuid.uuid4())
        prenom = PRENOMS[i]
        nom = NOMS[i]
        email = f"{prenom.lower()}.{nom.lower()}@skyco.fr"
        
        seller = {
            "id": seller_id,
            "email": email,
            "password": pwd_context.hash("password123"),
            "name": f"{prenom} {nom}",
            "role": "seller",
            "workspace_id": manager['workspace_id'],
            "manager_id": manager['id'],
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "diagnostic_completed": True
        }
        
        await db.users.insert_one(seller)
        sellers_created.append(seller)
        print(f"✅ Vendeur créé: {seller['name']} ({email})")
        
        # 3. Créer le diagnostic DISC
        profil = PROFILS_DISC[i]
        diagnostic = {
            "id": str(uuid.uuid4()),
            "user_id": seller_id,
            "workspace_id": manager['workspace_id'],
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(30, 60))).isoformat(),
            **profil
        }
        await db.diagnostics.insert_one(diagnostic)
        print(f"   ✓ Diagnostic DISC créé ({profil['profil_principal']})")
        
        # 4. Créer des KPI sur 6 mois
        kpi_count = 0
        for month_offset in range(6):
            date_debut = datetime.now(timezone.utc) - timedelta(days=30 * (6 - month_offset))
            
            # 3-5 entrées KPI par mois
            for _ in range(random.randint(3, 5)):
                date_kpi = date_debut + timedelta(days=random.randint(0, 28))
                
                # KPI réalistes basés sur le profil
                base_ca = random.randint(2000, 8000)
                nb_ventes = random.randint(5, 20)
                taux_conversion = random.randint(15, 45)
                panier_moyen = base_ca / nb_ventes if nb_ventes > 0 else 0
                
                kpi = {
                    "id": str(uuid.uuid4()),
                    "seller_id": seller_id,
                    "workspace_id": manager['workspace_id'],
                    "date": date_kpi.date().isoformat(),
                    "kpi_data": {
                        "chiffre_affaires": round(base_ca, 2),
                        "nombre_ventes": nb_ventes,
                        "panier_moyen": round(panier_moyen, 2),
                        "taux_conversion": taux_conversion,
                        "nombre_clients": random.randint(50, 150)
                    },
                    "created_at": date_kpi.isoformat(),
                    "updated_at": date_kpi.isoformat()
                }
                
                await db.kpis.insert_one(kpi)
                kpi_count += 1
        
        print(f"   ✓ {kpi_count} entrées KPI créées sur 6 mois")
    
    print(f"\n🎉 Terminé ! 6 vendeurs créés avec diagnostics et KPI")
    print(f"   Manager: {manager['name']}")
    print(f"   Vendeurs: {', '.join([s['name'] for s in sellers_created])}")

async def main():
    try:
        await create_sellers_for_manager("y.legoff@skyco.fr")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
