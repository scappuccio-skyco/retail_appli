"""
Email functions for scheduled jobs (weekly recap, silent seller alerts).
Kept separate from email_service.py to avoid making that file even larger.
"""
import logging
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from email_service import get_brevo_api_instance, get_frontend_url, SENDER_NAME, SENDER_EMAIL

logger = logging.getLogger(__name__)


def send_weekly_gerant_recap(recipient_email: str, recipient_name: str, data: dict) -> bool:
    """Email récap hebdo envoyé au gérant chaque lundi matin."""
    frontend_url = get_frontend_url().rstrip('/')
    dashboard_link = f"{frontend_url}/gerant-dashboard"

    evo_total = data.get("total_evolution")
    if evo_total is None:
        evo_str = '<span style="color:#9ca3af;">Pas de données semaine précédente</span>'
    elif evo_total >= 0:
        evo_str = f'<span style="color:#16a34a;font-weight:bold;">&#9650; +{evo_total}%</span>'
    else:
        evo_str = f'<span style="color:#dc2626;font-weight:bold;">&#9660; {evo_total}%</span>'

    stores_rows = ""
    for s in data.get("stores", []):
        s_evo = s.get("evolution")
        if s_evo is None:
            s_evo_str = '<span style="color:#9ca3af;">—</span>'
        elif s_evo >= 0:
            s_evo_str = f'<span style="color:#16a34a;">+{s_evo}%</span>'
        else:
            s_evo_str = f'<span style="color:#dc2626;">{s_evo}%</span>'
        stores_rows += (
            f'<tr style="border-bottom:1px solid #f3f4f6;">'
            f'<td style="padding:10px 8px;font-weight:500;">{s["name"]}</td>'
            f'<td style="padding:10px 8px;text-align:right;font-weight:bold;">{s["ca"]:,.0f} €</td>'
            f'<td style="padding:10px 8px;text-align:right;">{s["ventes"]}</td>'
            f'<td style="padding:10px 8px;text-align:center;">{s_evo_str}</td>'
            f'</tr>'
        )

    top_seller_block = ""
    ts = data.get("top_seller")
    if ts:
        top_seller_block = (
            '<div style="background:#fff7ed;border:1px solid #f97316;border-radius:8px;padding:16px;margin:20px 0;">'
            '<p style="margin:0;font-size:14px;color:#ea580c;font-weight:bold;">🏆 Top vendeur de la semaine</p>'
            f'<p style="margin:6px 0 0;font-size:16px;"><strong>{ts["name"]}</strong>'
            f' — {ts["store"]} — {ts["ca"]:,.0f} €</p>'
            '</div>'
        )

    html_content = (
        '<!DOCTYPE html><html><head><meta charset="UTF-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
        '<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">'
        '<div style="background:linear-gradient(135deg,#1E40AF 0%,#1E3A8A 100%);padding:28px;text-align:center;border-radius:10px 10px 0 0;">'
        '<h1 style="color:white;margin:0;font-size:22px;">📊 Récap de la semaine</h1>'
        f'<p style="color:rgba(255,255,255,0.85);margin-top:8px;">{data["week_start"]} — {data["week_end"]}</p>'
        '</div>'
        '<div style="background:#f9f9f9;padding:28px;border-radius:0 0 10px 10px;">'
        f'<p style="font-size:16px;">Bonjour <strong>{recipient_name}</strong>,</p>'
        '<div style="background:white;padding:20px;border-radius:8px;margin:16px 0;text-align:center;border-left:4px solid #1E40AF;">'
        '<p style="margin:0;font-size:14px;color:#6b7280;">CA total tous magasins</p>'
        f'<p style="margin:4px 0;font-size:32px;font-weight:bold;color:#1E40AF;">{data["total_ca"]:,.0f} €</p>'
        f'<p style="margin:0;">{evo_str}</p>'
        '</div>'
        '<table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;margin:16px 0;">'
        '<thead><tr style="background:#f3f4f6;">'
        '<th style="padding:10px 8px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Magasin</th>'
        '<th style="padding:10px 8px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;">CA</th>'
        '<th style="padding:10px 8px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;">Ventes</th>'
        '<th style="padding:10px 8px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">Évolution</th>'
        '</tr></thead>'
        f'<tbody>{stores_rows}</tbody>'
        '</table>'
        f'{top_seller_block}'
        f'<div style="text-align:center;margin-top:24px;">'
        f'<a href="{dashboard_link}" style="background:#F97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Voir le tableau de bord</a>'
        '</div>'
        '<p style="font-size:12px;color:#9ca3af;margin-top:24px;text-align:center;">Retail Performer AI — récap automatique chaque lundi</p>'
        '</div></body></html>'
    )

    try:
        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"name": SENDER_NAME, "email": SENDER_EMAIL},
            subject=f"📊 Récap semaine du {data['week_start']} — {data['total_ca']:,.0f} €",
            html_content=html_content,
        )
        get_brevo_api_instance().send_transac_email(send_smtp_email)
        logger.info("Weekly recap sent to %s", recipient_email)
        return True
    except ApiException as e:
        logger.error("Error sending weekly recap to %s: %s", recipient_email, e)
        return False


