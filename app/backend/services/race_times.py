import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.race_times import Race_times

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Race_timesService:
    """Service layer for Race_times operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Race_times]:
        """Create a new race_times"""
        try:
            obj = Race_times(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created race_times with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating race_times: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Race_times]:
        """Get race_times by ID"""
        try:
            query = select(Race_times).where(Race_times.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching race_times {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of race_timess"""
        try:
            query = select(Race_times)
            count_query = select(func.count(Race_times.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Race_times, field):
                        query = query.where(getattr(Race_times, field) == value)
                        count_query = count_query.where(getattr(Race_times, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Race_times, field_name):
                        query = query.order_by(getattr(Race_times, field_name).desc())
                else:
                    if hasattr(Race_times, sort):
                        query = query.order_by(getattr(Race_times, sort))
            else:
                query = query.order_by(Race_times.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching race_times list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Race_times]:
        """Update race_times"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Race_times {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated race_times {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating race_times {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete race_times"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Race_times {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted race_times {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting race_times {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Race_times]:
        """Get race_times by any field"""
        try:
            if not hasattr(Race_times, field_name):
                raise ValueError(f"Field {field_name} does not exist on Race_times")
            result = await self.db.execute(
                select(Race_times).where(getattr(Race_times, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching race_times by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Race_times]:
        """Get list of race_timess filtered by field"""
        try:
            if not hasattr(Race_times, field_name):
                raise ValueError(f"Field {field_name} does not exist on Race_times")
            result = await self.db.execute(
                select(Race_times)
                .where(getattr(Race_times, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Race_times.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching race_timess by {field_name}: {str(e)}")
            raise