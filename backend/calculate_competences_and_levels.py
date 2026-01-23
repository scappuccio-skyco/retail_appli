import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client['retail_coach']

def calculate_competence_scores_from_numeric_answers(answers: dict) -> dict:
    """
    Calculate competence scores from numeric answers (0-3 scale)
    Questions 1-15 mapped to 5 competences (3 questions each)
    """
    competence_mapping = {
        'accueil': [1, 2, 3],
        'decouverte': [4, 5, 6],
        'argumentation': [7, 8, 9],
        'closing': [10, 11, 12],
        'fidelisation': [13, 14, 15]
    }
    
    scores = {
        'accueil': [],
        'decouverte': [],
        'argumentation': [],
        'closing': [],
        'fidelisation': []
    }
    
    # Calculate scores for each competence (convert 0-3 to 1-5 scale)
    for competence, question_ids in competence_mapping.items():
        for q_id in question_ids:
            q_key = f"q{q_id}"
            if q_key in answers:
                # Convert 0-3 scale to 1-5 scale: 0->1, 1->2.33, 2->3.67, 3->5
                numeric_value = answers[q_key]
                scaled_score = 1 + (numeric_value * 4 / 3)  # Linear scaling
                scores[competence].append(round(scaled_score, 1))
    
    # Calculate averages
    final_scores = {}
    for competence, score_list in scores.items():
        if score_list:
            final_scores[f'score_{competence}'] = round(sum(score_list) / len(score_list), 1)
        else:
            final_scores[f'score_{competence}'] = 3.0
    
    return final_scores

def determine_level_from_scores(scores: dict, profile: str = None) -> str:
    """
    Determine level badge based on average competence scores and profile
    """
    # Calculate average of all 5 competences
    all_scores = [
        scores.get('score_accueil', 3.0),
        scores.get('score_decouverte', 3.0),
        scores.get('score_argumentation', 3.0),
        scores.get('score_closing', 3.0),
        scores.get('score_fidelisation', 3.0)
    ]
    avg_score = sum(all_scores) / len(all_scores)
    
    # Map profile + score to appropriate level
    if profile == 'excellence_commerciale':
        if avg_score >= 4.0:
            return "Maître du Jeu"
        elif avg_score >= 3.5:
            return "Performer"
        else:
            return "Challenger"
    
    elif profile == 'communicant_naturel':
        if avg_score >= 4.0:
            return "Expert en relation"
        elif avg_score >= 3.5:
            return "Challenger"
        else:
            return "Explorateur"
    
    elif profile == 'equilibre':
        if avg_score >= 4.0:
            return "Performer"
        elif avg_score >= 3.0:
            return "Challenger"
        else:
            return "Explorateur"
    
    else:  # potentiel_developper or others
        if avg_score >= 4.0:
            return "Challenger"
        elif avg_score >= 3.0:
            return "Explorateur"
        else:
            return "En progression"

async def update_all_diagnostics():
    """Calculate scores and levels for all diagnostics"""
    
    # Find all diagnostics with 'answers' (numeric format)
    diagnostics = await db.diagnostics.find(
        {"answers": {"$exists": True}},
        {"_id": 0}
    ).to_list(100)
    
    print(f"Found {len(diagnostics)} diagnostics with numeric answers")
    
    if not diagnostics:
        print("No diagnostics to update.")
        return
    
    # ✅ OPTIMIZATION: Extract all seller_ids before the loop (batch query)
    seller_ids = [diag['seller_id'] for diag in diagnostics if diag.get('seller_id')]
    
    # ✅ OPTIMIZATION: Single batch query to get all seller names at once
    sellers = await db.users.find(
        {"id": {"$in": seller_ids}},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(len(seller_ids))
    
    # ✅ OPTIMIZATION: Create lookup map for O(1) access
    seller_map = {seller['id']: seller.get('name', 'Unknown') for seller in sellers}
    
    # ✅ OPTIMIZATION: Prepare all updates in memory, then bulk_write
    from pymongo import UpdateOne
    
    bulk_operations = []
    updated_count = 0
    
    for diag in diagnostics:
        seller_id = diag.get('seller_id')
        if not seller_id:
            continue
            
        answers = diag.get('answers', {})
        
        # ✅ OPTIMIZATION: Use lookup map instead of DB query
        seller_name = seller_map.get(seller_id, "Unknown")
        
        # Calculate competence scores (business logic unchanged)
        competence_scores = calculate_competence_scores_from_numeric_answers(answers)
        
        # Determine level badge (business logic unchanged)
        profile = diag.get('profile', 'equilibre')
        level = determine_level_from_scores(competence_scores, profile)
        
        # Prepare update data
        update_data = {
            **competence_scores,
            'level': level
        }
        
        # ✅ OPTIMIZATION: Add to bulk operations instead of individual update_one
        bulk_operations.append(
            UpdateOne(
                {"id": diag['id']},
                {"$set": update_data}
            )
        )
        
        avg_score = (
            competence_scores['score_accueil'] + 
            competence_scores['score_decouverte'] + 
            competence_scores['score_argumentation'] + 
            competence_scores['score_closing'] + 
            competence_scores['score_fidelisation']
        ) / 5
        
        print(f"✅ {seller_name}: Avg={avg_score:.1f} → {level} | Accueil={competence_scores['score_accueil']}, Découverte={competence_scores['score_decouverte']}, Argu={competence_scores['score_argumentation']}, Closing={competence_scores['score_closing']}, Fidé={competence_scores['score_fidelisation']}")
        updated_count += 1
    
    # ✅ OPTIMIZATION: Execute all updates in a single bulk_write (ordered=False for speed)
    if bulk_operations:
        await db.diagnostics.bulk_write(bulk_operations, ordered=False)
        print(f"\n🎉 Updated {updated_count} diagnostics with competence scores and levels in a single bulk operation!")
    else:
        print("\n⚠️ No diagnostics to update.")
    
    print("Radar charts and level badges should now display correctly!")

if __name__ == "__main__":
    asyncio.run(update_all_diagnostics())
    client.close()
