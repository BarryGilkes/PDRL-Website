"""Diagnostic endpoints for debugging data issues."""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/diagnostics", tags=["diagnostics"])


@router.get("/events-flyer-status")
async def check_events_flyer_status(db: AsyncSession = Depends(get_db)):
    """Check all events and their flyer_key values directly from the database."""
    try:
        result = await db.execute(
            text("SELECT id, title, date, status, flyer_key FROM events ORDER BY id DESC")
        )
        rows = result.fetchall()
        
        events_data = []
        for row in rows:
            events_data.append({
                "id": row[0],
                "title": row[1],
                "date": row[2],
                "status": row[3],
                "flyer_key": row[4],
                "has_flyer": row[4] is not None and row[4] != "",
            })
        
        total = len(events_data)
        with_flyer = sum(1 for e in events_data if e["has_flyer"])
        
        return {
            "total_events": total,
            "events_with_flyer": with_flyer,
            "events_without_flyer": total - with_flyer,
            "events": events_data,
        }
    except Exception as e:
        logger.error(f"Diagnostics error: {e}")
        return {"error": str(e)}


@router.post("/set-flyer-key")
async def set_flyer_key_directly(
    event_id: int,
    flyer_key: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Directly set flyer_key on an event. Pass empty or omit flyer_key to set NULL."""
    try:
        actual_key = flyer_key if flyer_key and flyer_key.strip() else None
        await db.execute(
            text("UPDATE events SET flyer_key = :flyer_key WHERE id = :event_id"),
            {"flyer_key": actual_key, "event_id": event_id},
        )
        await db.commit()
        
        # Verify
        result = await db.execute(
            text("SELECT id, title, flyer_key FROM events WHERE id = :event_id"),
            {"event_id": event_id},
        )
        row = result.fetchone()
        
        return {
            "success": True,
            "event_id": row[0] if row else event_id,
            "title": row[1] if row else "not found",
            "flyer_key": row[2] if row else None,
        }
    except Exception as e:
        logger.error(f"Set flyer key error: {e}")
        return {"error": str(e)}


@router.post("/add-flyer-url-column")
async def add_flyer_url_column(db: AsyncSession = Depends(get_db)):
    """Add flyer_url column to events table if it doesn't exist."""
    try:
        result = await db.execute(
            text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'events' AND column_name = 'flyer_url'
            """)
        )
        if result.fetchone():
            return {"success": True, "message": "flyer_url column already exists"}
        
        await db.execute(text("ALTER TABLE events ADD COLUMN flyer_url VARCHAR"))
        await db.commit()
        return {"success": True, "message": "flyer_url column added successfully"}
    except Exception as e:
        logger.error(f"Add column error: {e}")
        return {"error": str(e)}


@router.post("/set-flyer-url")
async def set_flyer_url_directly(
    event_id: int,
    flyer_url: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Directly set flyer_url on an event."""
    try:
        actual_url = flyer_url if flyer_url and flyer_url.strip() else None
        await db.execute(
            text("UPDATE events SET flyer_url = :flyer_url WHERE id = :event_id"),
            {"flyer_url": actual_url, "event_id": event_id},
        )
        await db.commit()
        
        result = await db.execute(
            text("SELECT id, title, flyer_url FROM events WHERE id = :event_id"),
            {"event_id": event_id},
        )
        row = result.fetchone()
        
        return {
            "success": True,
            "event_id": row[0] if row else event_id,
            "title": row[1] if row else "not found",
            "flyer_url": row[2] if row else None,
        }
    except Exception as e:
        logger.error(f"Set flyer url error: {e}")
        return {"error": str(e)}


@router.get("/check-column")
async def check_column_exists(db: AsyncSession = Depends(get_db)):
    """Check if flyer_key column exists in events table."""
    try:
        result = await db.execute(
            text("""
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'events'
                ORDER BY ordinal_position
            """)
        )
        columns = result.fetchall()
        
        column_info = []
        flyer_key_found = False
        for col in columns:
            info = {
                "column_name": col[0],
                "data_type": col[1],
                "is_nullable": col[2],
            }
            column_info.append(info)
            if col[0] == "flyer_key":
                flyer_key_found = True
        
        return {
            "table": "events",
            "flyer_key_column_exists": flyer_key_found,
            "columns": column_info,
        }
    except Exception as e:
        logger.error(f"Check column error: {e}")
        return {"error": str(e)}