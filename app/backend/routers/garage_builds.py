import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.garage_builds import Garage_buildsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/garage_builds", tags=["garage_builds"])


# ---------- Pydantic Schemas ----------
class Garage_buildsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    car: str
    drivetrain: str = None
    class_name: str
    mods: str = None
    photo_url: str = None
    status: str = None
    created_at: Optional[datetime] = None


class Garage_buildsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    car: Optional[str] = None
    drivetrain: Optional[str] = None
    class_name: Optional[str] = None
    mods: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None


class Garage_buildsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    name: str
    car: str
    drivetrain: Optional[str] = None
    class_name: str
    mods: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Garage_buildsListResponse(BaseModel):
    """List response schema"""
    items: List[Garage_buildsResponse]
    total: int
    skip: int
    limit: int


class Garage_buildsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Garage_buildsData]


class Garage_buildsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Garage_buildsUpdateData


class Garage_buildsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Garage_buildsBatchUpdateItem]


class Garage_buildsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Garage_buildsListResponse)
async def query_garage_buildss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query garage_buildss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying garage_buildss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Garage_buildsService(db)
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
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} garage_buildss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying garage_buildss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Garage_buildsListResponse)
async def query_garage_buildss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query garage_buildss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying garage_buildss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Garage_buildsService(db)
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
        logger.debug(f"Found {result['total']} garage_buildss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying garage_buildss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Garage_buildsResponse)
async def get_garage_builds(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single garage_builds by ID (user can only see their own records)"""
    logger.debug(f"Fetching garage_builds with id: {id}, fields={fields}")
    
    service = Garage_buildsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Garage_builds with id {id} not found")
            raise HTTPException(status_code=404, detail="Garage_builds not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching garage_builds {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Garage_buildsResponse, status_code=201)
async def create_garage_builds(
    data: Garage_buildsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new garage_builds"""
    logger.debug(f"Creating new garage_builds with data: {data}")
    
    service = Garage_buildsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create garage_builds")
        
        logger.info(f"Garage_builds created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating garage_builds: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating garage_builds: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Garage_buildsResponse], status_code=201)
async def create_garage_buildss_batch(
    request: Garage_buildsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple garage_buildss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} garage_buildss")
    
    service = Garage_buildsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} garage_buildss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Garage_buildsResponse])
async def update_garage_buildss_batch(
    request: Garage_buildsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple garage_buildss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} garage_buildss")
    
    service = Garage_buildsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} garage_buildss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Garage_buildsResponse)
async def update_garage_builds(
    id: int,
    data: Garage_buildsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing garage_builds (requires ownership)"""
    logger.debug(f"Updating garage_builds {id} with data: {data}")

    service = Garage_buildsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Garage_builds with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Garage_builds not found")
        
        logger.info(f"Garage_builds {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating garage_builds {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating garage_builds {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_garage_buildss_batch(
    request: Garage_buildsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple garage_buildss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} garage_buildss")
    
    service = Garage_buildsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} garage_buildss successfully")
        return {"message": f"Successfully deleted {deleted_count} garage_buildss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_garage_builds(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single garage_builds by ID (requires ownership)"""
    logger.debug(f"Deleting garage_builds with id: {id}")
    
    service = Garage_buildsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Garage_builds with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Garage_builds not found")
        
        logger.info(f"Garage_builds {id} deleted successfully")
        return {"message": "Garage_builds deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting garage_builds {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")