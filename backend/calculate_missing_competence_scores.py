import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client['retail_coach']

def calculate_competence_scores_from_questionnaire(responses: dict) -> dict:
    """Calculate competence scores from questionnaire responses (Q1-15)"""
    
    competence_mapping = {
        'accueil': [1, 2, 3],
        'decouverte': [4, 5, 6],
        'argumentation': [7, 8, 9],
        'closing': [10, 11, 12],
        'fidelisation': [13, 14, 15]
    }
    
    question_scores = {
        # Accueil (Q1-3)
        1: [5, 3, 4],
        2: [5, 4, 3, 2],
        3: [3, 5, 4],
        # Découverte (Q4-6)
        4: [5, 4, 3],
        5: [5, 4, 4, 3],
        6: [5, 3, 4],
        # Argumentation (Q7-9)
        7: [3, 5, 4],
        8: [3, 5, 4, 3],
        9: [4, 3, 5],
        # Closing (Q10-12)
        10: [5, 4, 5, 3],
        11: [4, 3, 5],
        12: [5, 4, 5, 3],
        # Fidélisation (Q13-15)
        13: [4, 4, 5, 5],
        14: [4, 5, 3],
        15: [5, 3, 5, 4]
    }
    
    scores = {
        'accueil': [],
        'decouverte': [],
        'argumentation': [],
        'closing': [],
        'fidelisation': []
    }
    
    # Calculate scores for each competence
    for competence, question_ids in competence_mapping.items():
        for q_id in question_ids:
            q_key = str(q_id)
            if q_key in responses:
                response_value = responses[q_key]
                
                if isinstance(response_value, int):
                    option_idx = response_value
                    if q_id in question_scores and option_idx < len(question_scores[q_id]):
                        scores[competence].append(question_scores[q_id][option_idx])
                    else:
                        scores[competence].append(3.0)
                else:
                    scores[competence].append(3.0)
    
    # Calculate averages
    final_scores = {}
    for competence, score_list in scores.items():
        if score_list:
            final_scores[f'score_{competence}'] = round(sum(score_list) / len(score_list), 1)
        else:
            final_scores[f'score_{competence}'] = 3.0
    
    return final_scores

async def add_competence_scores():
    """Add competence scores to all diagnostics that are missing them"""
    
    # Find diagnostics without score_accueil (means scores not calculated)
    diagnostics = await db.diagnostics.find(
        {"score_accueil": {"$exists": False}},
        {"_id": 0}
    ).to_list(100)
    
    if not diagnostics:
        print("✅ All diagnostics already have competence scores!")
        return
    
    print(f"Found {len(diagnostics)} diagnostics without competence scores")
    
    updated_count = 0
    
    for diag in diagnostics:
        seller_id = diag['seller_id']
        answers = diag.get('answers', {})
        
        # Get seller name
        seller = await db.users.find_one({"id": seller_id}, {"name": 1, "_id": 0})
        seller_name = seller['name'] if seller else "Unknown"
        
        # Calculate competence scores
        competence_scores = calculate_competence_scores_from_questionnaire(answers)
        
        # Update diagnostic
        await db.diagnostics.update_one(
            {"id": diag['id']},
            {"$set": competence_scores}
        )
        
        print(f"✅ {seller_name}: Accueil={competence_scores['score_accueil']}, Découverte={competence_scores['score_decouverte']}, Argumentation={competence_scores['score_argumentation']}, Closing={competence_scores['score_closing']}, Fidélisation={competence_scores['score_fidelisation']}")
        updated_count += 1
    
    print(f"\n🎉 Added competence scores to {updated_count} diagnostics!")
    print("The radar charts should now display correctly!")

if __name__ == "__main__":
    asyncio.run(add_competence_scores())
    client.close()
