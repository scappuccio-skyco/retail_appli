"""Admin user management methods for AdminService."""
import uuid
import bcrypt
import secrets
import logging
from typing import Dict, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class AdminsMixin:

    async def get_admins_paginated(
        self,
        page: int = 1,
        size: int = 50
    ) -> Dict:
        """
        Get paginated list of super admins

        Args:
            page: Page number (1-based)
            size: Items per page (max 100)
        """
        if size > 100:
            size = 100

        skip = (page - 1) * size

        admins = await self.user_repo.admin_find_all_paginated(
            role="super_admin",
            projection={"_id": 0, "password": 0},
            limit=size,
            skip=skip,
            sort=[("created_at", -1)]
        )

        total = await self.user_repo.admin_count_all(role="super_admin")
        pages = (total + size - 1) // size

        return {
            "admins": admins,
            "total": total,
            "page": page,
            "pages": pages
        }

    async def add_super_admin(
        self,
        email: str,
        name: str,
        current_admin: Dict
    ) -> Dict:
        """
        Add a new super admin

        Args:
            email: Admin email
            name: Admin name
            current_admin: Current admin user dict
        """
        # Check if user already exists
        existing = await self.user_repo.find_by_email(email)
        if existing:
            if existing.get('role') == 'super_admin':
                raise ValueError("Cet email est déjà super admin")
            else:
                raise ValueError("Cet email existe déjà avec un autre rôle")

        # Generate temporary password
        temp_password = secrets.token_urlsafe(16)
        hashed_password = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt())

        # Create new super admin
        new_admin = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password": hashed_password.decode('utf-8'),
            "name": name,
            "role": "super_admin",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_admin['email']
        }

        await self.user_repo.insert_one(new_admin)

        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="add_super_admin",
            details={
                "new_admin_email": email,
                "new_admin_name": name,
                "temp_password_generated": True
            }
        )

        return {
            "success": True,
            "email": email,
            "temporary_password": temp_password,
            "message": "Super admin ajouté. Envoyez-lui le mot de passe temporaire."
        }

    async def remove_super_admin(
        self,
        admin_id: str,
        current_admin: Dict
    ) -> Dict:
        """
        Remove a super admin (cannot remove yourself)

        Args:
            admin_id: Admin ID to remove
            current_admin: Current admin user dict
        """
        # Cannot remove yourself
        if admin_id == current_admin['id']:
            raise ValueError("Vous ne pouvez pas vous retirer vous-même")

        # Find admin to remove
        admin_to_remove = await self.user_repo.find_by_id(admin_id, include_password=False)
        if not admin_to_remove or admin_to_remove.get('role') != 'super_admin':
            raise ValueError("Super admin non trouvé")

        # Remove admin
        await self.user_repo.delete_one({"id": admin_id})
        from core.cache import invalidate_user_cache
        await invalidate_user_cache(admin_id)

        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="remove_super_admin",
            details={
                "removed_admin_email": admin_to_remove.get('email'),
                "removed_admin_name": admin_to_remove.get('name'),
                "removed_admin_id": admin_id
            }
        )

        return {"success": True, "message": "Super admin supprimé"}
