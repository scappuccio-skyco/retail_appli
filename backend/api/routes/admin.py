"""SuperAdmin Routes - Clean Architecture"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Dict, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from core.security import get_super_admin
from services.admin_service import AdminService
from repositories.admin_repository import AdminRepository
from api.dependencies import get_db

router = APIRouter(prefix="/superadmin", tags=["SuperAdmin"])


# Pydantic model for bulk status update
class BulkStatusUpdate(BaseModel):
    workspace_ids: List[str]
    status: str


def get_admin_service(db = Depends(get_db)) -> AdminService:
    """Dependency injection for AdminService"""
    admin_repo = AdminRepository(db)
    return AdminService(admin_repo)


@router.get("/workspaces")
async def get_workspaces(
    include_deleted: bool = Query(False, description="Inclure les workspaces supprimés"),
    current_user: Dict = Depends(get_super_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """
    Get all workspaces with details
    
    Args:
        include_deleted: If True, returns ALL workspaces including deleted/inactive ones.
                        Useful for recovering emails blocked by ghost workspaces.
    """
    try:
        return await admin_service.get_workspaces_with_details(include_deleted=include_deleted)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# IMPORTANT: Bulk route must be defined BEFORE the dynamic {workspace_id} route
@router.patch("/workspaces/bulk/status")
async def bulk_update_workspace_status(
    request_body: BulkStatusUpdate,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """
    Bulk update workspace statuses
    
    Args:
        request_body: BulkStatusUpdate with 'workspace_ids' (list) and 'status' (string)
    
    Returns:
        Summary of successful and failed updates
    """
    from uuid import uuid4
    
    workspace_ids = request_body.workspace_ids
    status = request_body.status
    
    if not workspace_ids:
        raise HTTPException(status_code=400, detail="Aucun workspace sélectionné")
    
    valid_statuses = ['active', 'suspended', 'deleted']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status invalide. Valeurs acceptées: {valid_statuses}")
    
    success_count = 0
    error_count = 0
    updated_workspaces = []
    
    for workspace_id in workspace_ids:
        try:
            # Find the workspace
            workspace = await db.workspaces.find_one({"id": workspace_id})
            if not workspace:
                error_count += 1
                continue
            
            old_status = workspace.get('status', 'active')
            
            # Skip if already in target status
            if old_status == status:
                success_count += 1
                continue
            
            # Update the status
            await db.workspaces.update_one(
                {"id": workspace_id},
                {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            updated_workspaces.append({
                "workspace_id": workspace_id,
                "workspace_name": workspace.get('name', 'N/A'),
                "old_status": old_status,
                "new_status": status
            })
            success_count += 1
            
        except Exception as e:
            error_count += 1
            print(f"Error updating workspace {workspace_id}: {e}")
    
    # Log the bulk action
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "bulk_workspace_status_change",
        "admin_email": current_user['email'],
        "admin_name": current_user.get('name', 'Admin'),
        "details": {
            "new_status": status,
            "total_requested": len(workspace_ids),
            "success_count": success_count,
            "error_count": error_count,
            "updated_workspaces": updated_workspaces
        }
    })
    
    status_label = 'réactivé(s)' if status == 'active' else 'suspendu(s)' if status == 'suspended' else 'supprimé(s)'
    
    return {
        "message": f"{success_count} workspace(s) {status_label} avec succès",
        "success_count": success_count,
        "error_count": error_count,
        "new_status": status
    }


@router.patch("/workspaces/{workspace_id}/status")
async def update_workspace_status(
    workspace_id: str,
    status: str = Query(..., description="New status: 'active', 'suspended', or 'deleted'"),
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """
    Update workspace status (activate, suspend, or delete)
    
    Args:
        workspace_id: The workspace ID
        status: New status - 'active', 'suspended', or 'deleted'
    """
    from uuid import uuid4
    
    valid_statuses = ['active', 'suspended', 'deleted']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status invalide. Valeurs acceptées: {valid_statuses}")
    
    # Find the workspace
    workspace = await db.workspaces.find_one({"id": workspace_id})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace non trouvé")
    
    old_status = workspace.get('status', 'active')
    
    # Update the status
    await db.workspaces.update_one(
        {"id": workspace_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log the action
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": f"workspace_status_change",
        "admin_email": current_user['email'],
        "admin_name": current_user.get('name', 'Admin'),
        "details": {
            "workspace_id": workspace_id,
            "workspace_name": workspace.get('name', 'N/A'),
            "old_status": old_status,
            "new_status": status
        }
    })
    
    return {
        "message": f"Statut du workspace mis à jour: {old_status} → {status}",
        "workspace_id": workspace_id,
        "new_status": status
    }


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


@router.patch("/invitations/{invitation_id}")
async def update_invitation(
    invitation_id: str,
    update_data: Dict,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Update an invitation"""
    from uuid import uuid4
    
    invitation = await db.gerant_invitations.find_one({"id": invitation_id}, {"_id": 0})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation non trouvée")
    
    # Allowed fields to update
    allowed_fields = ['email', 'role', 'store_name', 'status', 'name']
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields and v is not None}
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="Aucun champ valide à mettre à jour")
    
    # Add updated_at timestamp
    update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.gerant_invitations.update_one(
        {"id": invitation_id},
        {"$set": update_fields}
    )
    
    # Log action
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "update_invitation",
        "admin_email": current_user['email'],
        "admin_name": current_user.get('name', 'Admin'),
        "details": {"invitation_id": invitation_id, "updated_fields": list(update_fields.keys())}
    })
    
    return {"message": "Invitation mise à jour avec succès"}


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
    """Send a message to the AI assistant with real platform data context"""
    from uuid import uuid4
    import os
    
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
        
        # ===== FETCH REAL PLATFORM DATA =====
        # Count users by role
        total_users = await db.users.count_documents({})
        total_gerants = await db.users.count_documents({"role": "gerant"})
        total_managers = await db.users.count_documents({"role": "manager"})
        total_sellers = await db.users.count_documents({"role": "seller"})
        active_sellers = await db.users.count_documents({"role": "seller", "status": "active"})
        suspended_users = await db.users.count_documents({"status": "suspended"})
        
        # Count stores
        total_stores = await db.stores.count_documents({})
        active_stores = await db.stores.count_documents({"active": True})
        
        # Subscriptions
        total_subscriptions = await db.subscriptions.count_documents({})
        active_subscriptions = await db.subscriptions.count_documents({"status": "active"})
        trial_subscriptions = await db.subscriptions.count_documents({"status": "trialing"})
        
        # KPIs (last 30 days)
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%d')
        recent_kpis = await db.kpi_entries.count_documents({"date": {"$gte": thirty_days_ago}})
        
        # Invitations
        pending_invitations = await db.gerant_invitations.count_documents({"status": "pending"})
        
        # Recent activity
        recent_logins = await db.users.count_documents({
            "last_login": {"$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}
        })
        
        # Top performing stores (if data available)
        top_stores_pipeline = [
            {"$match": {"date": {"$gte": thirty_days_ago}}},
            {"$group": {"_id": "$store_id", "total_ca": {"$sum": "$ca_journalier"}, "total_ventes": {"$sum": "$nb_ventes"}}},
            {"$sort": {"total_ca": -1}},
            {"$limit": 5}
        ]
        top_stores_data = await db.kpi_entries.aggregate(top_stores_pipeline).to_list(5)
        
        # Build platform data context
        platform_context = f"""
=== DONNÉES EN TEMPS RÉEL DE LA PLATEFORME (à {datetime.now().strftime('%d/%m/%Y %H:%M')}) ===

📊 UTILISATEURS:
- Total: {total_users} utilisateurs
- Gérants: {total_gerants}
- Managers: {total_managers}  
- Vendeurs: {total_sellers} ({active_sellers} actifs, {total_sellers - active_sellers} inactifs)
- Utilisateurs suspendus: {suspended_users}
- Connexions récentes (7 jours): {recent_logins}

🏪 MAGASINS:
- Total: {total_stores} magasins
- Actifs: {active_stores}
- Inactifs: {total_stores - active_stores}

💳 ABONNEMENTS:
- Total: {total_subscriptions}
- Actifs (payants): {active_subscriptions}
- En essai (trial): {trial_subscriptions}

📈 ACTIVITÉ (30 derniers jours):
- Entrées KPI enregistrées: {recent_kpis}
- Invitations en attente: {pending_invitations}

"""
        
        # Add top stores if available
        if top_stores_data:
            platform_context += "🏆 TOP 5 MAGASINS (CA sur 30 jours):\n"
            for i, store in enumerate(top_stores_data, 1):
                store_info = await db.stores.find_one({"id": store["_id"]}, {"_id": 0, "name": 1})
                store_name = store_info.get("name", store["_id"]) if store_info else store["_id"]
                platform_context += f"   {i}. {store_name}: {store['total_ca']:.0f}€ CA, {store['total_ventes']} ventes\n"
        
        # Get conversation history for context
        previous_messages = await db.ai_messages.find(
            {"conversation_id": conversation_id},
            {"_id": 0, "role": 1, "content": 1}
        ).sort("timestamp", 1).to_list(20)
        
        # Build context from history
        history_context = ""
        for msg in previous_messages[-6:]:  # Last 6 messages
            role = "User" if msg["role"] == "user" else "Assistant"
            history_context += f"{role}: {msg['content']}\n"
        
        # Generate AI response using Emergent LLM
        ai_response = "Désolé, je n'ai pas pu générer une réponse."
        
        try:
            from emergentintegrations.llm.openai import LlmChat, UserMessage
            
            llm_key = os.environ.get('EMERGENT_LLM_KEY', 'sk-emergent-dB388Be0647671cF21')
            
            system_prompt = f"""Tu es l'assistant IA expert de la plateforme Retail Performer, dédié aux Super Administrateurs.

{platform_context}

Tu as accès aux données ci-dessus en temps réel. Utilise-les pour répondre aux questions avec précision.

Tu peux aider avec:
- L'analyse des données et statistiques de la plateforme
- L'identification des tendances et problèmes
- Les recommandations pour améliorer les performances
- L'explication des fonctionnalités
- Le diagnostic des problèmes

Historique de la conversation:
{history_context}

INSTRUCTIONS:
- Réponds de manière précise en utilisant les données réelles ci-dessus
- Donne des chiffres concrets quand c'est pertinent
- Fais des analyses et recommandations basées sur les données
- Sois concis et professionnel
- Réponds en français"""
            
            chat = LlmChat(
                api_key=llm_key,
                session_id=conversation_id,
                system_message=system_prompt
            )
            
            ai_response = await chat.send_message(
                user_message=UserMessage(text=user_message)
            )
            
        except Exception as ai_error:
            print(f"AI Error: {ai_error}")
            ai_response = f"Je rencontre des difficultés techniques. Erreur: {str(ai_error)[:100]}"
        
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
        email_error = None
        try:
            import sib_api_v3_sdk
            from sib_api_v3_sdk.rest import ApiException
            import os
            
            brevo_key = os.environ.get('BREVO_API_KEY')
            sender_email = os.environ.get('SENDER_EMAIL', 'hello@retailperformerai.com')
            
            if brevo_key:
                configuration = sib_api_v3_sdk.Configuration()
                configuration.api_key['api-key'] = brevo_key
                api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
                
                # Use the frontend URL from environment
                frontend_url = os.environ.get('FRONTEND_URL', 'https://retailperformerai.com')
                invite_link = f"{frontend_url}/invitation/{invitation.get('token', 'invalid')}"
                
                send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                    to=[{"email": recipient_email, "name": recipient_name}],
                    sender={"email": sender_email, "name": "Retail Performer"},
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
                
                result = api_instance.send_transac_email(send_smtp_email)
                email_sent = True
                print(f"Email resend successful to {recipient_email}, message_id: {result.message_id}")
        except ApiException as api_err:
            email_error = f"Brevo API error: {api_err.status} - {api_err.body}"
            print(email_error)
        except Exception as e:
            email_error = f"Email service error: {str(e)}"
            print(email_error)
        
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
            error_msg = email_error if email_error else "Email service not configured"
            return {"success": False, "message": f"Échec de l'envoi à {recipient_email}", "error": error_msg}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== TRIAL MANAGEMENT =====

@router.get("/gerants/trials")
async def get_gerants_trials(
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """
    Get all gérants with their trial information.
    Used by TrialManagement component.
    """
    try:
        # Get all gérants
        gerants = await db.users.find(
            {"role": "gerant"},
            {"_id": 0, "password_hash": 0, "password": 0}
        ).to_list(None)
        
        result = []
        for gerant in gerants:
            # Get subscription info
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
            
            result.append({
                "id": gerant['id'],
                "name": gerant.get('name', 'N/A'),
                "email": gerant.get('email', 'N/A'),
                "created_at": gerant.get('created_at'),
                "trial_end": subscription.get('trial_end') if subscription else None,
                "trial_start": subscription.get('trial_start') if subscription else None,
                "has_subscription": subscription.get('status') == 'active' if subscription else False,
                "subscription_status": subscription.get('status') if subscription else None,
                "active_sellers_count": active_sellers_count
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/gerants/{gerant_id}/trial")
async def update_gerant_trial(
    gerant_id: str,
    trial_data: Dict,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """
    Update trial end date for a gérant.
    """
    from uuid import uuid4
    
    try:
        # Verify gérant exists
        gerant = await db.users.find_one({"id": gerant_id, "role": "gerant"})
        if not gerant:
            raise HTTPException(status_code=404, detail="Gérant non trouvé")
        
        # Get or create subscription
        subscription = await db.subscriptions.find_one({"user_id": gerant_id})
        
        new_trial_end = trial_data.get('trial_end')
        if not new_trial_end:
            raise HTTPException(status_code=400, detail="trial_end est requis")
        
        # Parse and validate date
        try:
            from datetime import datetime
            trial_end_date = datetime.fromisoformat(new_trial_end.replace('Z', '+00:00'))
        except:
            # Try parsing as simple date
            trial_end_date = datetime.strptime(new_trial_end, '%Y-%m-%d')
        
        if subscription:
            # Update existing subscription
            await db.subscriptions.update_one(
                {"user_id": gerant_id},
                {"$set": {
                    "trial_end": trial_end_date.isoformat(),
                    "status": "trialing",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # Create new subscription with trial
            await db.subscriptions.insert_one({
                "id": str(uuid4()),
                "user_id": gerant_id,
                "plan": "trial",
                "status": "trialing",
                "trial_start": datetime.now(timezone.utc).isoformat(),
                "trial_end": trial_end_date.isoformat(),
                "current_period_start": datetime.now(timezone.utc).isoformat(),
                "current_period_end": trial_end_date.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "ai_credits_remaining": 100,
                "seats": 5
            })
        
        # Log action
        await db.audit_logs.insert_one({
            "id": str(uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": "update_trial",
            "admin_email": current_user['email'],
            "admin_name": current_user.get('name', 'Admin'),
            "details": {
                "gerant_id": gerant_id,
                "gerant_email": gerant.get('email'),
                "new_trial_end": new_trial_end
            }
        })
        
        return {"message": "Période d'essai mise à jour avec succès", "trial_end": trial_end_date.isoformat()}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== STRIPE SUBSCRIPTIONS OVERVIEW =====

@router.get("/subscriptions/{gerant_id}/details")
async def get_subscription_details(
    gerant_id: str,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """
    Get detailed subscription info for a specific gérant.
    Includes subscription details, sellers count, and recent transactions.
    """
    try:
        # Get the gérant
        gerant = await db.users.find_one(
            {"id": gerant_id, "role": "gerant"},
            {"_id": 0}
        )
        
        if not gerant:
            raise HTTPException(status_code=404, detail="Gérant non trouvé")
        
        # Get subscription
        subscription = await db.subscriptions.find_one(
            {"user_id": gerant_id},
            {"_id": 0}
        )
        
        # Get sellers count (active and suspended)
        active_sellers = await db.users.count_documents({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })
        
        suspended_sellers = await db.users.count_documents({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "suspended"
        })
        
        total_sellers = await db.users.count_documents({
            "gerant_id": gerant_id,
            "role": "seller"
        })
        
        # Get recent transactions (last 20)
        transactions = await db.payment_transactions.find(
            {"user_id": gerant_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(20).to_list(20)
        
        # Get AI credits usage
        team_members = await db.users.find(
            {"gerant_id": gerant_id},
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
        
        return {
            "gerant": {
                "id": gerant['id'],
                "name": gerant.get('name', 'N/A'),
                "email": gerant.get('email', 'N/A'),
                "created_at": gerant.get('created_at')
            },
            "subscription": subscription,
            "sellers": {
                "active": active_sellers,
                "suspended": suspended_sellers,
                "total": total_sellers
            },
            "transactions": transactions,
            "ai_credits_used": ai_credits_total
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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



