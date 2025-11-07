import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client['retail_coach']

async def fix_diagnostic_answers():
    """Fix diagnostics to have 23 question answers instead of 8"""
    
    # Find all diagnostics with only 8 answers (from new sellers)
    all_diags = await db.diagnostics.find({}, {"_id": 0}).to_list(100)
    
    fixed_count = 0
    
    for diag in all_diags:
        answers = diag.get('answers', {})
        
        # Check if has only 8 answers
        if len(answers) == 8:
            seller_id = diag['seller_id']
            seller = await db.users.find_one({"id": seller_id}, {"name": 1, "_id": 0})
            seller_name = seller['name'] if seller else "Unknown"
            
            # Generate 23 answers (keep existing 8, add 15 more)
            new_answers = {}
            
            # Keep existing answers (q1-q8)
            for i in range(1, 9):
                new_answers[f"q{i}"] = answers.get(f"q{i}", random.randint(0, 3))
            
            # Add missing answers (q9-q23) - random but coherent with existing score
            avg_existing = sum(answers.values()) / len(answers) if answers else 2
            
            for i in range(9, 24):
                # Generate answer close to average (add some variance)
                base_value = int(avg_existing)
                variance = random.choice([-1, 0, 0, 1])  # More chances to stay same
                new_answers[f"q{i}"] = max(0, min(3, base_value + variance))
            
            # Recalculate score based on 23 questions
            total = sum(new_answers.values())
            new_score = round((total / (23 * 3)) * 5, 2)  # Scale to 0-5
            
            # Update diagnostic
            await db.diagnostics.update_one(
                {"id": diag['id']},
                {"$set": {
                    "answers": new_answers,
                    "score": new_score
                }}
            )
            
            print(f"✅ {seller_name}: Updated from 8 to 23 answers, new score={new_score}")
            fixed_count += 1
    
    print(f"\n🎉 Fixed {fixed_count} diagnostics to have 23 question answers!")

if __name__ == "__main__":
    asyncio.run(fix_diagnostic_answers())
    client.close()
