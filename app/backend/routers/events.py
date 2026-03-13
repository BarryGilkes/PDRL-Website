import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.events import EventsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/events", tags=["events"])


# ---------- Pydantic Schemas ----------
class EventsData(BaseModel):
    """Entity data schema (for create/update)"""
    title: str
    date: str
    location: str
    start_time: str
    end_time: str
    buyin: str = None
    payout: str = None
    format: str = None
    price: str = None
    payment_method: str = None
    status: str
    notes: str = None
    flyer_key: str = None
    flyer_url: str = None
    asr_key: str = None
    asr_url: str = None
    created_at: Optional[datetime] = None


class EventsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    title: Optional[str] = None
    date: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    buyin: Optional[str] = None
    payout: Optional[str] = None
    format: Optional[str] = None
    price: Optional[str] = None
    payment_method: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    flyer_key: Optional[str] = None
    flyer_url: Optional[str] = None
    asr_key: Optional[str] = None
    asr_url: Optional[str] = None
    created_at: Optional[datetime] = None


class EventsResponse(BaseModel):
    """Entity response schema"""
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
    asr_key: Optional[str] = None
    asr_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EventsListResponse(BaseModel):
    """List response schema"""
    items: List[EventsResponse]
    total: int
    skip: int
    limit: int


class EventsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[EventsData]


class EventsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: EventsUpdateData


class EventsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[EventsBatchUpdateItem]


class EventsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=EventsListResponse)
async def query_eventss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query eventss with filtering, sorting, and pagination"""
    logger.debug(f"Querying eventss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = EventsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} eventss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying eventss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=EventsListResponse)
async def query_eventss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query eventss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying eventss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = EventsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} eventss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying eventss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=EventsResponse)
async def get_events(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single events by ID"""
    logger.debug(f"Fetching events with id: {id}, fields={fields}")
    
    service = EventsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Events with id {id} not found")
            raise HTTPException(status_code=404, detail="Events not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching events {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=EventsResponse, status_code=201)
async def create_events(
    data: EventsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new events"""
    logger.info(f"Creating new event - flyer_key: {data.flyer_key}")
    logger.info(f"Full event data: {data.model_dump()}")
    
    service = EventsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create events")
        
        logger.info(f"Events created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating events: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating events: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[EventsResponse], status_code=201)
async def create_eventss_batch(
    request: EventsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple eventss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} eventss")
    
    service = EventsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} eventss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[EventsResponse])
async def update_eventss_batch(
    request: EventsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple eventss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} eventss")
    
    service = EventsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} eventss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=EventsResponse)
async def update_events(
    id: int,
    data: EventsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing events"""
    logger.info(f"Updating event {id} - flyer_key in payload: {data.flyer_key}")
    logger.info(f"Full update data: {data.model_dump()}")

    service = EventsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        logger.info(f"Filtered update_dict (non-None): {update_dict}")
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Events with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Events not found")
        
        logger.info(f"Events {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating events {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating events {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_eventss_batch(
    request: EventsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple eventss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} eventss")
    
    service = EventsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} eventss successfully")
        return {"message": f"Successfully deleted {deleted_count} eventss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_events(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single events by ID"""
    logger.debug(f"Deleting events with id: {id}")
    
    service = EventsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Events with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Events not found")
        
        logger.info(f"Events {id} deleted successfully")
        return {"message": "Events deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting events {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")