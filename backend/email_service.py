import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
import os
import logging

logger = logging.getLogger(__name__)

SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'hello@retailperformerai.com')
SENDER_NAME = os.environ.get('SENDER_NAME', 'Retail Performer AI')
RECIPIENT_EMAIL = os.environ.get('RECIPIENT_EMAIL', 'hello@retailperformerai.com')

def get_frontend_url():
    """Get frontend URL from environment, ensuring it's always fresh"""
    return os.environ.get('FRONTEND_URL', 'https://retailperformerai.com')


def get_brevo_api_instance():
    """Initialize Brevo API instance with fresh configuration"""
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = os.environ.get('BREVO_API_KEY')
    return sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))


def send_gerant_invitation_email(recipient_email: str, recipient_name: str, invitation_token: str):
    """
    Envoyer un email d'invitation à un nouveau Gérant
    """
    frontend_url = get_frontend_url().rstrip('/')  # Remove trailing slash to avoid double //
    invitation_link = f"{frontend_url}/register/gerant/{invitation_token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🎉 Bienvenue sur Retail Performer AI</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Bonjour {recipient_name},</p>
            
            <p style="font-size: 16px;">
                Nous sommes ravis de vous inviter à rejoindre <strong>Retail Performer AI</strong>, 
                la plateforme de coaching commercial qui transforme vos équipes de vente.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <h3 style="margin-top: 0; color: #667eea;">✨ Ce qui vous attend :</h3>
                <ul style="list-style: none; padding: 0;">
                    <li style="padding: 8px 0;">📊 Dashboard de performance en temps réel</li>
                    <li style="padding: 8px 0;">🤖 Coach IA personnalisé pour chaque vendeur</li>
                    <li style="padding: 8px 0;">📈 Suivi des KPIs et analyses détaillées</li>
                    <li style="padding: 8px 0;">👥 Gestion multi-magasins simplifiée</li>
                    <li style="padding: 8px 0;">🎯 14 jours d'essai gratuit</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{invitation_link}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 25px; 
                          font-size: 16px; 
                          font-weight: bold; 
                          display: inline-block;
                          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                    🚀 Créer mon compte Gérant
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                <strong>Note :</strong> Ce lien d'invitation est valable pendant 7 jours.
            </p>
            
            <p style="font-size: 14px; color: #666;">
                Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
                Retail Performer AI - La solution de coaching commercial nouvelle génération<br>
                © 2024 Tous droits réservés
            </p>
        </div>
    </body>
    </html>
    """
    
    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject="🎉 Votre invitation à Retail Performer AI",
            html_content=html_content
        )
        
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Invitation email sent to Gérant {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending invitation email to {recipient_email}: {e}")
        return False


def send_manager_invitation_email(recipient_email: str, recipient_name: str, invitation_token: str, gerant_name: str, store_name: str = None):
    """
    Envoyer un email d'invitation à un Manager (invité par un Gérant)
    """
    frontend_url = get_frontend_url().rstrip('/')  # Remove trailing slash to avoid double //
    invitation_link = f"{frontend_url}/register/manager/{invitation_token}"
    
    store_info = f" pour le magasin <strong>{store_name}</strong>" if store_name else ""
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">👋 Vous êtes invité !</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Bonjour {recipient_name},</p>
            
            <p style="font-size: 16px;">
                <strong>{gerant_name}</strong> vous invite à rejoindre son équipe{store_info} 
                sur <strong>Retail Performer AI</strong>.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9333ea;">
                <h3 style="margin-top: 0; color: #9333ea;">🎯 En tant que Manager, vous pourrez :</h3>
                <ul style="list-style: none; padding: 0;">
                    <li style="padding: 8px 0;">👥 <strong>Consulter les performances</strong> de chaque membre de votre équipe</li>
                    <li style="padding: 8px 0;">📊 <strong>Suivre les KPI</strong> de votre magasin en temps réel</li>
                    <li style="padding: 8px 0;">🎯 <strong>Créer et suivre des objectifs</strong> individuels et collectifs</li>
                    <li style="padding: 8px 0;">🏆 <strong>Lancer des challenges</strong> pour motiver votre équipe</li>
                    <li style="padding: 8px 0;">🤖 <strong>Coaching IA personnalisé</strong> pour booster les performances</li>
                    <li style="padding: 8px 0;">📋 <strong>Générer des bilans et entretiens annuels</strong> en 1 clic avec l'IA</li>
                    <li style="padding: 8px 0;">🤝 <strong>Conseils IA relationnels</strong> adaptés à chaque profil DISC de vos vendeurs</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{invitation_link}" 
                   style="background-color: #9333ea !important; 
                          background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%) !important; 
                          color: white !important; 
                          padding: 15px 40px !important; 
                          text-decoration: none !important; 
                          border-radius: 25px !important; 
                          font-size: 16px !important; 
                          font-weight: bold !important; 
                          display: inline-block !important;
                          box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4) !important;">
                    ✅ Accepter l'invitation
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                <strong>Note :</strong> Ce lien d'invitation est valable pendant 7 jours.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
                Retail Performer AI<br>
                © 2024 Tous droits réservés
            </p>
        </div>
    </body>
    </html>
    """
    
    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject=f"👋 {gerant_name} vous invite à rejoindre Retail Performer AI",
            html_content=html_content
        )
        
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Manager invitation email sent to {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending manager invitation email to {recipient_email}: {e}")
        return False


def send_seller_invitation_email(recipient_email: str, recipient_name: str, invitation_token: str, manager_name: str, store_name: str = None):
    """
    Envoyer un email d'invitation à un Vendeur (invité par un Manager)
    """
    frontend_url = get_frontend_url().rstrip('/')  # Remove trailing slash to avoid double //
    invitation_link = f"{frontend_url}/register/seller/{invitation_token}"
    
    store_info = f" du magasin <strong>{store_name}</strong>" if store_name else ""
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🌟 Bienvenue dans l'équipe !</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Bonjour {recipient_name},</p>
            
            <p style="font-size: 16px;">
                <strong>{manager_name}</strong>, votre manager{store_info}, 
                vous invite à rejoindre <strong>Retail Performer AI</strong> !
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9333ea;">
                <h3 style="margin-top: 0; color: #9333ea;">🚀 Votre espace personnel :</h3>
                <ul style="list-style: none; padding: 0;">
                    <li style="padding: 8px 0;">📊 Suivre vos KPI et performances en temps réel</li>
                    <li style="padding: 8px 0;">🎯 Consulter vos objectifs et challenges</li>
                    <li style="padding: 8px 0;">🤖 Créer vos défis personnels avec votre coach IA</li>
                    <li style="padding: 8px 0;">✅ Analyser vos ventes conclues avec l'IA</li>
                    <li style="padding: 8px 0;">❌ Analyser vos opportunités manquées avec l'IA</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{invitation_link}" 
                   style="background-color: #9333ea !important; 
                          background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%) !important; 
                          color: white !important; 
                          padding: 15px 40px !important; 
                          text-decoration: none !important; 
                          border-radius: 25px !important; 
                          font-size: 16px !important; 
                          font-weight: bold !important; 
                          display: inline-block !important;
                          box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4) !important;">
                    🎉 Commencer maintenant
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                <strong>Note :</strong> Ce lien d'invitation est valable pendant 7 jours.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
                Retail Performer AI - Votre coach personnel<br>
                © 2024 Tous droits réservés
            </p>
        </div>
    </body>
    </html>
    """
    
    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject=f"🌟 {manager_name} vous invite à rejoindre l'équipe !",
            html_content=html_content
        )
        
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Seller invitation email sent to {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending seller invitation email to {recipient_email}: {e}")
        return False


def send_password_reset_email(recipient_email: str, recipient_name: str, reset_token: str):
    """
    Envoyer un email de réinitialisation de mot de passe
    """
    frontend_url = get_frontend_url().rstrip('/')  # Remove trailing slash to avoid double //
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🔒 Réinitialisation de mot de passe</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Bonjour {recipient_name},</p>
            
            <p style="font-size: 16px;">
                Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte 
                <strong>Retail Performer AI</strong>.
            </p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                    ⚠️ <strong>Important :</strong> Ce lien est valable pendant <strong>10 minutes</strong> seulement.
                </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: bold; 
                          font-size: 16px;
                          display: inline-block;
                          box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    Réinitialiser mon mot de passe
                </a>
            </div>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="font-size: 14px; color: #666; margin: 0;">
                    Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
                </p>
                <p style="font-size: 12px; color: #667eea; word-break: break-all; margin: 10px 0;">
                    {reset_link}
                </p>
            </div>
            
            <div style="background-color: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
                <p style="margin: 0; font-size: 14px; color: #721c24;">
                    🛡️ <strong>Vous n'avez pas demandé cette réinitialisation ?</strong><br>
                    Ignorez simplement cet email. Votre mot de passe reste inchangé et sécurisé.
                </p>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Cordialement,<br>
                <strong>L'équipe Retail Performer AI</strong>
            </p>
        </div>
        
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
            <p>© 2025 Retail Performer AI - Tous droits réservés</p>
            <p>Cet email a été envoyé à {recipient_email}</p>
        </div>
    </body>
    </html>
    """
    
    send_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": recipient_email, "name": recipient_name}],
        sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
        subject="Réinitialisation de votre mot de passe - Retail Performer AI",
        html_content=html_content
    )
    
    try:
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Email de réinitialisation envoyé à {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Erreur lors de l'envoi de l'email de réinitialisation: {e}")
        return False


def send_gerant_welcome_email(recipient_email: str, recipient_name: str):
    """
    Envoyer un email de bienvenue à un Gérant après son inscription
    """
    frontend_url = get_frontend_url().rstrip('/')
    login_link = f"{frontend_url}/login"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🎉 Bienvenue sur Retail Performer AI !</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 16px;">Votre compte Gérant est maintenant actif</p>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Bonjour <strong>{recipient_name}</strong>,</p>
            
            <p style="font-size: 16px;">
                Félicitations ! Vous avez créé votre espace <strong>Gérant</strong> sur Retail Performer AI. 
                Vous bénéficiez de <strong>14 jours d'essai gratuit</strong> pour explorer toutes nos fonctionnalités.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F97316;">
                <h3 style="margin-top: 0; color: #F97316;">🏢 En tant que Gérant, vous pouvez :</h3>
                <ul style="list-style: none; padding: 0;">
                    <li style="padding: 8px 0;">🏪 <strong>Créer et gérer plusieurs magasins</strong> depuis une seule interface</li>
                    <li style="padding: 8px 0;">👥 <strong>Inviter vos Managers</strong> et constituer vos équipes</li>
                    <li style="padding: 8px 0;">📊 <strong>Vue d'ensemble consolidée</strong> des performances de tous vos points de vente</li>
                    <li style="padding: 8px 0;">📈 <strong>Classement des magasins</strong> par CA, nombre de ventes, panier moyen</li>
                    <li style="padding: 8px 0;">👔 <strong>Gérer votre personnel</strong> (managers et vendeurs) de manière centralisée</li>
                    <li style="padding: 8px 0;">🔗 <strong>API disponible</strong> pour connecter vos outils existants (ERP, caisse...)</li>
                </ul>
            </div>
            
            <div style="background-color: #FFF7ED; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #F97316;">
                <h3 style="margin-top: 0; color: #EA580C;">🚀 Pour bien démarrer :</h3>
                <ol style="padding-left: 20px; margin: 0;">
                    <li style="padding: 5px 0;">Créez votre premier <strong>magasin</strong></li>
                    <li style="padding: 5px 0;">Invitez vos <strong>Managers</strong> par email</li>
                    <li style="padding: 5px 0;">Vos managers inviteront ensuite leurs <strong>Vendeurs</strong></li>
                    <li style="padding: 5px 0;">Suivez les performances globales depuis votre tableau de bord !</li>
                </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{login_link}" 
                   style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 25px; 
                          font-size: 16px; 
                          font-weight: bold; 
                          display: inline-block;
                          box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4);">
                    🔑 Accéder à mon Espace Gérant
                </a>
            </div>
            
            <div style="background-color: #EFF6FF; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #1E40AF;">
                <p style="margin: 0; font-size: 14px; color: #1E40AF;">
                    💡 <strong>Besoin d'aide ?</strong> Répondez directement à cet email ou consultez notre FAQ. 
                    Notre équipe est là pour vous accompagner !
                </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
                Retail Performer AI - La solution de coaching commercial nouvelle génération<br>
                25 allée Rose Dieng-Kuntz, 75019 Paris, France<br>
                © 2025 Tous droits réservés
            </p>
        </div>
    </body>
    </html>
    """
    
    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject="🎉 Bienvenue sur Retail Performer AI - Votre espace Gérant est prêt !",
            html_content=html_content
        )
        
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Welcome email sent to Gérant {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending welcome email to Gérant {recipient_email}: {e}")
        return False


def send_early_access_qualification_email(
    full_name: str,
    email: str,
    enseigne: str,
    nombre_vendeurs: int,
    defi_principal: str
):
    """
    Envoyer un email de notification pour une candidature Early Access
    """
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🚀 Nouvelle Candidature Programme Pilote</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Bonjour,</p>
            
            <p style="font-size: 16px;">
                Une nouvelle candidature au <strong>Programme Pilote Early Adopter</strong> a été soumise.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F97316;">
                <h3 style="margin-top: 0; color: #F97316;">📋 Informations du Candidat :</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; width: 40%;">Nom Complet :</td>
                        <td style="padding: 8px 0;">{full_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Email :</td>
                        <td style="padding: 8px 0;"><a href="mailto:{email}" style="color: #F97316;">{email}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Enseigne :</td>
                        <td style="padding: 8px 0;">{enseigne}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Nombre de Vendeurs :</td>
                        <td style="padding: 8px 0;">{nombre_vendeurs}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #FFF7ED; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #EA580C;">
                <h3 style="margin-top: 0; color: #EA580C;">🎯 Défi Principal Identifié :</h3>
                <p style="margin: 0; font-style: italic; color: #333;">
                    "{defi_principal}"
                </p>
            </div>
            
            <div style="background-color: #EFF6FF; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #1E40AF;">
                <p style="margin: 0; font-size: 14px; color: #1E40AF;">
                    💡 <strong>Action requise :</strong> Contacter le candidat sous 24h ouvrées pour valider son accès et planifier la séance de configuration.
                </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
                Retail Performer AI - Programme Pilote Early Adopter<br>
                © 2025 Tous droits réservés
            </p>
        </div>
    </body>
    </html>
    """
    
    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": RECIPIENT_EMAIL, "name": "Retail Performer AI Team"}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject=f"🚀 Nouvelle Candidature Programme Pilote - {enseigne}",
            html_content=html_content,
            reply_to={"email": email, "name": full_name}
        )
        
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Early access qualification email sent for {email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending early access qualification email for {email}: {e}")
        return False

