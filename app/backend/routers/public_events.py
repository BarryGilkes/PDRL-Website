import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from core.database import get_db
from services.events import EventsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public", tags=["public"])


class PublicEventResponse(BaseModel):
    """Public event response schema"""
    id: int
    title: str
    date: str
    location: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    buyin: Optional[str] = None
    payout: Optional[str] = None
    format: Optional[str] = None
    price: Optional[str] = None
    payment_method: Optional[str] = None
    status: str
    notes: Optional[str] = None
    flyer_key: Optional[str] = None
    flyer_url: Optional[str] = None

    class Config:
        from_attributes = True


class PublicEventsListResponse(BaseModel):
    """Public events list response"""
    items: List[PublicEventResponse]
    total: int


def resolve_flyer_url(flyer_key: Optional[str], flyer_url: Optional[str]) -> Optional[str]:
    """Resolve the flyer URL for an event.
    
    Priority:
    1. If flyer_url is already a local path (starts with /api/v1/flyers/), use it
    2. If flyer_key looks like a local key (flyers/...), derive the URL
    3. If flyer_url is any other URL, use it as-is
    4. Otherwise return None
    """
    if flyer_url and flyer_url.startswith("/api/v1/flyers/"):
        return flyer_url
    if flyer_key:
        filename = flyer_key.replace("flyers/", "", 1) if flyer_key.startswith("flyers/") else flyer_key
        return f"/api/v1/flyers/file/{filename}"
    if flyer_url:
        return flyer_url
    return None


@router.get("/events", response_model=PublicEventsListResponse)
async def get_public_events(
    status: Optional[str] = Query(None, description="Filter by status (upcoming, completed, cancelled)"),
    sort: str = Query("-date", description="Sort field (prefix with '-' for descending)"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get public events list - NO authentication required."""
    try:
        service = EventsService(db)
        
        query_dict = None
        if status:
            query_dict = {"status": status}
        
        result = await service.get_list(
            skip=0,
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        
        items = []
        for event in result["items"]:
            if hasattr(event, '__dict__'):
                event_dict = {
                    "id": event.id,
                    "title": event.title,
                    "date": event.date,
                    "location": event.location,
                    "start_time": getattr(event, 'start_time', None),
                    "end_time": getattr(event, 'end_time', None),
                    "buyin": getattr(event, 'buyin', None),
                    "payout": getattr(event, 'payout', None),
                    "format": getattr(event, 'format', None),
                    "price": getattr(event, 'price', None),
                    "payment_method": getattr(event, 'payment_method', None),
                    "status": event.status,
                    "notes": getattr(event, 'notes', None),
                    "flyer_key": getattr(event, 'flyer_key', None),
                    "flyer_url": getattr(event, 'flyer_url', None),
                }
            else:
                event_dict = dict(event)

            # Resolve flyer URL using local storage
            event_dict["flyer_url"] = resolve_flyer_url(
                event_dict.get("flyer_key"),
                event_dict.get("flyer_url"),
            )

            items.append(PublicEventResponse(**event_dict))
        
        return PublicEventsListResponse(
            items=items,
            total=result["total"],
        )
    except Exception as e:
        logger.error(f"Error fetching public events: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")
