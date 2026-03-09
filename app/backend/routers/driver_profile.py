import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from models.registrations import Registrations
from models.race_times import Race_times
from models.events import Events

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/driver", tags=["driver_profile"])


@router.get("/profile")
async def get_driver_profile(
    driver_name: str = Query(..., description="Driver name to look up"),
    db: AsyncSession = Depends(get_db),
):
    """Get a driver's profile with all registrations and race times - public endpoint"""
    try:
        # Get all registrations for this driver
        reg_query = select(Registrations).where(
            func.lower(Registrations.driver_name) == driver_name.lower()
        )
        reg_result = await db.execute(reg_query)
        registrations = reg_result.scalars().all()

        if not registrations:
            raise HTTPException(status_code=404, detail="Driver not found")

        # Get unique driver info from most recent registration
        sorted_regs = sorted(registrations, key=lambda r: r.id, reverse=True)
        latest_reg = sorted_regs[0]

        # Collect all registration IDs
        reg_ids = [r.id for r in registrations]
        event_ids = list(set(r.event_id for r in registrations))

        # Get all race times for these registrations
        times_query = select(Race_times).where(Race_times.registration_id.in_(reg_ids))
        times_result = await db.execute(times_query)
        race_times = times_result.scalars().all()

        # Get all related events
        events_query = select(Events).where(Events.id.in_(event_ids))
        events_result = await db.execute(events_query)
        events = {e.id: e for e in events_result.scalars().all()}

        # Build registration list with event info
        registration_list = []
        for reg in sorted_regs:
            evt = events.get(reg.event_id)
            registration_list.append({
                "id": reg.id,
                "event_id": reg.event_id,
                "event_title": evt.title if evt else "Unknown Event",
                "event_date": evt.date if evt else "N/A",
                "event_location": evt.location if evt else "N/A",
                "competition_number": reg.competition_number,
                "class_name": reg.class_name,
                "car": reg.car,
                "notes": reg.notes,
                "payment_status": reg.payment_status,
            })

        # Build race times list with event info
        race_times_list = []
        best_quarter_time = None
        best_quarter_speed = None
        best_eighth_time = None
        best_reaction_time = None
        best_sixty_foot = None

        for rt in race_times:
            # Find the registration for this race time
            reg = next((r for r in registrations if r.id == rt.registration_id), None)
            evt = events.get(rt.event_id) if rt.event_id else None

            race_times_list.append({
                "id": rt.id,
                "registration_id": rt.registration_id,
                "event_id": rt.event_id,
                "event_title": evt.title if evt else "Unknown Event",
                "event_date": evt.date if evt else "N/A",
                "round": rt.round,
                "sixty_foot": rt.sixty_foot,
                "three_thirty_foot": rt.three_thirty_foot,
                "eighth_mile_time": rt.eighth_mile_time,
                "eighth_mile_speed": rt.eighth_mile_speed,
                "quarter_mile_time": rt.quarter_mile_time,
                "quarter_mile_speed": rt.quarter_mile_speed,
                "reaction_time": rt.reaction_time,
                "notes": rt.notes,
                "recorded_at": rt.recorded_at.isoformat() if rt.recorded_at else None,
                "class_name": reg.class_name if reg else "N/A",
                "car": reg.car if reg else "N/A",
                "competition_number": reg.competition_number if reg else "N/A",
            })

            # Track best times
            if rt.quarter_mile_time and (best_quarter_time is None or rt.quarter_mile_time < best_quarter_time):
                best_quarter_time = rt.quarter_mile_time
            if rt.quarter_mile_speed and (best_quarter_speed is None or rt.quarter_mile_speed > best_quarter_speed):
                best_quarter_speed = rt.quarter_mile_speed
            if rt.eighth_mile_time and (best_eighth_time is None or rt.eighth_mile_time < best_eighth_time):
                best_eighth_time = rt.eighth_mile_time
            if rt.reaction_time and (best_reaction_time is None or rt.reaction_time < best_reaction_time):
                best_reaction_time = rt.reaction_time
            if rt.sixty_foot and (best_sixty_foot is None or rt.sixty_foot < best_sixty_foot):
                best_sixty_foot = rt.sixty_foot

        # Sort race times by event date descending, then by round
        race_times_list.sort(key=lambda x: (x["event_date"] or "", x["round"] or ""), reverse=True)

        return {
            "driver_name": latest_reg.driver_name,
            "competition_number": latest_reg.competition_number,
            "car": latest_reg.car,
            "class_name": latest_reg.class_name,
            "phone": latest_reg.phone,
            "total_events": len(event_ids),
            "total_runs": len(race_times_list),
            "best_quarter_time": best_quarter_time,
            "best_quarter_speed": best_quarter_speed,
            "best_eighth_time": best_eighth_time,
            "best_reaction_time": best_reaction_time,
            "best_sixty_foot": best_sixty_foot,
            "registrations": registration_list,
            "race_times": race_times_list,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching driver profile: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/search")
async def search_drivers(
    q: str = Query("", description="Search query for driver name"),
    db: AsyncSession = Depends(get_db),
):
    """Search for drivers by name - public endpoint"""
    try:
        query = select(
            Registrations.driver_name,
            Registrations.competition_number,
            Registrations.car,
            Registrations.class_name,
        ).distinct(Registrations.driver_name)

        if q:
            query = query.where(Registrations.driver_name.ilike(f"%{q}%"))

        query = query.order_by(Registrations.driver_name).limit(50)
        result = await db.execute(query)
        rows = result.all()

        # Deduplicate by driver name (keep first occurrence)
        seen = set()
        drivers = []
        for row in rows:
            name_lower = row.driver_name.lower()
            if name_lower not in seen:
                seen.add(name_lower)
                drivers.append({
                    "driver_name": row.driver_name,
                    "competition_number": row.competition_number,
                    "car": row.car,
                    "class_name": row.class_name,
                })

        return {"items": drivers, "total": len(drivers)}
    except Exception as e:
        logger.error(f"Error searching drivers: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")