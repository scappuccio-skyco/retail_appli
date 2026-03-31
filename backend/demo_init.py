"""
Script de seeding des données de démonstration.

Usage : python backend/scripts/seed_demo.py

Crée (ou recrée) un espace démo complet :
  - 1 workspace + 1 gérant
  - 1 store + 1 manager (avec diagnostic DISC)
  - 4 vendeurs (profils DISC D/I/S/C) avec diagnostics
  - 30 jours de KPIs
  - 2 objectifs, 5 morning briefs, 2 bilans équipe, 1 analyse équipe
  - 8 debriefs (2 par vendeur), 4 compatibility advices

Idempotent : relancer le script repart de zéro sur les données démo.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Permet d'importer les modules du backend
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env", override=False)

from motor.motor_asyncio import AsyncIOMotorClient

# ── IDs fixes (déterministes) ─────────────────────────────────────────────────
DEMO_WORKSPACE_ID  = "demo-workspace-001"
DEMO_GERANT_ID     = "demo-gerant-001"
DEMO_STORE_ID      = "demo-store-001"
DEMO_MANAGER_ID    = "demo-manager-001"
DEMO_SELLER_T      = "demo-seller-thomas"   # D – Dynamique
DEMO_SELLER_E      = "demo-seller-emma"     # I – Influent
DEMO_SELLER_L      = "demo-seller-lucas"    # S – Stable
DEMO_SELLER_C      = "demo-seller-clara"    # C – Consciencieux

SELLERS = [
    {"id": DEMO_SELLER_T, "name": "Thomas Durand",  "email": "demo-seller-thomas@demo.retailperformerai.com", "disc": "D"},
    {"id": DEMO_SELLER_E, "name": "Emma Martin",    "email": "demo-seller-emma@demo.retailperformerai.com",   "disc": "I"},
    {"id": DEMO_SELLER_L, "name": "Lucas Petit",    "email": "demo-seller-lucas@demo.retailperformerai.com",  "disc": "S"},
    {"id": DEMO_SELLER_C, "name": "Clara Rousseau", "email": "demo-seller-clara@demo.retailperformerai.com",  "disc": "C"},
]

NOW = datetime.now(timezone.utc)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def upsert(col, doc: dict):
    """Remplace le document par son id (upsert)."""
    await col.replace_one({"id": doc["id"]}, doc, upsert=True)


def days_ago(n: int) -> datetime:
    return NOW - timedelta(days=n)


def date_str(n: int) -> str:
    return (NOW - timedelta(days=n)).strftime("%Y-%m-%d")


def kpi_for(seller_disc: str, day_idx: int, day_of_week: int, seasonal_mult: float = 1.0) -> dict:
    """
    Génère des KPIs déterministes selon le profil DISC et le jour.
    day_idx : 1 = hier, 30 = il y a 30 jours
    day_of_week : 0=lundi … 6=dimanche
    """
    is_weekend = day_of_week >= 5
    wave = (day_idx % 7)  # variation cyclique sur la semaine

    profiles = {
        "D": dict(base_prospects=18, base_ventes=11, base_ca=1050, panier=95),
        "I": dict(base_prospects=22, base_ventes=13, base_ca=920,  panier=75),
        "S": dict(base_prospects=15, base_ventes=8,  base_ca=720,  panier=90),
        "C": dict(base_prospects=11, base_ventes=7,  base_ca=880,  panier=130),
    }
    p = profiles[seller_disc]

    mult = (1.5 if is_weekend else 1.0) * seasonal_mult
    nb_prospects = int((p["base_prospects"] + wave) * mult)
    nb_ventes    = int((p["base_ventes"]    + wave // 2) * mult)
    nb_articles  = int(nb_ventes * (1.4 + wave * 0.05))
    ca           = round((p["base_ca"] + wave * 30) * mult, 2)
    panier_moyen = round(ca / nb_ventes, 2) if nb_ventes else 0
    taux         = round(nb_ventes / nb_prospects * 100, 1) if nb_prospects else 0
    indice       = round(nb_articles / nb_ventes, 2) if nb_ventes else 0

    return dict(
        ca_journalier=ca,
        nb_ventes=nb_ventes,
        nb_clients=nb_ventes,
        nb_articles=nb_articles,
        nb_prospects=nb_prospects,
        panier_moyen=panier_moyen,
        taux_transformation=taux,
        indice_vente=indice,
    )


# ── Données textuelles réalistes ──────────────────────────────────────────────

BRIEF_TEXTS = [
    "Bonne dynamique cette semaine. Thomas et Emma sont au-dessus de leurs objectifs de conversion. "
    "Rappel : focus UPT aujourd'hui, pensez aux ventes complémentaires. Objectif CA journalier : 4 500 €.",

    "Journée chargée prévue. Samedi dernier a bien performé (+18% vs S-1). "
    "Clara : excellent panier moyen la semaine passée, continuez sur cette lancée. "
    "Lucas : travaillez l'accroche client dès l'entrée boutique.",

    "Point mi-semaine. Nous sommes à 68% de l'objectif mensuel à J+15. "
    "Il faut accélérer sur les 15 prochains jours. Thomas : bravo pour le closing d'hier. "
    "Emma : attention au taux de transformation, restons concentrés.",

    "Début de semaine, rechargez les batteries ! Objectif collectif : 22 500 € cette semaine. "
    "Rappel formation closing vendredi 17h. Présence obligatoire pour tous.",

    "Excellente semaine derrière nous, +12% vs objectif. "
    "On maintient l'élan. Focus aujourd'hui : accueil premium et découverte des besoins. "
    "Chaque client est une opportunité, soyez présents et proactifs.",

    "Mois de janvier difficile mais l'équipe reste solide. Le flux client est plus faible, "
    "compensez par une qualité de service maximale. Clara : excellent travail sur le panier moyen ce mois-ci. "
    "Objectif du jour : 3 800 €. Chaque vente compte.",

    "Premier lundi de février — les soldes se terminent, retour aux fondamentaux. "
    "Thomas et Emma ont excellé pendant les soldes, capitalisons sur cet élan. "
    "Lucas : belle progression sur le taux de transformation (+5 pts vs janvier). Continuez !",

    "Mi-mars, la boutique retrouve un bon flux avec le printemps. "
    "Les nouvelles collections attirent une clientèle curieuse — c'est le moment de briller. "
    "Focus ventes additionnelles : accessoires et seconde pièce. Objectif : 5 000 € aujourd'hui.",

    "Semaine post-inventaire. L'équipe a été exemplaire pendant la fermeture. "
    "Clara a finalisé les fiches produit — distribuez-les ce matin. "
    "Emma : ton binôme avec Lucas la semaine dernière a généré +22% de paniers à 2 articles. Reproduire !",

    "Beau démarrage d'avril. Le flux client est au plus haut depuis septembre. "
    "Thomas : tu es à 103% de ton objectif mensuel à J+8, bravo ! "
    "Concentrez-vous sur la fidélisation — proposez la carte de fidélité à chaque client.",

    "Dernier lundi du mois — on pousse fort ! Il reste 12 000 € à faire pour atteindre l'objectif mensuel. "
    "Mobilisation générale. Chaque prospect compte, chaque vente compte. "
    "Je suis disponible pour coacher quiconque en a besoin aujourd'hui.",

    "Bilan de mi-parcours : l'équipe est à +8% vs les 6 mois de l'an dernier. "
    "C'est le résultat de votre travail quotidien. Félicitations à tous. "
    "Cette semaine : focus sur les clients récurrents — appelez ceux qui n'ont pas visité depuis 30 jours.",
]

BILAN_SYNTHESES = [
    "Semaine solide dans l'ensemble. L'équipe a atteint 94% de l'objectif CA avec une belle régularité "
    "de Thomas et une progression notable d'Emma sur le taux de transformation (+4 pts vs S-1). "
    "Lucas reste constant mais doit travailler l'indice de vente. Clara performe sur le panier moyen "
    "mais son volume de prospects reste faible — à stimuler.",

    "Semaine en légère baisse (-6% CA vs S-1) due au flux client réduit en début de semaine. "
    "La qualité de vente reste bonne (panier moyen stable). Thomas a eu sa meilleure journée du mois jeudi. "
    "Point de vigilance : Lucas et Clara ont besoin d'un accompagnement sur l'argumentation produit.",

    "Mois de janvier clôturé à 87% de l'objectif. Les soldes ont sauvé la dernière semaine. "
    "Emma a progressé de manière spectaculaire sur les ventes additionnelles (+30% d'articles par vente). "
    "Thomas montre des signes de baisse de motivation — prévoir un entretien individuel en février.",

    "Février : bonne surprise malgré un flux client modéré. Le panier moyen de l'équipe atteint un record à 103€. "
    "Clara est la surprise du mois — son taux de transformation est passé de 58% à 67%. "
    "Lucas : point de blocage sur la proposition premium, travailler l'argumentation valeur.",

    "Mars : démarrage de saison réussi. CA à 112% de l'objectif grâce à un flux client exceptionnel. "
    "L'équipe a bien géré l'afflux. Thomas a guidé naturellement ses collègues — potentiel de tuteur identifié. "
    "Clara a rassuré plusieurs clients hésitants grâce à sa maîtrise technique — à valoriser.",

    "Avril : meilleur mois depuis l'ouverture. +18% vs avril N-1. "
    "L'ensemble de l'équipe a progressé. Emma atteint pour la première fois 70% de taux de transformation. "
    "Thomas a réalisé 3 ventes à plus de 400€ dans la semaine — nouveau record personnel. "
    "Prochain défi : maintenir ce niveau en mai avec un flux client en baisse prévisible.",
]

TEAM_ANALYSIS_SYNTHESE = (
    "L'équipe présente un bon équilibre de profils DISC. Thomas (D) tire la performance individuelle vers le haut "
    "et peut servir de référence sur le closing. Emma (I) excelle dans la relation client et la fidélisation. "
    "Lucas (S) assure la stabilité collective mais manque d'assertivité en phase de closing. "
    "Clara (C) apporte une rigueur précieuse sur la connaissance produit, mais doit gagner en spontanéité client. "
    "Recommandation : binômer Thomas/Lucas et Emma/Clara pour un transfert de compétences naturel."
)

DEBRIEF_DATA = {
    DEMO_SELLER_T: [
        dict(type="success", synthese="Belle vente consultative. Thomas a parfaitement identifié le besoin latent du client "
             "et proposé une solution premium. Excellent closing en 3 étapes. CA : 380€, indice vente : 2.5.",
             axes=["Maintenir ce niveau de découverte des besoins", "Capitaliser sur les ventes complémentaires"]),
        dict(type="failure", synthese="Vente non conclue malgré un bon démarrage. Le client a hésité sur le prix. "
             "Thomas a manqué d'arguments sur la valeur ajoutée et n'a pas proposé d'alternative.",
             axes=["Travailler les réponses aux objections prix", "Préparer 2-3 alternatives produit"]),
        dict(type="success", synthese="Thomas a réalisé une vente à 520€ sur une cliente venue chercher un cadeau. "
             "Il a parfaitement cerné le budget et proposé la pièce maîtresse de la nouvelle collection. "
             "La cliente est repartie avec un sourire et a demandé sa carte de fidélité.",
             axes=["Reproduire la détection budget dès l'accueil", "Proposer systématiquement la carte fidélité"]),
        dict(type="failure", synthese="Lundi difficile pour Thomas — 4 prospects, 0 vente. "
             "Le profil D le pousse à aller trop vite en closing. Les clients ont senti la pression.",
             axes=["Ralentir le rythme sur les clients hésitants", "Pratiquer l'écoute active 3 min avant toute proposition"]),
    ],
    DEMO_SELLER_E: [
        dict(type="success", synthese="Emma a créé une relation de confiance immédiate. Le client est reparti avec "
             "3 articles au lieu d'1. Belle maîtrise des ventes additionnelles et du cross-selling.",
             axes=["Reproduire cette approche relationnelle", "Développer encore le closing"]),
        dict(type="failure", synthese="Interaction longue (25 min) sans achat. Emma s'est trop focalisée sur l'échange "
             "relationnel au détriment de la phase de closing.",
             axes=["Équilibrer relation et efficacité commerciale", "Introduire la proposition d'achat plus tôt"]),
        dict(type="success", synthese="Très belle interaction avec un client régulier. Emma s'est souvenue de ses achats "
             "précédents et a proposé des pièces complémentaires. Vente à 290€, panier à 3 articles.",
             axes=["Capitaliser sur la mémoire client", "Créer un carnet de notes sur les clients VIP"]),
        dict(type="failure", synthese="Emma a perdu un client pendant la période d'attente en caisse. "
             "Elle était en conversation avec une autre cliente et n'a pas délégué.",
             axes=["Gérer les situations multi-clients", "Signaler au manager quand débordée"]),
    ],
    DEMO_SELLER_L: [
        dict(type="success", synthese="Lucas a bien géré une situation de réclamation client et transformé l'insatisfaction "
             "en rachat. Belle preuve de résilience et d'empathie.",
             axes=["Reproduire cette gestion du conflit", "Développer la vente additionnelle en sortie de réclamation"]),
        dict(type="failure", synthese="Lucas n'a pas osé proposer le produit premium alors que le client semblait réceptif. "
             "Manque de confiance en phase d'argumentation.",
             axes=["Travailler la présentation des gammes premium", "Oser proposer sans attendre le signal d'achat explicite"]),
        dict(type="success", synthese="Progression notable de Lucas ce mois-ci. Il a initié 3 ventes additionnelles "
             "sans y être invité — c'était son point faible. Panier moyen en hausse de 15% vs mois dernier.",
             axes=["Ancrer cette nouvelle habitude de proposition", "Viser l'indice de vente à 1.8"]),
        dict(type="failure", synthese="Lucas est arrivé en retard lundi et cela a impacté son énergie toute la journée. "
             "CA journalier à 45% de son objectif. Entretien de soutien prévu.",
             axes=["Rituel de préparation avant l'ouverture", "Identifier les facteurs de démotivation"]),
    ],
    DEMO_SELLER_C: [
        dict(type="success", synthese="Clara a su rassurer un client très hésitant grâce à une présentation technique "
             "irréprochable. Le client est reparti avec le produit le plus cher de la gamme.",
             axes=["Capitaliser sur l'expertise technique", "Accélérer la phase de découverte"]),
        dict(type="failure", synthese="Vente perdue car Clara a passé trop de temps en argumentation sans détecter "
             "que le client était déjà convaincu et attendait juste qu'on lui propose de passer en caisse.",
             axes=["Mieux lire les signaux d'achat", "Raccourcir l'argumentation quand le besoin est identifié"]),
        dict(type="success", synthese="Clara a géré 8 clients en 4h samedi avec un taux de transformation de 75%. "
             "Sa rigueur et sa maîtrise produit lui permettent d'être efficace même sous pression.",
             axes=["Transmettre sa méthode à Lucas", "Maintenir cette performance en période calme"]),
        dict(type="failure", synthese="Clara n'a pas adapté son discours très technique à une cliente visiblement novice. "
             "La cliente est repartie sans acheter, submergée par les informations.",
             axes=["Adapter le niveau de discours au profil client", "Commencer par des questions simples de découverte"]),
    ],
}


# ── Seed functions ────────────────────────────────────────────────────────────

async def seed(db):
    print("🌱 Seeding demo data...")

    # ── 1. Workspace ──────────────────────────────────────────────────────────
    await upsert(db["workspaces"], {
        "id": DEMO_WORKSPACE_ID,
        "name": "Maison Lumière (Démo)",
        "gerant_id": DEMO_GERANT_ID,
        "created_at": days_ago(90),
        "subscription_status": "active",
        "trial_start": days_ago(90),
        "trial_end": days_ago(90) + timedelta(days=365),
        "ai_credits_remaining": 999,
        "is_demo": True,
        "settings": {"max_users": 50, "features": ["basic", "ai_coaching", "diagnostics"]},
    })

    # ── 2. Gérant ─────────────────────────────────────────────────────────────
    await upsert(db["users"], {
        "id": DEMO_GERANT_ID,
        "name": "Marie Fontaine",
        "email": "demo-gerant@demo.retailperformerai.com",
        "password": "demo_hashed_password",
        "role": "gerant",
        "status": "active",
        "workspace_id": DEMO_WORKSPACE_ID,
        "gerant_id": DEMO_GERANT_ID,
        "is_demo": True,
        "created_at": days_ago(90),
    })

    # ── 3. Store ──────────────────────────────────────────────────────────────
    await upsert(db["stores"], {
        "id": DEMO_STORE_ID,
        "name": "Maison Lumière – Paris 6e",
        "location": "Paris 6e",
        "address": "12 rue de Rennes, 75006 Paris",
        "gerant_id": DEMO_GERANT_ID,
        "active": True,
        "is_demo": True,
        "created_at": days_ago(90),
        "business_context": {
            "type_commerce": "Boutique de prêt-à-porter haut de gamme",
            "positionnement": "Premium",
            "clientele_cible": "CSP+ 30-55 ans, sensibles à la qualité et au service",
            "format_magasin": "Boutique physique 120m²",
            "duree_vente": "15-25 minutes",
            "kpi_prioritaire": "Panier moyen et taux de transformation",
            "saisonnalite": "Pics en septembre/octobre et mars/avril",
            "contexte_libre": "Flux naturel de clients, pas de prospection active. Importance du conseil personnalisé.",
        },
    })

    # ── 4. Manager ────────────────────────────────────────────────────────────
    await upsert(db["users"], {
        "id": DEMO_MANAGER_ID,
        "name": "Sarah Benali",
        "email": "demo-manager@demo.retailperformerai.com",
        "password": "demo_hashed_password",
        "role": "manager",
        "status": "active",
        "gerant_id": DEMO_GERANT_ID,
        "store_id": DEMO_STORE_ID,
        "store_ids": [DEMO_STORE_ID],
        "workspace_id": DEMO_WORKSPACE_ID,
        "is_demo": True,
        "created_at": days_ago(60),
    })

    # Manager diagnostic DISC
    await upsert(db["manager_diagnostics"], {
        "id": f"demo-mgr-diag-001",
        "manager_id": DEMO_MANAGER_ID,
        "store_id": DEMO_STORE_ID,
        "responses": {},
        "profil_nom": "Le Coach",
        "profil_description": "Sarah combine vision stratégique et proximité terrain. Elle sait adapter son style à chaque vendeur tout en maintenant un cap clair sur les objectifs.",
        "force_1": "Écoute active et feedback constructif",
        "force_2": "Capacité à motiver par l'exemple",
        "axe_progression": "Déléguer davantage pour développer l'autonomie de l'équipe",
        "recommandation": "Mettre en place des rituels hebdomadaires courts (15 min) avec chaque vendeur.",
        "exemple_concret": "Débrief individuel chaque vendredi pour ancrer les apprentissages.",
        "disc_dominant": "D/I",
        "disc_percentages": {"D": 35, "I": 30, "S": 20, "C": 15},
        "manager_style": "Coach",
        "is_demo": True,
        "created_at": days_ago(45),
    })

    # ── 5. Vendeurs + diagnostics ─────────────────────────────────────────────
    disc_configs = {
        "D": dict(style="Dynamique", level="Maître du Jeu", motivation="Performance",
                  scores=dict(accueil=7.5, decouverte=8.0, argumentation=9.0, closing=9.5, fidelisation=6.5),
                  disc_pct={"D": 45, "I": 25, "S": 15, "C": 15}),
        "I": dict(style="Convivial",  level="Ambassadeur",  motivation="Relation",
                  scores=dict(accueil=9.5, decouverte=8.5, argumentation=7.5, closing=7.0, fidelisation=9.0),
                  disc_pct={"D": 15, "I": 45, "S": 25, "C": 15}),
        "S": dict(style="Discret",    level="Challenger",   motivation="Reconnaissance",
                  scores=dict(accueil=8.0, decouverte=7.0, argumentation=7.0, closing=6.5, fidelisation=8.5),
                  disc_pct={"D": 15, "I": 20, "S": 45, "C": 20}),
        "C": dict(style="Explorateur", level="Ambassadeur", motivation="Découverte",
                  scores=dict(accueil=7.0, decouverte=9.0, argumentation=8.5, closing=7.0, fidelisation=8.0),
                  disc_pct={"D": 10, "I": 15, "S": 25, "C": 50}),
    }

    for s in SELLERS:
        await upsert(db["users"], {
            "id": s["id"],
            "name": s["name"],
            "email": s["email"],
            "password": "demo_hashed_password",
            "role": "seller",
            "status": "active",
            "gerant_id": DEMO_GERANT_ID,
            "store_id": DEMO_STORE_ID,
            "manager_id": DEMO_MANAGER_ID,
            "workspace_id": DEMO_WORKSPACE_ID,
            "is_demo": True,
            "created_at": days_ago(55),
        })

        cfg = disc_configs[s["disc"]]
        await upsert(db["diagnostics"], {
            "id": f"demo-diag-{s['id']}",
            "seller_id": s["id"],
            "responses": {},
            "ai_profile_summary": f"{s['name']} présente un profil {cfg['style']} marqué. "
                                   f"Sa motivation principale est la {cfg['motivation'].lower()}. "
                                   f"Point fort : {'closing' if s['disc'] == 'D' else 'relation client' if s['disc'] == 'I' else 'régularité' if s['disc'] == 'S' else 'argumentation technique'}.",
            "style": cfg["style"],
            "level": cfg["level"],
            "motivation": cfg["motivation"],
            "score_accueil": cfg["scores"]["accueil"],
            "score_decouverte": cfg["scores"]["decouverte"],
            "score_argumentation": cfg["scores"]["argumentation"],
            "score_closing": cfg["scores"]["closing"],
            "score_fidelisation": cfg["scores"]["fidelisation"],
            "disc_dominant": s["disc"],
            "disc_percentages": cfg["disc_pct"],
            "is_demo": True,
            "created_at": days_ago(50),
        })

    # ── 6. KPI config magasin ─────────────────────────────────────────────────
    await db["kpi_configs"].replace_one(
        {"store_id": DEMO_STORE_ID},
        {
            "store_id": DEMO_STORE_ID,
            "enabled": True,
            "saisie_enabled": True,
            "seller_track_ca": True,
            "seller_track_ventes": True,
            "seller_track_articles": True,
            "seller_track_prospects": True,
            "manager_track_ca": True,
            "manager_track_ventes": True,
            "manager_track_articles": False,
            "manager_track_prospects": False,
            "is_demo": True,
            "updated_at": days_ago(30),
        },
        upsert=True,
    )

    # ── 7. KPIs (183 jours × 4 vendeurs — 6 mois) ────────────────────────────
    kpi_docs = []
    for day_idx in range(1, 184):
        date = NOW - timedelta(days=day_idx)
        date_s = date.strftime("%Y-%m-%d")
        dow = date.weekday()
        for s in SELLERS:
            # Trend saisonnier : croissance progressive sur 6 mois (+20% au global)
            seasonal_mult = 1.0 + (183 - day_idx) / 183 * 0.20
            k = kpi_for(s["disc"], day_idx, dow, seasonal_mult)
            kpi_docs.append({
                "id": f"demo-kpi-{s['id']}-{date_s}",
                "seller_id": s["id"],
                "store_id": DEMO_STORE_ID,
                "date": date_s,
                "ts": date,
                "is_demo": True,
                "source": "manual",
                "locked": False,
                "created_at": date,
                **k,
            })

    # Time-series collection : delete + insert (replace_one non supporté)
    await db["kpi_entries"].delete_many({"is_demo": True})
    if kpi_docs:
        await db["kpi_entries"].insert_many(kpi_docs)

    # ── 8. Objectifs (mois courant + 2 mois passés résolus) ──────────────────
    month_start = NOW.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)

    for i, (title, kpi, target, status) in enumerate([
        ("CA mensuel équipe — avril", "ca_journalier", 90000, "active"),
        ("Panier moyen ≥ 95€", "panier_moyen", 95, "achieved"),
        ("Taux de transformation ≥ 65%", "taux_transformation", 65, "active"),
    ]):
        await upsert(db["objectives"], {
            "id": f"demo-obj-{i+1:03d}",
            "manager_id": DEMO_MANAGER_ID,
            "store_id": DEMO_STORE_ID,
            "gerant_id": DEMO_GERANT_ID,
            "title": title,
            "type": "kpi_standard",
            "kpi_key": kpi,
            "target_value": target,
            "period_start": month_start.strftime("%Y-%m-%d"),
            "period_end": month_end.strftime("%Y-%m-%d"),
            "status": status,
            "is_demo": True,
            "created_at": month_start,
        })

    # Objectif du mois passé — atteint
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
    prev_month_end = month_start - timedelta(seconds=1)
    await upsert(db["objectives"], {
        "id": "demo-obj-004",
        "manager_id": DEMO_MANAGER_ID,
        "store_id": DEMO_STORE_ID,
        "gerant_id": DEMO_GERANT_ID,
        "title": "CA mensuel équipe — mars",
        "type": "kpi_standard",
        "kpi_key": "ca_journalier",
        "target_value": 85000,
        "period_start": prev_month_start.strftime("%Y-%m-%d"),
        "period_end": prev_month_end.strftime("%Y-%m-%d"),
        "status": "achieved",
        "is_demo": True,
        "created_at": prev_month_start,
    })

    # ── 9. Morning briefs (12 — espacés sur 3 mois) ───────────────────────────
    brief_days = [1, 4, 8, 12, 16, 21, 26, 32, 39, 47, 56, 68]
    for i, (text, d) in enumerate(zip(BRIEF_TEXTS, brief_days)):
        await upsert(db["morning_briefs"], {
            "id": f"demo-brief-{i+1:03d}",
            "manager_id": DEMO_MANAGER_ID,
            "store_id": DEMO_STORE_ID,
            "content": text,
            "objective_daily": 4500,
            "is_demo": True,
            "created_at": days_ago(d),
        })

    # ── 10. Bilans équipe (6 mois) ────────────────────────────────────────────
    bilan_days = [7, 14, 45, 75, 105, 135]
    for i, (synthese, d) in enumerate(zip(BILAN_SYNTHESES, bilan_days)):
        await upsert(db["team_bilans"], {
            "id": f"demo-bilan-{i+1:03d}",
            "manager_id": DEMO_MANAGER_ID,
            "store_id": DEMO_STORE_ID,
            "gerant_id": DEMO_GERANT_ID,
            "synthese": synthese,
            "periode": f"Période {i+1}",
            "is_demo": True,
            "created_at": days_ago(d),
        })

    # ── 11. Analyse équipe ────────────────────────────────────────────────────
    await upsert(db["team_analyses"], {
        "id": "demo-team-analysis-001",
        "manager_id": DEMO_MANAGER_ID,
        "store_id": DEMO_STORE_ID,
        "synthese": TEAM_ANALYSIS_SYNTHESE,
        "analyses_vendeurs": [
            {"seller_id": s["id"], "seller_name": s["name"],
             "note": f"Profil {disc_configs[s['disc']]['style']} — {disc_configs[s['disc']]['level']}"}
            for s in SELLERS
        ],
        "kpi_resume": {"ca_total": 68420, "panier_moyen_equipe": 97.5, "taux_transfo_moyen": 62.3},
        "is_demo": True,
        "created_at": days_ago(3),
    })

    # ── 12. Debriefs (4 par vendeur) ──────────────────────────────────────────
    debrief_offsets = [3, 14, 35, 60]
    for s in SELLERS:
        for j, d in enumerate(DEBRIEF_DATA[s["id"]]):
            await upsert(db["debriefs"], {
                "id": f"demo-debrief-{s['id']}-{j+1}",
                "seller_id": s["id"],
                "manager_id": DEMO_MANAGER_ID,
                "store_id": DEMO_STORE_ID,
                "type": d["type"],
                "synthese": d["synthese"],
                "axes_progression": d["axes"],
                "is_demo": True,
                "created_at": days_ago(debrief_offsets[j]),
            })

    # ── 13. Compatibility advices ─────────────────────────────────────────────
    compat_texts = {
        DEMO_SELLER_T: ("Avec Thomas (D), soyez direct et orienté résultats. Fixez des objectifs ambitieux et reconnaissez publiquement ses succès.",
                        ["Fixer des défis stimulants", "Feedback immédiat et factuel"]),
        DEMO_SELLER_E: ("Emma (I) a besoin de reconnaissance sociale. Célébrez ses réussites en groupe et donnez-lui de la visibilité.",
                        ["Briefings collectifs enthousiastes", "Valoriser son rôle de référent relation client"]),
        DEMO_SELLER_L: ("Lucas (S) apprécie la stabilité. Annoncez les changements à l'avance, soyez constant dans vos attentes.",
                        ["Accompagnement progressif", "Points réguliers 1-to-1"]),
        DEMO_SELLER_C: ("Clara (C) est analytique. Donnez-lui du contexte et des données factuelles. Appréciez sa rigueur.",
                        ["Partager les analyses de performance", "Valoriser la précision et la qualité"]),
    }

    for s in SELLERS:
        text, tips = compat_texts[s["id"]]
        await upsert(db["compatibility_advices"], {
            "id": f"demo-compat-{s['id']}",
            "seller_id": s["id"],
            "manager_id": DEMO_MANAGER_ID,
            "advice": {
                "manager": tips,
                "seller": [f"Profil {disc_configs[s['disc']]['style']} — adapter votre communication"],
            },
            "synthese": text,
            "is_demo": True,
            "generated_at": days_ago(10).isoformat(),
        })

    print(f"✅ Demo seeding complete — {len(SELLERS)} vendeurs, 183j de KPIs (6 mois), {len(BRIEF_TEXTS)} briefs, {len(BILAN_SYNTHESES)} bilans")


# ── Entrypoint ────────────────────────────────────────────────────────────────

async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "retail_coach")
    if not mongo_url:
        print("❌ MONGO_URL non défini dans .env")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    try:
        await seed(db)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
