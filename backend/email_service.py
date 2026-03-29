import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'hello@retailperformerai.com')
SENDER_NAME = os.environ.get('SENDER_NAME', 'Retail Performer AI')
RECIPIENT_EMAIL = os.environ.get('RECIPIENT_EMAIL', 'hello@retailperformerai.com')

def get_frontend_url():
    """Get frontend URL from environment, ensuring it's always fresh"""
    return os.environ.get('FRONTEND_URL', 'https://retailperformerai.com')


_brevo_instance = None

def get_brevo_api_instance():
    """Get or create Brevo API singleton instance (avoids re-initializing on every call)."""
    global _brevo_instance
    if _brevo_instance is None:
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = os.environ.get('BREVO_API_KEY')
        _brevo_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
    return _brevo_instance


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
                    <li style="padding: 8px 0;">📊 Dashboard de performance global en temps réel</li>
                    <li style="padding: 8px 0;">📈 Suivi des KPIs de chaque magasin (CA, ventes, évolution)</li>
                    <li style="padding: 8px 0;">🏆 Classement et comparaison des performances entre magasins</li>
                    <li style="padding: 8px 0;">👥 Gestion multi-magasins et supervision du personnel</li>
                    <li style="padding: 8px 0;">🔌 Intégration API pour connecter vos logiciels externes (caisse, ERP)</li>
                    <li style="padding: 8px 0;">🎯 30 jours d'essai gratuit</li>
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
                    <li style="padding: 8px 0;">👥 <strong>Consulter les performances</strong> de chaque membre de votre équipe en temps réel</li>
                    <li style="padding: 8px 0;">📊 <strong>Suivre les KPI magasin</strong> (CA, ventes, panier moyen, taux de transformation)</li>
                    <li style="padding: 8px 0;">🎯 <strong>Créer et suivre des objectifs</strong> individuels et collectifs</li>
                    <li style="padding: 8px 0;">🏆 <strong>Lancer des challenges</strong> pour motiver votre équipe</li>
                    <li style="padding: 8px 0;">☀️ <strong>Générer votre brief matinal</strong> personnalisé par IA</li>
                    <li style="padding: 8px 0;">📋 <strong>Générer des bilans IA de votre équipe</strong> (points forts, axes d'amélioration, recommandations)</li>
                    <li style="padding: 8px 0;">📝 <strong>Préparer les entretiens annuels</strong> de vos vendeurs avec synthèse IA</li>
                    <li style="padding: 8px 0;">🤝 <strong>Conseils relationnels et gestion de conflits</strong> adaptés au profil DISC de chaque vendeur</li>
                    <li style="padding: 8px 0;">🧠 <strong>Diagnostic de votre profil management</strong> (méthodologie DISC)</li>
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
                    <li style="padding: 8px 0;">📊 <strong>Suivre vos KPI personnels</strong> en temps réel (CA, ventes, panier moyen, taux de transformation)</li>
                    <li style="padding: 8px 0;">✍️ <strong>Saisir vos chiffres</strong> quotidiennement et consulter vos bilans IA (semaine, mois, année)</li>
                    <li style="padding: 8px 0;">🤖 <strong>Défis quotidiens personnalisés</strong> par compétence avec votre coach IA</li>
                    <li style="padding: 8px 0;">✅ <strong>Analyser vos ventes conclues</strong> avec l'IA (points forts, bonnes pratiques)</li>
                    <li style="padding: 8px 0;">🔍 <strong>Analyser vos opportunités manquées</strong> avec l'IA (axes d'amélioration)</li>
                    <li style="padding: 8px 0;">🎯 <strong>Suivre vos objectifs</strong> individuels et challenges assignés par votre manager</li>
                    <li style="padding: 8px 0;">🧠 <strong>Diagnostic de votre profil vendeur</strong> (style, niveau, motivation, profil DISC)</li>
                    <li style="padding: 8px 0;">📝 <strong>Préparer votre entretien annuel</strong> avec bloc-notes et synthèse IA</li>
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
                    ⚠️ <strong>Important :</strong> Ce lien est valable pendant <strong>15 minutes</strong> seulement.
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
        # Check if BREVO_API_KEY is configured
        brevo_api_key = os.environ.get('BREVO_API_KEY')
        if not brevo_api_key:
            logger.error("❌ BREVO_API_KEY is not configured in environment variables - Email NOT sent")
            return False
        
        logger.info(f"📧 Tentative d'envoi d'email de réinitialisation à {recipient_email} via Brevo...")
        logger.debug(f"   - Sender: {SENDER_EMAIL} ({SENDER_NAME})")
        logger.debug(f"   - Recipient: {recipient_email} ({recipient_name})")
        logger.debug(f"   - Frontend URL: {get_frontend_url()}")
        
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        
        message_id = api_response.message_id if hasattr(api_response, 'message_id') else 'N/A'
        logger.info(f"✅ Email de réinitialisation envoyé avec succès à {recipient_email}: Message ID = {message_id}")
        return True
    except ApiException as e:
        error_details = {
            'status': getattr(e, 'status', 'N/A'),
            'reason': getattr(e, 'reason', 'N/A'),
            'body': getattr(e, 'body', 'N/A')
        }
        logger.error(
            f"❌ Erreur Brevo API lors de l'envoi de l'email de réinitialisation à {recipient_email}: "
            f"Status={error_details['status']}, Reason={error_details['reason']}, Body={error_details['body']}"
        )
        return False
    except Exception as e:
        logger.error(
            f"❌ Erreur inattendue lors de l'envoi de l'email de réinitialisation à {recipient_email}: {str(e)}",
            exc_info=True
        )
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
                Vous bénéficiez de <strong>30 jours d'essai gratuit</strong> pour explorer toutes nos fonctionnalités.
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


