import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.event_classes import Event_classes

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Event_classesService:
    """Service layer for Event_classes operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Event_classes]:
        """Create a new event_classes"""
        try:
            obj = Event_classes(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created event_classes with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating event_classes: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Event_classes]:
        """Get event_classes by ID"""
        try:
            query = select(Event_classes).where(Event_classes.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching event_classes {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of event_classess"""
        try:
            query = select(Event_classes)
            count_query = select(func.count(Event_classes.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Event_classes, field):
                        query = query.where(getattr(Event_classes, field) == value)
                        count_query = count_query.where(getattr(Event_classes, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Event_classes, field_name):
                        query = query.order_by(getattr(Event_classes, field_name).desc())
                else:
                    if hasattr(Event_classes, sort):
                        query = query.order_by(getattr(Event_classes, sort))
            else:
                query = query.order_by(Event_classes.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching event_classes list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Event_classes]:
        """Update event_classes"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Event_classes {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated event_classes {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating event_classes {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete event_classes"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Event_classes {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted event_classes {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting event_classes {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Event_classes]:
        """Get event_classes by any field"""
        try:
            if not hasattr(Event_classes, field_name):
                raise ValueError(f"Field {field_name} does not exist on Event_classes")
            result = await self.db.execute(
                select(Event_classes).where(getattr(Event_classes, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching event_classes by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Event_classes]:
        """Get list of event_classess filtered by field"""
        try:
            if not hasattr(Event_classes, field_name):
                raise ValueError(f"Field {field_name} does not exist on Event_classes")
            result = await self.db.execute(
                select(Event_classes)
                .where(getattr(Event_classes, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Event_classes.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching event_classess by {field_name}: {str(e)}")
            raise