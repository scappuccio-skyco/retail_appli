"""Staff invitation methods for GerantService."""
import logging
import os
from typing import Dict, Optional
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


class StaffInvitationMixin:

    async def _check_seat_limit(self, gerant_id: str) -> None:
        """
        Guard clause: vérifie que le gérant n'a pas atteint sa limite de sièges vendeur.
        Appliqué uniquement pour les abonnements actifs/past_due (pas pendant le trial).
        Raises ValueError si la limite est atteinte.
        """
        from core.exceptions import ForbiddenError

        # Récupérer le workspace pour connaître le statut
        gerant = await self.user_repo.find_one({"id": gerant_id}, {"_id": 0, "workspace_id": 1})
        if not gerant or not gerant.get("workspace_id"):
            return  # Pas de workspace → check_gerant_active_access a déjà levé

        workspace = await self.workspace_repo.find_by_id(gerant["workspace_id"], projection={"_id": 0})
        if not workspace:
            return

        subscription_status = workspace.get("subscription_status", "inactive")

        # Pendant le trial : pas de limite de seats (exploration libre)
        if subscription_status not in ("active", "past_due"):
            return

        # Récupérer les seats achetés depuis la subscription locale
        db_sub = await self.subscription_repo.find_by_user_and_status(
            gerant_id, ["active", "past_due"]
        )
        if not db_sub:
            return  # Pas de subscription locale → Stripe gère, on ne bloque pas

        seats_purchased = db_sub.get("seats", 0)
        if not seats_purchased:
            return  # Seats non renseignés → on ne bloque pas

        # Compter vendeurs actifs + invitations vendeur en attente
        active_sellers = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })
        pending_invitations = await self.gerant_invitation_repo.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "pending"
        })
        total_used = active_sellers + pending_invitations

        if total_used >= seats_purchased:
            raise ForbiddenError(
                f"Limite de sièges atteinte : {seats_purchased} siège{'s' if seats_purchased > 1 else ''} achetés, "
                f"{active_sellers} vendeur{'s' if active_sellers > 1 else ''} actif{'s' if active_sellers > 1 else ''} "
                f"et {pending_invitations} invitation{'s' if pending_invitations > 1 else ''} en attente. "
                f"Augmentez votre abonnement pour inviter plus de vendeurs."
            )

    async def send_invitation(self, invitation_data: Dict, gerant_id: str) -> Dict:
        """
        Send an invitation to a new manager or seller.

        Args:
            invitation_data: Contains name, email, role, store_id
            gerant_id: ID of the gérant sending the invitation
        """
        from uuid import uuid4
        import os

        # === GUARD CLAUSE: Check subscription access ===
        await self.check_gerant_active_access(gerant_id)

        name = invitation_data.get('name')
        email = invitation_data.get('email')
        role = invitation_data.get('role')
        store_id = invitation_data.get('store_id')

        if not all([name, email, role, store_id]):
            raise ValueError("Tous les champs sont requis: name, email, role, store_id")

        if role not in ['manager', 'seller']:
            raise ValueError("Le rôle doit être 'manager' ou 'seller'")

        # === GUARD CLAUSE: Check seat limits for seller invitations ===
        if role == 'seller':
            await self._check_seat_limit(gerant_id)

        # Verify store belongs to this gérant
        store = await self.store_repo.find_one(
            {"id": store_id, "gerant_id": gerant_id, "active": True}
        )
        if not store:
            raise ValueError("Magasin non trouvé ou inactif")

        # Check if email already exists
        existing_user = await self.user_repo.find_one({"email": email})
        if existing_user:
            raise ValueError("Un utilisateur avec cet email existe déjà")

        # Check for pending invitation
        existing_invitation = await self.gerant_invitation_repo.find_by_email(
            email, gerant_id=gerant_id, status="pending"
        )
        if existing_invitation:
            raise ValueError("Une invitation est déjà en attente pour cet email")

        # For sellers: automatically assign manager_id if there's a manager in the store
        manager_id = None
        manager_name = None
        if role == 'seller':
            # Find active manager in the store
            manager = await self.user_repo.find_one({
                "role": "manager",
                "store_id": store_id,
                "status": "active"
            })
            if manager:
                manager_id = manager.get('id')
                manager_name = manager.get('name')
                logger.info(f"Auto-assigning seller invitation to manager {manager_name} ({manager_id}) for store {store_id}")
            else:
                logger.warning(f"No active manager found for store {store_id} when creating seller invitation")

        # Create invitation
        invitation_id = str(uuid4())
        token = str(uuid4())

        invitation = {
            "id": invitation_id,
            "token": token,
            "email": email,
            "name": name,
            "role": role,
            "store_id": store_id,
            "store_name": store.get('name'),
            "gerant_id": gerant_id,
            "manager_id": manager_id,  # Auto-assigned for sellers
            "manager_name": manager_name,  # For email display
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0) +
                         __import__('datetime').timedelta(days=7)).isoformat()
        }

        await self.gerant_invitation_repo.create_invitation(invitation, gerant_id)

        # Send email
        try:
            await self._send_invitation_email(invitation)
        except Exception as e:
            logger.error(f"Failed to send invitation email: {e}")
            # Continue even if email fails - invitation is created

        return {
            "message": "Invitation envoyée avec succès",
            "invitation_id": invitation_id
        }

    async def _send_invitation_email(self, invitation: Dict):
        """Send invitation email using Brevo"""
        import httpx

        # Get environment variables
        brevo_api_key = os.environ.get('BREVO_API_KEY')
        environment = os.environ.get('ENVIRONMENT', 'development')
        cors_origins = os.environ.get('CORS_ORIGINS', '')

        # Determine frontend URL based on environment
        frontend_url = os.environ.get('FRONTEND_URL', '')

        # In production, extract URL from CORS_ORIGINS if FRONTEND_URL is not properly set
        if not frontend_url or 'localhost' in frontend_url:
            # Try to get production URL from CORS_ORIGINS
            if cors_origins and cors_origins != '*':
                origins = [o.strip() for o in cors_origins.split(',')]
                # Prefer retailperformerai.com
                for origin in origins:
                    if 'retailperformerai.com' in origin:
                        frontend_url = origin
                        break
                if not frontend_url and origins:
                    frontend_url = origins[0]  # Use first origin as fallback
                logger.info(f"[INVITATION EMAIL] Using URL from CORS_ORIGINS: {frontend_url}")

        # Fallback for local development
        if not frontend_url or frontend_url == '*':
            frontend_url = 'http://localhost:3000'
            # Try loading from .env file
            try:
                from dotenv import dotenv_values
                env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
                env_vars = dotenv_values(env_path)
                env_frontend = env_vars.get('FRONTEND_URL', '')
                if env_frontend:
                    frontend_url = env_frontend
            except Exception:
                pass

        if not brevo_api_key:
            # Try loading from .env file as fallback for local dev
            try:
                from dotenv import dotenv_values
                env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
                env_vars = dotenv_values(env_path)
                brevo_api_key = env_vars.get('BREVO_API_KEY')
            except Exception as e:
                logger.warning(f"Could not load .env file: {e}")

        if not brevo_api_key:
            logger.warning("BREVO_API_KEY not set, skipping email")
            return

        logger.info(f"Sending invitation email to {invitation['email']}")
        logger.info(f"[INVITATION EMAIL] Environment: {environment}")
        logger.info(f"[INVITATION EMAIL] CORS_ORIGINS: {cors_origins}")
        logger.info(f"[INVITATION EMAIL] Final FRONTEND_URL: {frontend_url}")

        # Remove trailing slash to avoid double slashes in URL
        frontend_url = frontend_url.rstrip('/')

        invitation_link = f"{frontend_url}/invitation/{invitation['token']}"

        # Use role-specific templates with features list
        if invitation['role'] == 'manager':
            # Manager invitation template
            store_info = f" pour le magasin <strong>{invitation['store_name']}</strong>" if invitation.get('store_name') else ""
            gerant_name = invitation.get('gerant_name') or "Votre gérant"

            email_content = f"""
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
                    <p style="font-size: 16px;">Bonjour {invitation['name']},</p>

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
                            <li style="padding: 8px 0;">📋 <strong>Générer bilans, briefing et entretiens annuels</strong> en 1 clic avec l'IA</li>
                            <li style="padding: 8px 0;">🤝 <strong>Conseils IA relationnels</strong> adaptés à chaque profil DISC de vos vendeurs</li>
                        </ul>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{invitation_link}"
                           style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%);
                                  color: white;
                                  padding: 15px 40px;
                                  text-decoration: none;
                                  border-radius: 25px;
                                  font-size: 16px;
                                  font-weight: bold;
                                  display: inline-block;
                                  box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4);">
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
            email_subject = f"👋 {gerant_name} vous invite à rejoindre Retail Performer AI"
        else:
            # Seller invitation template
            store_info = f" du magasin <strong>{invitation['store_name']}</strong>" if invitation.get('store_name') else ""
            manager_name = invitation.get('manager_name') or invitation.get('gerant_name') or "Votre manager"

            email_content = f"""
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
                    <p style="font-size: 16px;">Bonjour {invitation['name']},</p>

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
                            <li style="padding: 8px 0;">📋 Préparer votre évaluation annuelle</li>
                        </ul>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{invitation_link}"
                           style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%);
                                  color: white;
                                  padding: 15px 40px;
                                  text-decoration: none;
                                  border-radius: 25px;
                                  font-size: 16px;
                                  font-weight: bold;
                                  display: inline-block;
                                  box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4);">
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
            email_subject = f"🌟 {manager_name} vous invite à rejoindre l'équipe !"

        # Get sender email from environment
        sender_email = os.environ.get('SENDER_EMAIL', 'hello@retailperformerai.com')
        sender_name = os.environ.get('SENDER_NAME', 'Retail Performer AI')

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload = {
                    "sender": {"name": sender_name, "email": sender_email},
                    "to": [{"email": invitation['email'], "name": invitation['name']}],
                    "subject": email_subject,
                    "htmlContent": email_content
                }

                logger.info("📧 Sending email via Brevo:")
                logger.info(f"   - From: {sender_name} <{sender_email}>")
                logger.info(f"   - To: {invitation['name']} <{invitation['email']}>")
                logger.info(f"   - Subject: {email_subject}")

                response = await client.post(
                    "https://api.brevo.com/v3/smtp/email",
                    headers={
                        "api-key": brevo_api_key,
                        "Content-Type": "application/json"
                    },
                    json=payload
                )

                if response.status_code in [200, 201]:
                    response_data = response.json() if response.text else {}
                    message_id = response_data.get('messageId', 'N/A')
                    logger.info(f"✅ Email sent successfully to {invitation['email']}")
                    logger.info(f"   - Brevo Response: {response.status_code}")
                    logger.info(f"   - Message ID: {message_id}")
                else:
                    logger.error(f"❌ Brevo API error ({response.status_code}): {response.text}")
        except Exception as e:
            logger.error(f"❌ Failed to send email: {str(e)}")

    async def get_invitations(self, gerant_id: str) -> list:
        """Get all invitations sent by this gérant"""
        invitations = await self.gerant_invitation_repo.find_by_gerant(
            gerant_id,
            projection={"_id": 0},
            limit=100,
            sort=[("created_at", -1)]
        )

        return invitations

    async def cancel_invitation(self, invitation_id: str, gerant_id: str) -> Dict:
        """Cancel a pending invitation"""
        invitation = await self.gerant_invitation_repo.find_by_id(invitation_id, gerant_id=gerant_id)

        if not invitation:
            raise ValueError("Invitation non trouvée")

        if invitation.get('status') != 'pending':
            raise ValueError("Seules les invitations en attente peuvent être annulées")

        await self.gerant_invitation_repo.update_invitation(
            invitation_id,
            {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()},
            gerant_id=gerant_id
        )

        return {"message": "Invitation annulée"}

    async def resend_invitation(self, invitation_id: str, gerant_id: str) -> Dict:
        """Resend an invitation email"""
        from uuid import uuid4

        invitation = await self.gerant_invitation_repo.find_by_id(invitation_id, gerant_id=gerant_id)

        if not invitation:
            raise ValueError("Invitation non trouvée")

        if invitation.get('status') not in ['pending', 'expired']:
            raise ValueError("Seules les invitations en attente ou expirées peuvent être renvoyées")

        # Generate new token and update expiration
        new_token = str(uuid4())
        new_expiry = (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0) + timedelta(days=7)).isoformat()

        await self.gerant_invitation_repo.update_invitation(
            invitation_id,
            {
                "token": new_token,
                "status": "pending",
                "expires_at": new_expiry,
                "resent_at": datetime.now(timezone.utc).isoformat()
            },
            gerant_id=gerant_id
        )

        # Refresh invitation data with new token
        invitation['token'] = new_token

        # Send email
        try:
            await self._send_invitation_email(invitation)
            return {"message": "Invitation renvoyée avec succès"}
        except Exception as e:
            logger.error(f"Failed to resend invitation email: {e}")
            return {"message": "Invitation mise à jour mais email non envoyé"}