def send_early_access_confirmation_email(
    full_name: str,
    email: str,
    enseigne: str
):
    """
    Envoyer un email de confirmation au candidat Early Access
    """
    frontend_url = get_frontend_url().rstrip('/')
    calendly_url = "https://calendly.com/s-cappuccio-skyco/configuration-programme-pilote-retail-performer-ai"
    signup_url = f"{frontend_url}/login?register=true&early_access=true"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🚀 Bienvenue dans le Programme Pilote Retail Performer AI !</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Bonjour <strong>{full_name}</strong>,</p>
            
            <p style="font-size: 16px;">
                Merci pour votre candidature pour le magasin <strong>{enseigne}</strong>. 
                Votre profil est en cours de validation pour le <strong style="color: #F97316;">tarif fondateur à 19€/vendeur</strong>.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F97316;">
                <h3 style="margin-top: 0; color: #F97316;">✨ Prochaines étapes :</h3>
                <ol style="padding-left: 20px; margin: 0;">
                    <li style="padding: 8px 0;">Réservez votre créneau de configuration (15 min) via Calendly</li>
                    <li style="padding: 8px 0;">Créez votre compte gérant pour commencer votre essai gratuit de 30 jours</li>
                    <li style="padding: 8px 0;">Je vous recontacterai sous 24h ouvrées pour valider votre accès</li>
                </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{calendly_url}" 
                   style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 25px; 
                          font-size: 16px; 
                          font-weight: bold; 
                          display: inline-block;
                          box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4);
                          margin-bottom: 15px;">
                    📅 Réserver mon créneau Calendly
                </a>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
                <a href="{signup_url}" 
                   style="background-color: white; 
                          color: #F97316; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 25px; 
                          font-size: 16px; 
                          font-weight: bold; 
                          display: inline-block;
                          border: 2px solid #F97316;
                          box-shadow: 0 2px 8px rgba(249, 115, 22, 0.2);">
                    🚀 Créer mon compte gérant (30 jours gratuits)
                </a>
            </div>
            
            <div style="background-color: #EFF6FF; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #1E40AF;">
                <p style="margin: 0; font-size: 14px; color: #1E40AF;">
                    💬 <strong>Je reviendrai vers vous personnellement sous 24h ouvrées</strong> pour valider votre accès et répondre à toutes vos questions.
                </p>
            </div>
            
            <div style="background-color: #FFF7ED; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #F97316;">
                <p style="margin: 0; font-size: 14px; color: #EA580C;">
                    🎁 <strong>Rappel :</strong> Tarif fondateur bloqué à vie pour les 5 prochains magasins partenaires. 
                    Vous bénéficierez également d'un accompagnement VIP pour vos 14 premiers jours.
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
            to=[{"email": email, "name": full_name}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject="🚀 Bienvenue dans le Programme Pilote Retail Performer AI !",
            html_content=html_content
        )
        
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Early access confirmation email sent to {email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending early access confirmation email to {email}: {e}")
        return False


def send_staff_email_update_confirmation(
    recipient_email: str,
    recipient_name: str,
    new_email: str
):
    """
    Envoyer un email de confirmation à la nouvelle adresse email après mise à jour par le gérant.
    Contient le nouvel identifiant et un lien vers la page de login.
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
            <h1 style="color: white; margin: 0;">📧 Mise à jour de vos identifiants</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Bonjour <strong>{recipient_name}</strong>,</p>
            
            <p style="font-size: 16px;">
                Votre gérant a mis à jour votre adresse e-mail sur <strong>Retail Performer AI</strong>.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1E40AF;">
                <h3 style="margin-top: 0; color: #1E40AF;">🔑 Vos nouveaux identifiants :</h3>
                <p style="font-size: 16px; margin: 10px 0;">
                    <strong>Email :</strong> <span style="color: #1E40AF; font-weight: bold;">{new_email}</span>
                </p>
                <p style="font-size: 14px; color: #666; margin: 10px 0;">
                    <strong>Mot de passe :</strong> Votre mot de passe reste le même.
                </p>
            </div>
            
            <div style="background-color: #EFF6FF; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #1E40AF;">
                <p style="margin: 0; font-size: 14px; color: #1E40AF;">
                    ℹ️ <strong>Pour votre prochaine connexion,</strong> veuillez utiliser votre nouvelle adresse e-mail : <strong>{new_email}</strong>
                </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{login_link}" 
                   style="background: linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 25px; 
                          font-size: 16px; 
                          font-weight: bold; 
                          display: inline-block;
                          box-shadow: 0 4px 15px rgba(30, 64, 175, 0.4);">
                    🔑 Accéder à mon espace
                </a>
            </div>
            
            <div style="background-color: #FFF7ED; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #F97316;">
                <p style="margin: 0; font-size: 14px; color: #EA580C;">
                    ⚠️ <strong>Important :</strong> Votre session actuelle reste active jusqu'à expiration. 
                    Vous devrez utiliser votre nouvelle adresse e-mail lors de votre prochaine connexion.
                </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
                Retail Performer AI<br>
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
            subject="Mise à jour de vos identifiants Retail Performer AI",
            html_content=html_content
        )
        
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Staff email update confirmation sent to {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending staff email update confirmation to {recipient_email}: {e}")
        return False


def send_staff_email_update_alert(
    recipient_email: str,
    recipient_name: str,
    new_email: str,
    gerant_name: str
):
    """
    Envoyer un email d'alerte à l'ancienne adresse email indiquant que l'identifiant a été mis à jour.
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
            <h1 style="color: white; margin: 0;">⚠️ Mise à jour de votre identifiant</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Bonjour <strong>{recipient_name}</strong>,</p>
            
            <p style="font-size: 16px;">
                Votre gérant <strong>{gerant_name}</strong> a mis à jour votre adresse e-mail de connexion 
                sur <strong>Retail Performer AI</strong>.
            </p>
            
            <div style="background-color: #FFF7ED; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F97316;">
                <h3 style="margin-top: 0; color: #EA580C;">📧 Nouvelle adresse e-mail :</h3>
                <p style="font-size: 16px; margin: 10px 0; color: #EA580C; font-weight: bold;">
                    {new_email}
                </p>
            </div>
            
            <div style="background-color: #EFF6FF; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #1E40AF;">
                <p style="margin: 0; font-size: 14px; color: #1E40AF;">
                    ℹ️ <strong>Pour votre prochaine connexion,</strong> veuillez utiliser votre nouvelle adresse e-mail : <strong>{new_email}</strong>
                </p>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #1E40AF;">
                    Votre mot de passe reste le même.
                </p>
            </div>
            
            <div style="background-color: #F8D7DA; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC3545;">
                <p style="margin: 0; font-size: 14px; color: #721C24;">
                    🛡️ <strong>Vous n'avez pas demandé cette modification ?</strong><br>
                    Contactez votre gérant ou notre support si vous pensez qu'il s'agit d'une erreur.
                </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
                Retail Performer AI<br>
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
            subject="Mise à jour de votre identifiant Retail Performer AI",
            html_content=html_content
        )
        
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Staff email update alert sent to old email {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending staff email update alert to {recipient_email}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# SUBSCRIPTION / PAYMENT EMAILS
# ─────────────────────────────────────────────────────────────────────────────

_PLAN_DISPLAY_NAMES = {
    'starter': 'Small Team',
    'professional': 'Medium Team',
    'enterprise': 'Large Team',
}


def _plan_display(plan_key: str) -> str:
    return _PLAN_DISPLAY_NAMES.get(plan_key, plan_key.title() if plan_key else 'Standard')


def _date_fr(iso_str: str) -> str:
    """Format an ISO date string to a French readable date (e.g. '18 mars 2026')."""
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        months = [
            'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
            'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
        ]
        return f"{dt.day} {months[dt.month - 1]} {dt.year}"
    except Exception:
        return iso_str


def send_payment_confirmation_email(
    recipient_email: str,
    recipient_name: str,
    amount_eur: float,
    period_end_date: str,
    plan_key: str = 'starter',
    billing_reason: str = 'subscription_cycle',
    invoice_url: str = None,
) -> bool:
    """
    Email sent after a successful payment (invoice.payment_succeeded).
    billing_reason='subscription_create' → new subscription
    billing_reason='subscription_cycle'  → renewal
    """
    frontend_url = get_frontend_url().rstrip('/')
    plan_name = _plan_display(plan_key)
    period_end_str = _date_fr(period_end_date)
    amount_str = f"{amount_eur:.2f} €".replace('.', ',')

    is_new = billing_reason == 'subscription_create'
    subject = (
        f"🎉 Votre abonnement Retail Performer AI est activé — {plan_name}"
        if is_new else
        f"✅ Renouvellement confirmé — {plan_name}"
    )
    header_title = "Abonnement activé 🎉" if is_new else "Renouvellement confirmé ✅"
    intro = (
        f"Votre abonnement <strong>{plan_name}</strong> est maintenant actif. "
        f"Votre équipe a accès à toutes les fonctionnalités de Retail Performer AI."
        if is_new else
        f"Votre abonnement <strong>{plan_name}</strong> a été renouvelé avec succès."
    )

    invoice_button = ""
    if invoice_url:
        invoice_button = f"""
        <div style="text-align: center; margin: 20px 0;">
            <a href="{invoice_url}"
               style="background: #6366f1; color: white; padding: 12px 28px; border-radius: 8px;
                      text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
                📄 Voir la facture
            </a>
        </div>"""

    html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">{header_title}</h1>
    </div>
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Bonjour {recipient_name},</p>
        <p style="font-size: 16px;">{intro}</p>
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #666;">Plan</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">{plan_name}</td>
                </tr>
                <tr style="border-top: 1px solid #eee;">
                    <td style="padding: 8px 0; color: #666;">Montant prélevé</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">{amount_str}</td>
                </tr>
                <tr style="border-top: 1px solid #eee;">
                    <td style="padding: 8px 0; color: #666;">Prochain renouvellement</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">{period_end_str}</td>
                </tr>
            </table>
        </div>
        {invoice_button}
        <div style="text-align: center; margin: 24px 0;">
            <a href="{frontend_url}/dashboard"
               style="background: #F97316; color: white; padding: 12px 28px; border-radius: 8px;
                      text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
                Accéder à mon dashboard
            </a>
        </div>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
            Retail Performer AI · <a href="mailto:hello@retailperformerai.com" style="color: #999;">hello@retailperformerai.com</a><br>
            © 2025 Tous droits réservés
        </p>
    </div>
</body>
</html>"""

    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject=subject,
            html_content=html_content,
        )
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Payment confirmation email sent to {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending payment confirmation email to {recipient_email}: {e}")
        return False


def send_payment_failed_email(
    recipient_email: str,
    recipient_name: str,
    amount_eur: float,
    attempt_count: int,
    next_retry_date: str = None,
) -> bool:
    """
    Email sent when a payment attempt fails (invoice.payment_failed).
    """
    frontend_url = get_frontend_url().rstrip('/')
    amount_str = f"{amount_eur:.2f} €".replace('.', ',')

    retry_row = ""
    if next_retry_date:
        retry_row = f"""
                <tr style="border-top: 1px solid #eee;">
                    <td style="padding: 8px 0; color: #666;">Prochain essai automatique</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">{_date_fr(next_retry_date)}</td>
                </tr>"""

    html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Échec de paiement</h1>
    </div>
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Bonjour {recipient_name},</p>
        <p style="font-size: 16px;">
            Le prélèvement de votre abonnement <strong>Retail Performer AI</strong> a échoué.
            Votre accès reste actif pendant que Stripe retente automatiquement le paiement.
        </p>
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #EF4444;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #666;">Montant dû</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">{amount_str}</td>
                </tr>
                <tr style="border-top: 1px solid #eee;">
                    <td style="padding: 8px 0; color: #666;">Tentative n°</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">{attempt_count}</td>
                </tr>
                {retry_row}
            </table>
        </div>
        <div style="background: #FEF3C7; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #F59E0B;">
            <p style="margin: 0; font-size: 14px; color: #92400E;">
                💡 <strong>Action requise :</strong> Mettez à jour votre moyen de paiement pour éviter
                toute interruption de service.
            </p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
            <a href="{frontend_url}/dashboard"
               style="background: #EF4444; color: white; padding: 14px 32px; border-radius: 8px;
                      text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                Mettre à jour ma carte bancaire
            </a>
        </div>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
            Retail Performer AI · <a href="mailto:hello@retailperformerai.com" style="color: #999;">hello@retailperformerai.com</a><br>
            © 2025 Tous droits réservés
        </p>
    </div>
</body>
</html>"""

    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject="⚠️ Échec de paiement — Retail Performer AI",
            html_content=html_content,
        )
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Payment failed email sent to {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending payment failed email to {recipient_email}: {e}")
        return False


def send_subscription_canceled_email(
    recipient_email: str,
    recipient_name: str,
    access_end_date: str,
) -> bool:
    """
    Email sent when subscription is definitively canceled (customer.subscription.deleted).
    """
    frontend_url = get_frontend_url().rstrip('/')
    access_end_str = _date_fr(access_end_date)

    html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Abonnement annulé</h1>
    </div>
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Bonjour {recipient_name},</p>
        <p style="font-size: 16px;">
            Votre abonnement <strong>Retail Performer AI</strong> a été annulé.
            L'accès de votre équipe sera désactivé à la date ci-dessous.
        </p>
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #F97316; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 14px;">Fin d'accès</p>
            <p style="margin: 8px 0 0; font-size: 22px; font-weight: bold; color: #EA580C;">{access_end_str}</p>
        </div>
        <p style="font-size: 15px;">
            Vous souhaitez revenir ? Votre espace et les données de votre équipe sont conservés.
            Il vous suffit de souscrire à nouveau depuis votre dashboard.
        </p>
        <div style="text-align: center; margin: 28px 0;">
            <a href="{frontend_url}/dashboard"
               style="background: #F97316; color: white; padding: 14px 32px; border-radius: 8px;
                      text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                Réactiver mon abonnement
            </a>
        </div>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
            Une question ? <a href="mailto:hello@retailperformerai.com" style="color: #F97316;">hello@retailperformerai.com</a><br>
            Retail Performer AI · © 2025 Tous droits réservés
        </p>
    </div>
</body>
</html>"""

    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject="Votre abonnement Retail Performer AI a été annulé",
            html_content=html_content,
        )
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Subscription canceled email sent to {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending subscription canceled email to {recipient_email}: {e}")
        return False


def send_trial_ending_email(
    recipient_email: str,
    recipient_name: str,
    days_left: int,
    trial_end_date: str,
) -> bool:
    """
    Email sent ~3 days before trial ends (customer.subscription.trial_will_end).
    """
    frontend_url = get_frontend_url().rstrip('/')
    trial_end_str = _date_fr(trial_end_date)
    days_label = f"{days_left} jour{'s' if days_left > 1 else ''}"

    html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #F97316 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⏳ Votre essai se termine bientôt</h1>
    </div>
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Bonjour {recipient_name},</p>
        <p style="font-size: 16px;">
            Votre période d'essai <strong>Retail Performer AI</strong> se termine dans
            <strong>{days_label}</strong>, le <strong>{trial_end_str}</strong>.
        </p>
        <p style="font-size: 15px;">
            Après cette date, votre équipe n'aura plus accès à l'application.
            Souscrivez maintenant pour continuer sans interruption.
        </p>
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #667eea;">Ce que vous gardez avec un abonnement :</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="padding: 6px 0;">✅ Dashboard Gérant, Manager &amp; Vendeur</li>
                <li style="padding: 6px 0;">✅ Coaching IA &amp; Briefs Matinaux</li>
                <li style="padding: 6px 0;">✅ Suivi KPI, Objectifs &amp; Challenges</li>
                <li style="padding: 6px 0;">✅ Diagnostics &amp; Analyses IA illimitées</li>
                <li style="padding: 6px 0;">✅ Toutes vos données conservées</li>
            </ul>
        </div>
        <div style="text-align: center; margin: 28px 0;">
            <a href="{frontend_url}/dashboard"
               style="background: #F97316; color: white; padding: 14px 32px; border-radius: 8px;
                      text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                Souscrire maintenant
            </a>
        </div>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
            Une question ? <a href="mailto:hello@retailperformerai.com" style="color: #F97316;">hello@retailperformerai.com</a><br>
            Retail Performer AI · © 2025 Tous droits réservés
        </p>
    </div>
</body>
</html>"""

    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject=f"⏳ Plus que {days_label} d'essai — Retail Performer AI",
            html_content=html_content,
        )
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"Trial ending email sent to {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending trial ending email to {recipient_email}: {e}")
        return False


