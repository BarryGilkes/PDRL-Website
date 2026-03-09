import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

router = APIRouter(prefix="/api/v1/maintenance", tags=["maintenance"])
logger = logging.getLogger(__name__)

@router.post("/fix-competition-numbers")
async def fix_competition_numbers(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fix null competition numbers in registrations table (admin only)"""
    try:
        # Check for null competition_numbers
        result = await db.execute(
            text("SELECT id, driver_name, competition_number FROM registrations WHERE competition_number IS NULL")
        )
        null_records = result.fetchall()
        
        if not null_records:
            return {
                "success": True,
                "message": "All registrations already have competition numbers assigned",
                "fixed_count": 0
            }
        
        logger.info(f"Found {len(null_records)} registrations with null competition_number")
        
        # Get max competition number
        result = await db.execute(
            text("SELECT competition_number FROM registrations WHERE competition_number IS NOT NULL ORDER BY CAST(competition_number AS INTEGER) DESC LIMIT 1")
        )
        max_record = result.scalar()
        max_num = int(max_record) if max_record else 100
        
        # Update null records
        fixed_records = []
        for record in null_records:
            max_num += 1
            await db.execute(
                text("UPDATE registrations SET competition_number = :comp_num WHERE id = :id"),
                {"comp_num": str(max_num), "id": record[0]}
            )
            fixed_records.append({
                "id": record[0],
                "driver_name": record[1],
                "assigned_number": str(max_num)
            })
            logger.info(f"Assigned #{max_num} to {record[1]} (ID: {record[0]})")
        
        await db.commit()
        
        return {
            "success": True,
            "message": f"Successfully assigned competition numbers to {len(null_records)} registrations",
            "fixed_count": len(null_records),
            "fixed_records": fixed_records
        }
        
    except Exception as e:
        logger.error(f"Error fixing competition numbers: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to fix competition numbers: {str(e)}")