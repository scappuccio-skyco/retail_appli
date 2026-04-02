import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'hello@retailperformerai.com')
SENDER_NAME = os.environ.get('SENDER_NAME', 'Retail Performer AI')
RECIPIENT_EMAIL = os.environ.get('RECIPIENT_EMAIL', 'hello@retailperformerai.com')

_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'templates', 'email')


def _load_template(name: str) -> str:
    with open(os.path.join(_TEMPLATES_DIR, name), encoding='utf-8') as f:
        return f.read()


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


# ─────────────────────────────────────────────────────────────────────────────
# SUBSCRIPTION / PAYMENT HELPERS
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


# ─────────────────────────────────────────────────────────────────────────────
# INVITATION EMAILS
# ─────────────────────────────────────────────────────────────────────────────

def send_gerant_invitation_email(recipient_email: str, recipient_name: str, invitation_token: str):
    """
    Envoyer un email d'invitation à un nouveau Gérant
    """
    frontend_url = get_frontend_url().rstrip('/')
    invitation_link = f"{frontend_url}/register/gerant/{invitation_token}"

    html_content = _load_template('gerant_invitation.html').format(
        recipient_name=recipient_name,
        invitation_link=invitation_link,
    )

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
    frontend_url = get_frontend_url().rstrip('/')
    invitation_link = f"{frontend_url}/register/manager/{invitation_token}"
    store_info = f" pour le magasin <strong>{store_name}</strong>" if store_name else ""

    html_content = _load_template('manager_invitation.html').format(
        recipient_name=recipient_name,
        gerant_name=gerant_name,
        store_info=store_info,
        invitation_link=invitation_link,
    )

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
    frontend_url = get_frontend_url().rstrip('/')
    invitation_link = f"{frontend_url}/register/seller/{invitation_token}"
    store_info = f" du magasin <strong>{store_name}</strong>" if store_name else ""

    html_content = _load_template('seller_invitation.html').format(
        recipient_name=recipient_name,
        manager_name=manager_name,
        store_info=store_info,
        invitation_link=invitation_link,
    )

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


# ─────────────────────────────────────────────────────────────────────────────
# ACCOUNT EMAILS
# ─────────────────────────────────────────────────────────────────────────────

def send_password_reset_email(recipient_email: str, recipient_name: str, reset_token: str):
    """
    Envoyer un email de réinitialisation de mot de passe
    """
    frontend_url = get_frontend_url().rstrip('/')
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    html_content = _load_template('password_reset.html').format(
        recipient_name=recipient_name,
        reset_link=reset_link,
        recipient_email=recipient_email,
    )

    send_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": recipient_email, "name": recipient_name}],
        sender={"email": SENDER_EMAIL, "name": SENDER_NAME},
        subject="Réinitialisation de votre mot de passe - Retail Performer AI",
        html_content=html_content
    )

    try:
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

    html_content = _load_template('gerant_welcome.html').format(
        recipient_name=recipient_name,
        login_link=login_link,
    )

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


# ─────────────────────────────────────────────────────────────────────────────
# EARLY ACCESS EMAILS
# ─────────────────────────────────────────────────────────────────────────────

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
    html_content = _load_template('early_access_qualification.html').format(
        full_name=full_name,
        email=email,
        enseigne=enseigne,
        nombre_vendeurs=nombre_vendeurs,
        defi_principal=defi_principal,
    )

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

    html_content = _load_template('early_access_confirmation.html').format(
        full_name=full_name,
        enseigne=enseigne,
        calendly_url=calendly_url,
        signup_url=signup_url,
    )

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


# ─────────────────────────────────────────────────────────────────────────────
# STAFF EMAIL UPDATE EMAILS
# ─────────────────────────────────────────────────────────────────────────────

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

    html_content = _load_template('staff_email_update_confirmation.html').format(
        recipient_name=recipient_name,
        new_email=new_email,
        login_link=login_link,
    )

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
    html_content = _load_template('staff_email_update_alert.html').format(
        recipient_name=recipient_name,
        gerant_name=gerant_name,
        new_email=new_email,
    )

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
        invoice_button = (
            f'<div style="text-align: center; margin: 20px 0;">'
            f'<a href="{invoice_url}"'
            f' style="background: #6366f1; color: white; padding: 12px 28px; border-radius: 8px;'
            f' text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">'
            f'📄 Voir la facture</a></div>'
        )

    html_content = _load_template('payment_confirmation.html').format(
        header_title=header_title,
        recipient_name=recipient_name,
        intro=intro,
        plan_name=plan_name,
        amount_str=amount_str,
        period_end_str=period_end_str,
        invoice_button=invoice_button,
        frontend_url=frontend_url,
    )

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
        retry_row = (
            f'<tr style="border-top: 1px solid #eee;">'
            f'<td style="padding: 8px 0; color: #666;">Prochain essai automatique</td>'
            f'<td style="padding: 8px 0; font-weight: bold; text-align: right;">{_date_fr(next_retry_date)}</td>'
            f'</tr>'
        )

    html_content = _load_template('payment_failed.html').format(
        recipient_name=recipient_name,
        amount_str=amount_str,
        attempt_count=attempt_count,
        retry_row=retry_row,
        frontend_url=frontend_url,
    )

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

    html_content = _load_template('subscription_canceled.html').format(
        recipient_name=recipient_name,
        access_end_str=access_end_str,
        frontend_url=frontend_url,
    )

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

    html_content = _load_template('trial_ending.html').format(
        recipient_name=recipient_name,
        days_label=days_label,
        trial_end_str=trial_end_str,
        frontend_url=frontend_url,
    )

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

    html_content = _load_template('cgu_update.html').format(
        recipient_name=recipient_name,
        new_version=new_version,
        terms_link=terms_link,
        privacy_link=privacy_link,
    )

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
