import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.admins import Admins
from schemas.auth import UserResponse
from services.admins import AdminsService
from middleware.admin_auth import check_and_link_admin

router = APIRouter(prefix="/api/v1/admin", tags=["admin_management"])
logger = logging.getLogger(__name__)


# ---------- Pydantic Schemas ----------
class AdminCheckResponse(BaseModel):
    """Response for admin status check"""
    is_admin: bool
    role: Optional[str] = None
    email: Optional[str] = None


class AddAdminRequest(BaseModel):
    """Request to add a new admin"""
    email: EmailStr
    role: str = "admin"  # admin or super_admin


class AdminListItem(BaseModel):
    """Admin list item"""
    id: int
    user_id: str
    email: str
    role: str
    added_by: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class AdminListResponse(BaseModel):
    """Admin list response"""
    admins: List[AdminListItem]
    total: int


# ---------- Routes ----------
@router.get("/check", response_model=AdminCheckResponse)
async def check_admin_status(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if the current user is an admin"""
    try:
        admin = await check_and_link_admin(current_user, db)
        
        if admin:
            return AdminCheckResponse(
                is_admin=True,
                role=admin.role,
                email=admin.email
            )
        else:
            return AdminCheckResponse(is_admin=False)
            
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check admin status: {str(e)}")


@router.get("/list", response_model=AdminListResponse)
async def list_admins(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all admins (requires admin access)"""
    try:
        # Check if current user is admin (and link account if needed)
        current_admin = await check_and_link_admin(current_user, db)
        
        if not current_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Get all admins
        result = await db.execute(select(Admins).order_by(Admins.created_at.desc()))
        admins = result.scalars().all()
        
        return AdminListResponse(
            admins=[AdminListItem.model_validate(admin) for admin in admins],
            total=len(admins)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing admins: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list admins: {str(e)}")


@router.post("/add", response_model=AdminListItem, status_code=201)
async def add_admin(
    request: AddAdminRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new admin (requires super_admin access)"""
    try:
        # Check if current user is super_admin (and link account if needed)
        current_admin = await check_and_link_admin(current_user, db)
        
        if not current_admin or current_admin.role != "super_admin":
            raise HTTPException(status_code=403, detail="Super admin access required")
        
        # Validate role
        if request.role not in ["admin", "super_admin"]:
            raise HTTPException(status_code=400, detail="Role must be 'admin' or 'super_admin'")
        
        # Check if admin already exists
        result = await db.execute(
            select(Admins).where(Admins.email == request.email)
        )
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            raise HTTPException(status_code=400, detail="Admin with this email already exists")
        
        # Create new admin with pending user_id
        service = AdminsService(db)
        new_admin = await service.create({
            "email": request.email,
            "role": request.role,
            "added_by": str(current_user.id),
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }, user_id=f"pending_{request.email.split('@')[0]}")  # Temporary user_id until first login
        
        logger.info(f"Admin {request.email} added by {current_user.id}")
        return AdminListItem.model_validate(new_admin)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding admin: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add admin: {str(e)}")


@router.delete("/{admin_id}")
async def remove_admin(
    admin_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an admin (requires super_admin access)"""
    try:
        # Check if current user is super_admin (and link account if needed)
        current_admin = await check_and_link_admin(current_user, db)
        
        if not current_admin or current_admin.role != "super_admin":
            raise HTTPException(status_code=403, detail="Super admin access required")
        
        # Prevent removing self
        if current_admin.id == admin_id:
            raise HTTPException(status_code=400, detail="Cannot remove yourself")
        
        # Get admin to remove
        result = await db.execute(
            select(Admins).where(Admins.id == admin_id)
        )
        admin_to_remove = result.scalar_one_or_none()
        
        if not admin_to_remove:
            raise HTTPException(status_code=404, detail="Admin not found")
        
        # Delete admin
        await db.delete(admin_to_remove)
        await db.commit()
        
        logger.info(f"Admin {admin_to_remove.email} removed by {current_user.id}")
        return {"message": "Admin removed successfully", "id": admin_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing admin: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to remove admin: {str(e)}")


@router.put("/{admin_id}/role")
async def update_admin_role(
    admin_id: int,
    role: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an admin's role (requires super_admin access)"""
    try:
        # Check if current user is super_admin (and link account if needed)
        current_admin = await check_and_link_admin(current_user, db)
        
        if not current_admin or current_admin.role != "super_admin":
            raise HTTPException(status_code=403, detail="Super admin access required")
        
        # Validate role
        if role not in ["admin", "super_admin"]:
            raise HTTPException(status_code=400, detail="Role must be 'admin' or 'super_admin'")
        
        # Prevent changing own role
        if current_admin.id == admin_id:
            raise HTTPException(status_code=400, detail="Cannot change your own role")
        
        # Get admin to update
        result = await db.execute(
            select(Admins).where(Admins.id == admin_id)
        )
        admin_to_update = result.scalar_one_or_none()
        
        if not admin_to_update:
            raise HTTPException(status_code=404, detail="Admin not found")
        
        # Update role
        admin_to_update.role = role
        await db.commit()
        await db.refresh(admin_to_update)
        
        logger.info(f"Admin {admin_to_update.email} role updated to {role} by {current_user.id}")
        return AdminListItem.model_validate(admin_to_update)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating admin role: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update admin role: {str(e)}")