"""AI assistant and conversations methods for AdminService."""
import uuid
import logging
from typing import Dict, Optional
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


class AiMixin:

    async def get_ai_conversations(
        self,
        admin_email: str,
        limit: int = 20,
        page: int = 1
    ) -> Dict:
        """
        Get paginated AI conversations for admin

        Args:
            admin_email: Admin email
            limit: Items per page (max 100)
            page: Page number (1-based)
        """
        if limit > 100:
            limit = 100

        skip = (page - 1) * limit

        # Get conversations from last 7 days
        since = datetime.now(timezone.utc) - timedelta(days=7)

        conversations = await self.ai_conversation_repo.find_many(
            {
                "admin_email": admin_email,
                "created_at": {"$gte": since.isoformat()}
            },
            limit=limit,
            skip=skip,
            sort=[("updated_at", -1)]
        )

        total = await self.ai_conversation_repo.count({
            "admin_email": admin_email,
            "created_at": {"$gte": since.isoformat()}
        })
        pages = (total + limit - 1) // limit

        return {
            "conversations": conversations,
            "total": total,
            "page": page,
            "pages": pages
        }

    async def get_conversation_messages(
        self,
        conversation_id: str,
        admin_email: str,
        page: int = 1,
        size: int = 100
    ) -> Dict:
        """
        Get messages for a specific conversation

        Args:
            conversation_id: Conversation ID
            admin_email: Admin email (for verification)
            page: Page number (1-based)
            size: Items per page (max 100)
        """
        if size > 100:
            size = 100

        # Verify conversation belongs to admin
        conversation = await self.ai_conversation_repo.find_one({
            "id": conversation_id,
            "admin_email": admin_email
        })

        if not conversation:
            raise ValueError("Conversation non trouvée")

        skip = (page - 1) * size

        # Get messages (paginated)
        messages = await self.ai_message_repo.find_many(
            {"conversation_id": conversation_id},
            limit=size,
            skip=skip,
            sort=[("timestamp", 1)]
        )

        total = await self.ai_message_repo.count({"conversation_id": conversation_id})
        pages = (total + size - 1) // size

        return {
            "conversation": conversation,
            "messages": messages,
            "total": total,
            "page": page,
            "pages": pages
        }

    async def get_app_context_for_ai(self) -> Dict:
        """
        Gather relevant application context for AI assistant
        Uses repositories only, no direct DB access
        """
        try:
            # Get recent errors (last 24h) - paginated, max 10
            last_24h = datetime.now(timezone.utc) - timedelta(hours=24)
            recent_errors = await self.system_log_repo.find_recent_logs(
                limit=10,
                filters={"level": "error", "timestamp": {"$gte": last_24h.isoformat()}}
            )

            # Get recent warnings - paginated, max 5
            recent_warnings = await self.system_log_repo.find_recent_logs(
                limit=5,
                filters={"level": "warning", "timestamp": {"$gte": last_24h.isoformat()}}
            )

            # Get recent admin actions (last 7 days) - paginated, max 20
            last_7d = datetime.now(timezone.utc) - timedelta(days=7)
            recent_actions = await self.admin_log_repo.find_recent_logs(
                hours=168,  # 7 days
                limit=20
            )

            # Get platform stats using repositories
            total_workspaces = await self.workspace_repo.count({})
            active_workspaces = await self.workspace_repo.count({"status": "active"})
            suspended_workspaces = await self.workspace_repo.count({"status": "suspended"})
            total_users = await self.user_repo.admin_count_all()

            # Get health status
            errors_24h = len(recent_errors)
            health_status = "healthy" if errors_24h < 10 else "warning" if errors_24h < 50 else "critical"

            context = {
                "platform_stats": {
                    "total_workspaces": total_workspaces,
                    "active_workspaces": active_workspaces,
                    "suspended_workspaces": suspended_workspaces,
                    "total_users": total_users,
                    "health_status": health_status
                },
                "recent_errors": recent_errors[:5],  # Top 5 errors
                "recent_warnings": recent_warnings[:3],  # Top 3 warnings
                "recent_actions": recent_actions[:10],  # Last 10 admin actions
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            return context
        except Exception as e:
            logger.error(f"Error gathering AI context: {str(e)}")
            return {}

    async def chat_with_ai_assistant(
        self,
        message: str,
        conversation_id: Optional[str],
        current_admin: Dict
    ) -> Dict:
        """
        Chat with AI assistant for troubleshooting and support

        Args:
            message: User message
            conversation_id: Optional conversation ID (for continuing conversation)
            current_admin: Current admin user dict
        """
        import json
        from services.ai_service import AIService

        # Get or create conversation
        if not conversation_id:
            # Create new conversation
            conversation_id = str(uuid.uuid4())
            conversation = {
                "id": conversation_id,
                "admin_email": current_admin['email'],
                "admin_name": current_admin.get('name', 'Admin'),
                "title": message[:50] + "..." if len(message) > 50 else message,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await self.ai_conversation_repo.insert_one(conversation)
        else:
            # Update existing conversation
            await self.ai_conversation_repo.update_one(
                {"id": conversation_id},
                {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )

        # Get app context
        app_context = await self.get_app_context_for_ai()

        # Get conversation history (paginated, max 100)
        history = await self.ai_message_repo.find_many(
            {"conversation_id": conversation_id},
            limit=100,
            sort=[("timestamp", 1)]
        )

        # Build system prompt
        system_prompt = f"""Tu es un assistant IA expert pour le SuperAdmin de Retail Performer AI, une plateforme SaaS de coaching commercial.

CONTEXTE DE L'APPLICATION:
{json.dumps(app_context, indent=2, ensure_ascii=False)}

TES CAPACITÉS:
1. Analyser les logs système et audit pour diagnostiquer les problèmes
2. Fournir des recommandations techniques précises
3. Suggérer des actions concrètes (avec validation admin requise)
4. Expliquer les fonctionnalités et l'architecture
5. Identifier les patterns d'erreurs et tendances

ACTIONS DISPONIBLES (toujours demander confirmation):
- reactivate_workspace: Réactiver un workspace suspendu
- change_workspace_plan: Changer le plan d'un workspace
- suspend_workspace: Suspendre un workspace problématique
- reset_ai_credits: Réinitialiser les crédits IA d'un workspace

STYLE DE RÉPONSE:
- Concis et technique
- Utilise le format Markdown pour une meilleure lisibilité :
  * Titres avec ## ou ### pour les sections
  * Listes à puces (-) ou numérotées (1.)
  * **Gras** pour les points importants
  * `code` pour les valeurs techniques
  * Sauts de ligne entre sections
- Utilise des emojis pour la lisibilité (🔍 analyse, ⚠️ alertes, ✅ solutions, 📊 stats)
- Structure tes réponses avec des sections claires et aérées
- Propose des actions concrètes quand nécessaire

Réponds toujours en français avec formatage Markdown."""

        # Use OpenAI via AIService
        ai_service = AIService()

        if ai_service.available:
            # Build user prompt with conversation history
            user_prompt_parts = []

            # Add conversation history (last 10 messages)
            for msg in history[-10:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    user_prompt_parts.append(f"Utilisateur: {content}")
                elif role == "assistant":
                    user_prompt_parts.append(f"Assistant: {content}")

            # Add current user message
            user_prompt_parts.append(f"Utilisateur: {message}")
            user_prompt = "\n\n".join(user_prompt_parts)

            # Get AI response using OpenAI
            ai_response = await ai_service._send_message(
                system_message=system_prompt,
                user_prompt=user_prompt,
                model="gpt-4o-mini",  # Use mini for cost efficiency
                temperature=0.7
            )

            if not ai_response:
                raise Exception("OpenAI service returned no response")
        else:
            # Fallback: Simple response if OpenAI not available
            logger.warning("OpenAI not available, using fallback response")
            ai_response = f"""🔍 **Analyse de votre demande**

Je comprends votre question : "{message}"

⚠️ **Note** : Le système OpenAI n'est pas configuré actuellement. Pour une assistance complète, veuillez configurer la clé API `OPENAI_API_KEY`.

**Contexte de la plateforme** :
- Workspaces actifs : {app_context.get('platform_stats', {}).get('active_workspaces', 0)}
- Erreurs récentes (24h) : {len(app_context.get('recent_errors', []))}
- Statut de santé : {app_context.get('platform_stats', {}).get('health_status', 'unknown')}

Pour obtenir de l'aide, vous pouvez :
1. Consulter les logs système via `/superadmin/system-logs`
2. Vérifier les actions admin récentes via `/superadmin/logs`
3. Examiner les workspaces via `/superadmin/workspaces`"""

        # Save user message
        user_msg = {
            "conversation_id": conversation_id,
            "role": "user",
            "content": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context": app_context
        }
        await self.ai_message_repo.insert_one(user_msg)

        # Save assistant message
        assistant_msg = {
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.ai_message_repo.insert_one(assistant_msg)

        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="ai_assistant_query",
            details={
                "conversation_id": conversation_id,
                "query_length": len(message),
                "response_length": len(ai_response)
            }
        )

        return {
            "conversation_id": conversation_id,
            "message": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context_used": {
                "errors_count": len(app_context.get('recent_errors', [])),
                "health_status": app_context.get('platform_stats', {}).get('health_status', 'unknown')
            }
        }