def send_cgu_update_email(recipient_email: str, recipient_name: str, new_version: str) -> bool:
    """
    Email de notification envoyé aux utilisateurs lorsque les CGU/Politique de confidentialité
    sont mises à jour. Conforme LCEN / RGPD.
    """
    frontend_url = get_frontend_url().rstrip('/')
    terms_link = f"{frontend_url}/terms"
    privacy_link = f"{frontend_url}/privacy"

    html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Mise à jour de nos conditions</h1>
    <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">Retail Performer AI — version {new_version}</p>
  </div>

  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Bonjour <strong>{recipient_name}</strong>,</p>

    <p>Nous avons mis à jour nos <strong>Conditions Générales d'Utilisation</strong> et notre
    <strong>Politique de Confidentialité</strong> (version {new_version}).</p>

    <p>Nous vous invitons à en prendre connaissance avant de continuer à utiliser Retail Performer AI :</p>

    <div style="margin: 24px 0; display: flex; gap: 12px; flex-wrap: wrap;">
      <a href="{terms_link}" style="display: inline-block; background-color: #1E40AF; color: white;
         padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-right: 12px;">
        Lire les CGU
      </a>
      <a href="{privacy_link}" style="display: inline-block; background-color: #F97316; color: white;
         padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        Politique de confidentialité
      </a>
    </div>

    <p style="color: #6B7280; font-size: 14px;">
      En continuant à utiliser Retail Performer AI après cette notification, vous acceptez les
      nouvelles conditions. Si vous avez des questions, contactez-nous à
      <a href="mailto:hello@retailperformerai.com" style="color: #F97316;">hello@retailperformerai.com</a>.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
      SKY CO — 25 Allée Rose Dieng-Kuntz, 75019 Paris<br>
      Vous recevez cet email car vous avez un compte actif sur Retail Performer AI.
    </p>
  </div>
</body>
</html>"""

    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
            subject=f"📋 Mise à jour de nos CGU — Retail Performer AI ({new_version})",
            html_content=html_content,
        )
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        logger.info(f"CGU update email sent to {recipient_email}: {api_response}")
        return True
    except ApiException as e:
        logger.error(f"Error sending CGU update email to {recipient_email}: {e}")
        return False

