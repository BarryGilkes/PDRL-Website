import logging
from typing import Optional

from fastapi import Request
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.admins import Admins
from schemas.auth import UserResponse

logger = logging.getLogger(__name__)


async def check_and_link_admin(
    current_user: UserResponse,
    db: AsyncSession
) -> Optional[Admins]:
    """
    Check if user is an admin and link their account if needed.
    
    This function:
    1. Checks if user_id already exists in admins table
    2. If not, checks if email matches a pending admin
    3. If email matches, updates the admin record with the actual user_id
    
    Returns the admin record if user is an admin, None otherwise.
    """
    try:
        # First, try to find admin by user_id
        result = await db.execute(
            select(Admins).where(Admins.user_id == str(current_user.id))
        )
        admin = result.scalar_one_or_none()
        
        if admin:
            return admin
        
        # If not found by user_id, check by email for pending admins
        result = await db.execute(
            select(Admins).where(
                or_(
                    Admins.email == current_user.email,
                    Admins.user_id.like("pending_%")
                )
            ).where(Admins.email == current_user.email)
        )
        pending_admin = result.scalar_one_or_none()
        
        if pending_admin:
            # Link the admin account to the actual user_id
            logger.info(f"Linking admin account {pending_admin.email} to user_id {current_user.id}")
            pending_admin.user_id = str(current_user.id)
            await db.commit()
            await db.refresh(pending_admin)
            return pending_admin
        
        return None
        
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        return None