def send_silent_seller_alert(recipient_email: str, recipient_name: str, data: dict) -> bool:
    """Email d'alerte vendeurs silencieux envoyé au manager."""
    frontend_url = get_frontend_url().rstrip('/')
    dashboard_link = f"{frontend_url}/dashboard"

    sellers_list = ""
    for s in data.get("sellers", []):
        days = s.get("days_ago", 0)
        label = f"il y a {days} jour{'s' if days > 1 else ''}"
        sellers_list += (
            f'<li style="padding:8px 0;border-bottom:1px solid #f3f4f6;">'
            f'👤 <strong>{s["name"]}</strong> — dernier KPI'
            f' <span style="color:#dc2626;">{label}</span></li>'
        )

    count = len(data.get("sellers", []))
    subject_label = f"{count} vendeur{'s' if count > 1 else ''} sans saisie KPI"

    html_content = (
        '<!DOCTYPE html><html><head><meta charset="UTF-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
        '<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">'
        '<div style="background:linear-gradient(135deg,#1E40AF 0%,#1E3A8A 100%);padding:28px;text-align:center;border-radius:10px 10px 0 0;">'
        '<h1 style="color:white;margin:0;font-size:22px;">⚠️ Saisie KPI en retard</h1>'
        f'<p style="color:rgba(255,255,255,0.85);margin-top:8px;">{subject_label} dans votre équipe</p>'
        '</div>'
        '<div style="background:#f9f9f9;padding:28px;border-radius:0 0 10px 10px;">'
        f'<p style="font-size:16px;">Bonjour <strong>{recipient_name}</strong>,</p>'
        '<p>Les vendeurs suivants n\'ont pas saisi leurs KPI depuis 2 jours ou plus :</p>'
        f'<ul style="list-style:none;padding:8px 16px;background:white;border-radius:8px;margin:16px 0;">{sellers_list}</ul>'
        '<p style="font-size:14px;color:#6b7280;">Pensez à les relancer depuis leur fiche vendeur.</p>'
        f'<div style="text-align:center;margin-top:24px;">'
        f'<a href="{dashboard_link}" style="background:#F97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Voir mon tableau de bord</a>'
        '</div>'
        '<p style="font-size:12px;color:#9ca3af;margin-top:24px;text-align:center;">Retail Performer AI — alerte automatique quotidienne</p>'
        '</div></body></html>'
    )

    try:
        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": recipient_email, "name": recipient_name}],
            sender={"name": SENDER_NAME, "email": SENDER_EMAIL},
            subject=f"⚠️ {subject_label}",
            html_content=html_content,
        )
        get_brevo_api_instance().send_transac_email(send_smtp_email)
        logger.info("Silent seller alert sent to %s", recipient_email)
        return True
    except ApiException as e:
        logger.error("Error sending silent seller alert to %s: %s", recipient_email, e)
        return False
