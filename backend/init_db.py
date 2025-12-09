"""
Script d'initialisation de la base de données
Crée automatiquement un compte super admin si aucun utilisateur n'existe
"""
import os
import bcrypt
from pymongo import MongoClient
from uuid import uuid4
from datetime import datetime, timezone
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_database():
    """Initialize database with default admin user if needed"""
    
    # Configuration
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'retail_performer')
    
    # Admin par défaut
    default_admin_email = os.environ.get('DEFAULT_ADMIN_EMAIL', 's.cappuccio@retailperformerai.com')
    default_admin_password = os.environ.get('DEFAULT_ADMIN_PASSWORD', 'RetailPerformer2025!')
    default_admin_name = os.environ.get('DEFAULT_ADMIN_NAME', 'Super Admin')
    
    try:
        # Connexion à MongoDB
        client = MongoClient(mongo_url)
        db = client[db_name]
        
        # Vérifier si un compte super_admin existe
        superadmin_count = db.users.count_documents({"role": "super_admin"})
        
        if superadmin_count == 0:
            logger.info("🔍 Aucun compte super_admin trouvé dans la base de données")
            logger.info("🚀 Création du compte super admin par défaut...")
            
            # Hasher le mot de passe
            hashed_password = bcrypt.hashpw(
                default_admin_password.encode('utf-8'), 
                bcrypt.gensalt()
            ).decode('utf-8')
            
            # Créer l'utilisateur super_admin
            admin_user = {
                "id": str(uuid4()),
                "name": default_admin_name,
                "email": default_admin_email,
                "password": hashed_password,
                "role": "super_admin",
                "status": "active",
                "created_at": datetime.now(timezone.utc),
                "phone": None,
                "gerant_id": None,
                "store_id": None,
                "manager_id": None,
                "sync_mode": None
            }
            
            # Insérer dans la DB
            db.users.insert_one(admin_user)
            
            logger.info("✅ Compte super_admin créé avec succès !")
            logger.info(f"   📧 Email: {default_admin_email}")
            logger.info(f"   🔑 Mot de passe: {default_admin_password}")
            logger.info(f"   👤 Rôle: super_admin")
            logger.info("   ⚠️  IMPORTANT: Changez ce mot de passe après la première connexion !")
            
        else:
            logger.info(f"✅ Compte(s) super_admin déjà existant(s) ({superadmin_count} super_admin(s) trouvé(s))")
            logger.info("   Aucune initialisation nécessaire.")
            
        client.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'initialisation de la base de données: {e}")
        return False

if __name__ == "__main__":
    init_database()
