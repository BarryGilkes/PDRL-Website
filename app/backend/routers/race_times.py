import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.race_times import Race_timesService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/race_times", tags=["race_times"])


# ---------- Pydantic Schemas ----------
class Race_timesData(BaseModel):
    """Entity data schema (for create/update)"""
    registration_id: int
    event_id: int
    round: str = None
    sixty_foot: float = None
    three_thirty_foot: float = None
    eighth_mile_time: float = None
    eighth_mile_speed: float = None
    quarter_mile_time: float = None
    quarter_mile_speed: float = None
    reaction_time: float = None
    notes: str = None
    recorded_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    race_date_time: Optional[datetime] = None
    lane: Optional[str] = None
    redlight: Optional[bool] = None
    dial_in: Optional[float] = None
    driver_name: Optional[str] = None
    breakout: Optional[bool] = None
    win: Optional[bool] = None
    competition_number: Optional[int] = None


class Race_timesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    registration_id: Optional[int] = None
    event_id: Optional[int] = None
    round: Optional[str] = None
    sixty_foot: Optional[float] = None
    three_thirty_foot: Optional[float] = None
    eighth_mile_time: Optional[float] = None
    eighth_mile_speed: Optional[float] = None
    quarter_mile_time: Optional[float] = None
    quarter_mile_speed: Optional[float] = None
    reaction_time: Optional[float] = None
    notes: Optional[str] = None
    recorded_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    race_date_time: Optional[datetime] = None
    lane: Optional[str] = None
    redlight: Optional[bool] = None
    dial_in: Optional[float] = None
    driver_name: Optional[str] = None
    breakout: Optional[bool] = None
    win: Optional[bool] = None
    competition_number: Optional[int] = None


class Race_timesResponse(BaseModel):
    """Entity response schema"""
    id: int
    registration_id: int
    event_id: int
    round: Optional[str] = None
    sixty_foot: Optional[float] = None
    three_thirty_foot: Optional[float] = None
    eighth_mile_time: Optional[float] = None
    eighth_mile_speed: Optional[float] = None
    quarter_mile_time: Optional[float] = None
    quarter_mile_speed: Optional[float] = None
    reaction_time: Optional[float] = None
    notes: Optional[str] = None
    recorded_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    race_date_time: Optional[datetime] = None
    lane: Optional[str] = None
    redlight: Optional[bool] = None
    dial_in: Optional[float] = None
    driver_name: Optional[str] = None
    breakout: Optional[bool] = None
    win: Optional[bool] = None
    competition_number: Optional[int] = None

    class Config:
        from_attributes = True


class Race_timesListResponse(BaseModel):
    """List response schema"""
    items: List[Race_timesResponse]
    total: int
    skip: int
    limit: int


class Race_timesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Race_timesData]


class Race_timesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Race_timesUpdateData


class Race_timesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Race_timesBatchUpdateItem]


class Race_timesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Race_timesListResponse)
async def query_race_timess(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query race_timess with filtering, sorting, and pagination"""
    logger.debug(f"Querying race_timess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Race_timesService(db)
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
        logger.debug(f"Found {result['total']} race_timess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying race_timess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Race_timesListResponse)
async def query_race_timess_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query race_timess with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying race_timess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Race_timesService(db)
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
        logger.debug(f"Found {result['total']} race_timess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying race_timess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Race_timesResponse)
async def get_race_times(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single race_times by ID"""
    logger.debug(f"Fetching race_times with id: {id}, fields={fields}")
    
    service = Race_timesService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Race_times with id {id} not found")
            raise HTTPException(status_code=404, detail="Race_times not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching race_times {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Race_timesResponse, status_code=201)
async def create_race_times(
    data: Race_timesData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new race_times"""
    logger.debug(f"Creating new race_times with data: {data}")
    
    service = Race_timesService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create race_times")
        
        logger.info(f"Race_times created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating race_times: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating race_times: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Race_timesResponse], status_code=201)
async def create_race_timess_batch(
    request: Race_timesBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple race_timess in a single request"""
    logger.debug(f"Batch creating {len(request.items)} race_timess")
    
    service = Race_timesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} race_timess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Race_timesResponse])
async def update_race_timess_batch(
    request: Race_timesBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple race_timess in a single request"""
    logger.debug(f"Batch updating {len(request.items)} race_timess")
    
    service = Race_timesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} race_timess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Race_timesResponse)
async def update_race_times(
    id: int,
    data: Race_timesUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing race_times"""
    logger.debug(f"Updating race_times {id} with data: {data}")

    service = Race_timesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Race_times with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Race_times not found")
        
        logger.info(f"Race_times {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating race_times {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating race_times {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_race_timess_batch(
    request: Race_timesBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple race_timess by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} race_timess")
    
    service = Race_timesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} race_timess successfully")
        return {"message": f"Successfully deleted {deleted_count} race_timess", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_race_times(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single race_times by ID"""
    logger.debug(f"Deleting race_times with id: {id}")
    
    service = Race_timesService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Race_times with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Race_times not found")
        
        logger.info(f"Race_times {id} deleted successfully")
        return {"message": "Race_times deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting race_times {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")