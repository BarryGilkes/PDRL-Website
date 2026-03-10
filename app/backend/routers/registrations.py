import logging
import os
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from sqlalchemy import text
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.registrations import RegistrationsService

TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY", "0x4AAAAAACoNl2RnySwSRe6XwhDXxt8BvHE")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/registrations", tags=["registrations"])


class RegistrationCreate(BaseModel):
    event_id: int
    driver_name: str
    competition_number: str
    phone: str
    class_name: str
    car: str
    notes: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_status: str = "pending"
    submitted_at: str
    turnstile_token: Optional[str] = None


class RegistrationUpdate(BaseModel):
    driver_name: Optional[str] = None
    competition_number: Optional[str] = None
    phone: Optional[str] = None
    class_name: Optional[str] = None
    car: Optional[str] = None
    notes: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_status: Optional[str] = None


@router.post("")
async def create_registration(
    data: RegistrationCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new registration"""
    # Verify Turnstile token
    if not data.turnstile_token:
        logger.warning(f"Registration attempt without turnstile token from user {current_user.id}")
        raise HTTPException(status_code=400, detail="Security verification required. Please complete the captcha.")
    
    logger.info(f"Registration attempt with turnstile token from user {current_user.id}, token length: {len(data.turnstile_token)}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as http_client:
            verify_resp = await http_client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={
                    "secret": TURNSTILE_SECRET_KEY,
                    "response": data.turnstile_token,
                },
            )
            verify_data = verify_resp.json()
            if not verify_data.get("success"):
                logger.warning(f"Turnstile verification failed: {verify_data}")
                raise HTTPException(status_code=400, detail="Security verification failed. Please try again.")
    except httpx.HTTPError as e:
        logger.error(f"Turnstile verification request failed: {e}")
        raise HTTPException(status_code=500, detail="Security verification service unavailable. Please try again.")

    # Strip turnstile_token before saving and convert submitted_at to datetime
    reg_data = data.model_dump(exclude={"turnstile_token"})
    if reg_data.get("submitted_at") and isinstance(reg_data["submitted_at"], str):
        from datetime import datetime
        try:
            reg_data["submitted_at"] = datetime.fromisoformat(reg_data["submitted_at"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            reg_data["submitted_at"] = datetime.now()
    service = RegistrationsService(db)
    result = await service.create(reg_data, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=400, detail="Failed to create registration")
    return result


@router.get("/public")
async def get_public_registrations(
    skip: int = 0,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
):
    """Get all registrations - public endpoint for leaderboard (no authentication required)"""
    service = RegistrationsService(db)
    result = await service.get_list(skip=skip, limit=limit)
    return result


@router.get("/all")
async def get_all_registrations(
    skip: int = 0,
    limit: int = 100,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all registrations (admin only - requires authentication)"""
    service = RegistrationsService(db)
    # For now, any authenticated user can view all registrations
    # In production, add proper admin role checking
    result = await service.get_list(skip=skip, limit=limit)
    return result


@router.get("")
async def get_my_registrations(
    skip: int = 0,
    limit: int = 20,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's registrations"""
    service = RegistrationsService(db)
    result = await service.get_list(skip=skip, limit=limit, user_id=current_user.id)
    return result




@router.get("/lookup")
async def lookup_racer(
    q: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Search race_times for a driver by name or competition number.
    Returns distinct driver profiles for registration autocomplete.
    Public endpoint - no auth required."""
    if not q or len(q.strip()) < 2:
        return {"results": []}

    query_str = q.strip()

    # Search by competition number (if numeric) or driver name (fuzzy)
    if query_str.isdigit():
        sql = text("""
            SELECT DISTINCT ON (driver_name, competition_number)
                driver_name, competition_number
            FROM race_times
            WHERE competition_number::text LIKE :q
            ORDER BY driver_name, competition_number
            LIMIT 10
        """)
        params = {"q": f"{query_str}%"}
    else:
        sql = text("""
            SELECT DISTINCT ON (driver_name, competition_number)
                driver_name, competition_number
            FROM race_times
            WHERE LOWER(driver_name) LIKE LOWER(:q)
            ORDER BY driver_name, competition_number
            LIMIT 10
        """)
        params = {"q": f"%{query_str}%"}

    result = await db.execute(sql, params)
    rows = result.fetchall()

    # Also check previous registrations for more complete data (phone, car, class)
    profiles = []
    for row in rows:
        driver_name = row[0]
        comp_num = row[1]

        # Look up most recent registration for this driver
        reg_sql = text("""
            SELECT driver_name, competition_number, phone, class_name, car
            FROM registrations
            WHERE LOWER(driver_name) = LOWER(:name)
            OR competition_number = :comp_num
            ORDER BY id DESC
            LIMIT 1
        """)
        reg_result = await db.execute(reg_sql, {
            "name": driver_name,
            "comp_num": str(comp_num) if comp_num else "",
        })
        reg_row = reg_result.fetchone()

        if reg_row:
            profiles.append({
                "driver_name": reg_row[0],
                "competition_number": str(reg_row[1]) if reg_row[1] else str(comp_num or ""),
                "phone": reg_row[2] or "",
                "class_name": reg_row[3] or "",
                "car": reg_row[4] or "",
            })
        else:
            profiles.append({
                "driver_name": driver_name or "",
                "competition_number": str(comp_num) if comp_num else "",
                "phone": "",
                "class_name": "",
                "car": "",
            })

    return {"results": profiles}


@router.get("/{registration_id}")
async def get_registration(
    registration_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific registration"""
    service = RegistrationsService(db)
    result = await service.get_by_id(registration_id, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Registration not found")
    return result


@router.put("/{registration_id}")
async def update_registration(
    registration_id: int,
    data: RegistrationUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a registration"""
    service = RegistrationsService(db)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await service.update(registration_id, update_data, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Registration not found or unauthorized")
    return result


@router.delete("/{registration_id}")
async def delete_registration(
    registration_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a registration"""
    service = RegistrationsService(db)
    success = await service.delete(registration_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Registration not found or unauthorized")
    return {"message": "Registration deleted successfully"}