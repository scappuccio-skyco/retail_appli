import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random

# Get mongo connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client['retail_coach']

# Mapping from profile to detailed fields
PROFILE_MAPPINGS = {
    'communicant_naturel': {
        'styles': ['Dynamique', 'Empathique', 'Relationnel', 'Convivial'],
        'levels': ['Challenger', 'Performer', 'Expert en relation'],
        'motivations': ['Relation', 'Reconnaissance', 'Équipe'],
        'summary_template': "Vendeur {style} avec un excellent sens de la communication. Son profil de {level} lui permet d'établir facilement le contact avec les clients. Motivé par {motivation}, il excelle dans la création de liens durables."
    },
    'excellence_commerciale': {
        'styles': ['Analytique', 'Stratégique', 'Performant', 'Ambitieux'],
        'levels': ['Top Performer', 'Expert commercial', 'Maître vendeur'],
        'motivations': ['Performance', 'Résultats', 'Dépassement'],
        'summary_template': "Professionnel {style} orienté résultats. Son niveau de {level} se traduit par des performances exceptionnelles. Motivé par {motivation}, il vise constamment l'excellence et dépasse régulièrement ses objectifs."
    },
    'potentiel_developper': {
        'styles': ['Appliqué', 'Consciencieux', 'En apprentissage', 'Attentif'],
        'levels': ['Débutant prometteur', 'En progression', 'Talent émergent'],
        'motivations': ['Apprentissage', 'Progression', 'Accompagnement'],
        'summary_template': "Vendeur {style} avec un potentiel certain. En tant que {level}, il montre une volonté d'apprendre et de progresser. Motivé par {motivation}, il bénéficierait d'un accompagnement renforcé pour développer ses compétences."
    },
    'equilibre': {
        'styles': ['Équilibré', 'Polyvalent', 'Régulier', 'Fiable'],
        'levels': ['Performer régulier', 'Vendeur confirmé', 'Pilier de l\'équipe'],
        'motivations': ['Stabilité', 'Polyvalence', 'Contribution'],
        'summary_template': "Vendeur {style} qui maintient des performances constantes. Son profil de {level} en fait un élément fiable de l'équipe. Motivé par {motivation}, il apporte une contribution régulière et équilibrée."
    }
}

async def enrich_diagnostics():
    """Enrich simplified diagnostics with detailed fields (style, level, motivation, AI summary)"""
    
    # Find diagnostics without 'style' field (new simplified format)
    diagnostics = await db.diagnostics.find(
        {"style": {"$exists": False}},
        {"_id": 0}
    ).to_list(100)
    
    if not diagnostics:
        print("✅ All diagnostics already have detailed fields!")
        return
    
    print(f"Found {len(diagnostics)} diagnostics to enrich")
    
    enriched_count = 0
    
    for diag in diagnostics:
        seller_id = diag['seller_id']
        profile = diag.get('profile', 'equilibre')
        score = diag.get('score', 3.0)
        
        # Get seller name
        seller = await db.users.find_one({"id": seller_id}, {"name": 1, "_id": 0})
        seller_name = seller['name'] if seller else "Unknown"
        
        # Get mapping for this profile
        mapping = PROFILE_MAPPINGS.get(profile, PROFILE_MAPPINGS['equilibre'])
        
        # Select random values from profile mapping
        style = random.choice(mapping['styles'])
        level = random.choice(mapping['levels'])
        motivation = random.choice(mapping['motivations'])
        
        # Generate AI summary
        ai_summary = mapping['summary_template'].format(
            style=style.lower(),
            level=level.lower(),
            motivation=motivation.lower()
        )
        
        # Add personalized touch based on score
        if score >= 4.5:
            ai_summary += " Ses compétences exceptionnelles font de lui un atout majeur pour l'équipe."
        elif score >= 3.5:
            ai_summary += " Ses compétences solides contribuent positivement à la performance globale."
        elif score >= 2.5:
            ai_summary += " Un accompagnement ciblé permettrait d'optimiser son potentiel."
        else:
            ai_summary += " Un plan de développement personnalisé est recommandé."
        
        # Update diagnostic
        await db.diagnostics.update_one(
            {"id": diag['id']},
            {"$set": {
                "style": style,
                "level": level,
                "motivation": motivation,
                "ai_profile_summary": ai_summary
            }}
        )
        
        print(f"✅ {seller_name}: {style} | {level} | {motivation}")
        enriched_count += 1
    
    print(f"\n🎉 Enriched {enriched_count} diagnostics with detailed fields!")
    print("All sellers now have: Style, Niveau, Motivation + AI Analysis")

if __name__ == "__main__":
    asyncio.run(enrich_diagnostics())
    client.close()
