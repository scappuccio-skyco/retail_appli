"""SuperAdmin Routes - Clean Architecture"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict
from datetime import datetime, timezone, timedelta

from core.security import get_super_admin
from services.admin_service import AdminService
from repositories.admin_repository import AdminRepository
from api.dependencies import get_db

router = APIRouter(prefix="/superadmin", tags=["SuperAdmin"])


def get_admin_service(db = Depends(get_db)) -> AdminService:
    """Dependency injection for AdminService"""
    admin_repo = AdminRepository(db)
    return AdminService(admin_repo)


@router.get("/workspaces")
async def get_workspaces(
    current_user: Dict = Depends(get_super_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Get all workspaces with details"""
    try:
        return await admin_service.get_workspaces_with_details()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_platform_stats(
    current_user: Dict = Depends(get_super_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Get platform-wide statistics"""
    try:
        return await admin_service.get_platform_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs")
async def get_logs(
    limit: int = Query(50, ge=1, le=1000),
    days: int = Query(7, ge=1, le=90),
    current_user: Dict = Depends(get_super_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """
    Get system logs for monitoring (alias for /system-logs with days param)
    
    Args:
        limit: Maximum number of logs to return (1-1000)
        days: Number of days to look back (1-90)
    """
    try:
        hours = days * 24
        return await admin_service.get_system_logs(hours=hours, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check(
    current_user: Dict = Depends(get_super_admin)
):
    """
    Health check endpoint for SuperAdmin dashboard
    
    Returns system status
    """
    return {
        "status": "ok",
        "service": "retail-performer-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0"
    }



@router.get("/system-logs")
async def get_system_logs(
    limit: int = Query(100, ge=1, le=1000),
    hours: int = Query(24, ge=1, le=168),
    current_user: Dict = Depends(get_super_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Get system logs filtered by time window"""
    try:
        return await admin_service.get_system_logs(hours=hours, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== SUPER ADMIN MANAGEMENT =====

@router.get("/admins")
async def get_super_admins(
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Get all super admins"""
    admins = await db.users.find(
        {"role": "super_admin"},
        {"_id": 0, "password_hash": 0, "password": 0}  # Exclude both password fields
    ).to_list(100)
    
    return {"admins": admins}


@router.post("/admins")
async def add_super_admin(
    email: str = Query(...),
    name: str = Query(...),
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Add a new super admin"""
    from uuid import uuid4
    from core.security import get_password_hash
    import secrets
    
    # Check if email already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        if existing.get('role') == 'super_admin':
            raise HTTPException(status_code=400, detail="Cet email est déjà super admin")
        raise HTTPException(status_code=400, detail="Cet email existe déjà dans le système")
    
    # Generate temp password
    temp_password = secrets.token_urlsafe(12)
    
    # Create super admin
    new_admin = {
        "id": str(uuid4()),
        "email": email,
        "name": name,
        "role": "super_admin",
        "status": "active",
        "password_hash": get_password_hash(temp_password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user['id']
    }
    
    await db.users.insert_one(new_admin)
    
    # Log action
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "add_super_admin",
        "admin_email": current_user['email'],
        "admin_name": current_user.get('name', 'Admin'),
        "details": {"new_admin_email": email, "new_admin_name": name}
    })
    
    return {
        "message": "Super admin ajouté avec succès",
        "temporary_password": temp_password,
        "admin_id": new_admin['id']
    }


@router.delete("/admins/{admin_id}")
async def remove_super_admin(
    admin_id: str,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Remove a super admin (cannot remove yourself)"""
    from uuid import uuid4
    
    if admin_id == current_user['id']:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous supprimer vous-même")
    
    # Find admin to remove
    admin_to_remove = await db.users.find_one({"id": admin_id, "role": "super_admin"})
    if not admin_to_remove:
        raise HTTPException(status_code=404, detail="Super admin non trouvé")
    
    # Remove admin
    await db.users.delete_one({"id": admin_id})
    
    # Log action
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "remove_super_admin",
        "admin_email": current_user['email'],
        "admin_name": current_user.get('name', 'Admin'),
        "details": {"removed_admin_email": admin_to_remove['email']}
    })
    
    return {"message": "Super admin supprimé avec succès"}


# ===== INVITATIONS MANAGEMENT =====

@router.get("/invitations")
async def get_all_invitations(
    status: str = Query(None),
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Get all gérant invitations"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        invitations = await db.gerant_invitations.find(query, {"_id": 0}).to_list(1000)
        
        # Enrich with gérant info
        for invite in invitations:
            gerant = await db.users.find_one(
                {"id": invite.get("gerant_id")}, 
                {"_id": 0, "name": 1, "email": 1}
            )
            if gerant:
                invite["gerant_name"] = gerant.get("name", "N/A")
                invite["gerant_email"] = gerant.get("email", "N/A")
        
        return invitations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/invitations/{invitation_id}")
async def delete_invitation(
    invitation_id: str,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Delete an invitation"""
    from uuid import uuid4
    
    invitation = await db.gerant_invitations.find_one({"id": invitation_id}, {"_id": 0})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation non trouvée")
    
    await db.gerant_invitations.delete_one({"id": invitation_id})
    
    # Log action
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "delete_invitation",
        "admin_email": current_user['email'],
        "admin_name": current_user.get('name', 'Admin'),
        "details": {"invitation_id": invitation_id}
    })
    
    return {"message": "Invitation supprimée avec succès"}


# ===== AI ASSISTANT ENDPOINTS =====

@router.get("/ai-assistant/conversations")
async def get_ai_conversations(
    limit: int = Query(20, ge=1, le=100),
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Get AI assistant conversation history (last 7 days)"""
    try:
        since = datetime.now(timezone.utc) - timedelta(days=7)
        
        conversations = await db.ai_conversations.find(
            {
                "admin_email": current_user['email'],
                "created_at": {"$gte": since.isoformat()}
            },
            {"_id": 0}
        ).sort("updated_at", -1).limit(limit).to_list(limit)
        
        return {
            "conversations": conversations,
            "total": len(conversations)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-assistant/chat")
async def chat_with_ai_assistant(
    message: Dict,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Send a message to the AI assistant"""
    from uuid import uuid4
    
    try:
        user_message = message.get("message", "")
        conversation_id = message.get("conversation_id")
        
        # Create new conversation if needed
        if not conversation_id:
            conversation_id = str(uuid4())
            await db.ai_conversations.insert_one({
                "id": conversation_id,
                "admin_email": current_user['email'],
                "admin_name": current_user.get('name', 'Admin'),
                "title": user_message[:50] + "..." if len(user_message) > 50 else user_message,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Save user message
        await db.ai_messages.insert_one({
            "id": str(uuid4()),
            "conversation_id": conversation_id,
            "role": "user",
            "content": user_message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Generate AI response (simplified - integrate with actual AI service if needed)
        ai_response = f"Je suis l'assistant IA du SuperAdmin. Vous avez demandé: '{user_message}'. Cette fonctionnalité est en cours de développement."
        
        # Save AI response
        await db.ai_messages.insert_one({
            "id": str(uuid4()),
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Update conversation
        await db.ai_conversations.update_one(
            {"id": conversation_id},
            {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "conversation_id": conversation_id,
            "response": ai_response
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-assistant/conversation/{conversation_id}")
async def get_conversation_messages(
    conversation_id: str,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Get messages for a specific conversation"""
    try:
        conversation = await db.ai_conversations.find_one(
            {"id": conversation_id, "admin_email": current_user['email']},
            {"_id": 0}
        )
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation non trouvée")
        
        messages = await db.ai_messages.find(
            {"conversation_id": conversation_id},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(1000)
        
        return {
            "conversation": conversation,
            "messages": messages
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/ai-assistant/conversation/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Delete a conversation and its messages"""
    try:
        conversation = await db.ai_conversations.find_one(
            {"id": conversation_id, "admin_email": current_user['email']}
        )
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation non trouvée")
        
        await db.ai_messages.delete_many({"conversation_id": conversation_id})
        await db.ai_conversations.delete_one({"id": conversation_id})
        
        return {"message": "Conversation supprimée avec succès"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== RESEND INVITATION =====

@router.post("/invitations/{invitation_id}/resend")
async def resend_invitation(
    invitation_id: str,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Resend an invitation email"""
    from uuid import uuid4
    
    try:
        invitation = await db.gerant_invitations.find_one({"id": invitation_id}, {"_id": 0})
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation non trouvée")
        
        # Get recipient info
        recipient_name = invitation.get('name', invitation['email'].split('@')[0])
        recipient_email = invitation['email']
        role = invitation.get('role', 'manager')
        
        # Try to send email using Brevo if available
        email_sent = False
        try:
            import sib_api_v3_sdk
            from sib_api_v3_sdk.rest import ApiException
            import os
            
            brevo_key = os.environ.get('BREVO_API_KEY')
            if brevo_key:
                configuration = sib_api_v3_sdk.Configuration()
                configuration.api_key['api-key'] = brevo_key
                api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
                
                frontend_url = os.environ.get('FRONTEND_URL', 'https://app.retail-performer.com')
                invite_link = f"{frontend_url}/invitation/{invitation['token']}"
                
                send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                    to=[{"email": recipient_email, "name": recipient_name}],
                    sender={"email": "noreply@retail-performer.com", "name": "Retail Performer"},
                    subject=f"[Rappel] Invitation à rejoindre Retail Performer",
                    html_content=f"""
                    <html>
                    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #6366f1;">Rappel: Invitation à rejoindre Retail Performer</h2>
                        <p>Bonjour {recipient_name},</p>
                        <p>Ceci est un rappel pour votre invitation à rejoindre Retail Performer en tant que <strong>{role}</strong>.</p>
                        <p>Cliquez sur le bouton ci-dessous pour accepter votre invitation :</p>
                        <p style="text-align: center; margin: 30px 0;">
                            <a href="{invite_link}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                Accepter l'invitation
                            </a>
                        </p>
                        <p style="color: #666; font-size: 12px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>{invite_link}</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #999; font-size: 11px;">Cet email a été envoyé par Retail Performer. Si vous n'êtes pas concerné, ignorez ce message.</p>
                    </body>
                    </html>
                    """
                )
                
                api_instance.send_transac_email(send_smtp_email)
                email_sent = True
        except Exception as e:
            # Log but don't fail - email service might not be configured
            print(f"Email service error (non-fatal): {e}")
        
        # Update invitation with resend timestamp
        await db.gerant_invitations.update_one(
            {"id": invitation_id},
            {"$set": {
                "last_resent_at": datetime.now(timezone.utc).isoformat(),
                "resend_count": (invitation.get('resend_count', 0) + 1)
            }}
        )
        
        # Log action
        await db.audit_logs.insert_one({


# ===== STRIPE SUBSCRIPTIONS OVERVIEW =====

@router.get("/subscriptions/overview")
async def get_subscriptions_overview(
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """
    Vue d'ensemble de tous les abonnements Stripe des gérants.
    Affiche statuts, paiements, prorations, etc.
    """
    try:
        # Get all gérants
        gerants = await db.users.find(
            {"role": "gerant"},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "stripe_customer_id": 1, "created_at": 1}
        ).to_list(None)
        
        subscriptions_data = []
        
        for gerant in gerants:
            # Get subscription
            subscription = await db.subscriptions.find_one(
                {"user_id": gerant['id']},
                {"_id": 0}
            )
            
            # Count active sellers
            active_sellers_count = await db.users.count_documents({
                "gerant_id": gerant['id'],
                "role": "seller",
                "status": "active"
            })
            
            # Get last transaction
            last_transaction = await db.payment_transactions.find_one(
                {"user_id": gerant['id']},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
            
            # Get AI credits usage
            team_members = await db.users.find(
                {"gerant_id": gerant['id']},
                {"_id": 0, "id": 1}
            ).to_list(None)
            
            team_ids = [member['id'] for member in team_members]
            
            ai_credits_total = 0
            if team_ids:
                pipeline = [
                    {"$match": {"user_id": {"$in": team_ids}}},
                    {"$group": {"_id": None, "total": {"$sum": "$credits_consumed"}}}
                ]
                result = await db.ai_usage_logs.aggregate(pipeline).to_list(None)
                if result:
                    ai_credits_total = result[0]['total']
            
            subscriptions_data.append({
                "gerant": {
                    "id": gerant['id'],
                    "name": gerant.get('name', 'N/A'),
                    "email": gerant.get('email', 'N/A'),
                    "created_at": gerant.get('created_at')
                },
                "subscription": subscription,
                "active_sellers_count": active_sellers_count,
                "last_transaction": last_transaction,
                "ai_credits_used": ai_credits_total
            })
        
        # Global stats
        total_gerants = len(gerants)
        active_subscriptions = sum(1 for s in subscriptions_data if s['subscription'] and s['subscription'].get('status') in ['active', 'trialing'])
        trialing_subscriptions = sum(1 for s in subscriptions_data if s['subscription'] and s['subscription'].get('status') == 'trialing')
        total_mrr = sum(
            s['subscription'].get('seats', 0) * s['subscription'].get('price_per_seat', 0)
            for s in subscriptions_data
            if s['subscription'] and s['subscription'].get('status') == 'active'
        )
        
        return {
            "summary": {
                "total_gerants": total_gerants,
                "active_subscriptions": active_subscriptions,
                "trialing_subscriptions": trialing_subscriptions,
                "total_mrr": round(total_mrr, 2)
            },
            "subscriptions": subscriptions_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

            "id": str(uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": "resend_invitation",
            "admin_email": current_user['email'],
            "admin_name": current_user.get('name', 'Admin'),
            "details": {
                "invitation_id": invitation_id,
                "email": recipient_email,
                "role": role,
                "email_sent": email_sent
            }
        })
        
        if email_sent:
            return {"success": True, "message": f"Invitation renvoyée à {recipient_email}"}
        else:
            return {"success": True, "message": f"Invitation marquée comme renvoyée (email non configuré)", "warning": "Email service not configured"}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



