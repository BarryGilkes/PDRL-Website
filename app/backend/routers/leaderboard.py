import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.race_times import Race_times
from models.registrations import Registrations
from models.events import Events

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


class LeaderboardEntry(BaseModel):
    driver_name: str
    competition_number: Optional[str] = None
    car: Optional[str] = None
    class_name: Optional[str] = None
    best_time: Optional[float] = None
    best_speed: Optional[float] = None
    event_title: Optional[str] = None
    event_date: Optional[str] = None

    class Config:
        from_attributes = True


class LeaderboardResponse(BaseModel):
    items: List[LeaderboardEntry]
    total: int
    distance: str


@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    year: Optional[str] = Query(None, description="Filter by year (e.g. 2025)"),
    distance: str = Query("quarter", description="Distance: 'quarter' for 1/4 mile, 'eighth' for 1/8 mile"),
    db: AsyncSession = Depends(get_db),
):
    """Get leaderboard data - NO authentication required.

    Returns drivers sorted by their best (lowest) time for the selected distance.
    Joins race_times with registrations and events to provide full context.
    """
    try:
        # Determine which columns to use based on distance
        if distance == "eighth":
            time_col = Race_times.eighth_mile_time
            speed_col = Race_times.eighth_mile_speed
        else:
            time_col = Race_times.quarter_mile_time
            speed_col = Race_times.quarter_mile_speed
            distance = "quarter"  # normalize

        # Step 1: Get all race times with valid time for selected distance
        race_times_query = select(Race_times).where(
            and_(
                time_col.isnot(None),
                time_col > 0,
            )
        )
        race_times_result = await db.execute(race_times_query)
        all_race_times = race_times_result.scalars().all()

        if not all_race_times:
            return LeaderboardResponse(items=[], total=0, distance=distance)

        # Step 2: Load all registrations and events into lookup dicts
        regs_result = await db.execute(select(Registrations))
        all_regs = regs_result.scalars().all()
        regs_by_id = {r.id: r for r in all_regs}

        events_result = await db.execute(select(Events))
        all_events = events_result.scalars().all()
        events_by_id = {e.id: e for e in all_events}

        # Step 3: Group race times by driver and find best time
        driver_best: dict = {}

        for rt in all_race_times:
            # Get the time/speed values for the selected distance
            if distance == "eighth":
                rt_time = rt.eighth_mile_time
                rt_speed = rt.eighth_mile_speed
            else:
                rt_time = rt.quarter_mile_time
                rt_speed = rt.quarter_mile_speed

            if rt_time is None or rt_time <= 0:
                continue

            # Get event for year filtering
            event = events_by_id.get(rt.event_id) if rt.event_id else None
            event_date_str = event.date if event else None

            # Apply year filter if specified
            if year and event_date_str and not event_date_str.startswith(year):
                continue

            # Determine driver name
            driver_name = rt.driver_name
            if not driver_name and rt.registration_id:
                reg = regs_by_id.get(rt.registration_id)
                if reg:
                    driver_name = reg.driver_name

            if not driver_name:
                driver_name = f"Driver #{rt.competition_number}" if rt.competition_number else None

            if not driver_name:
                continue

            # Normalize driver name for grouping (case-insensitive)
            driver_key = driver_name.strip().lower()

            current_best = driver_best.get(driver_key)
            if current_best is None or rt_time < current_best["best_time"]:
                driver_best[driver_key] = {
                    "best_time": rt_time,
                    "best_speed": rt_speed,
                    "race_time": rt,
                    "driver_name": driver_name.strip(),
                }

        # Step 4: Build leaderboard entries with joined data
        entries: List[LeaderboardEntry] = []

        for driver_key, data in driver_best.items():
            rt = data["race_time"]
            driver_name = data["driver_name"]

            # Get registration info for car and class
            reg = regs_by_id.get(rt.registration_id) if rt.registration_id else None
            car = reg.car if reg else None
            class_name = reg.class_name if reg else None
            comp_number = str(rt.competition_number) if rt.competition_number else (
                str(reg.competition_number) if reg and reg.competition_number else None
            )

            # Get event info
            event = events_by_id.get(rt.event_id) if rt.event_id else None
            event_title = event.title if event else None
            event_date = event.date if event else None

            entries.append(
                LeaderboardEntry(
                    driver_name=driver_name,
                    competition_number=comp_number,
                    car=car,
                    class_name=class_name,
                    best_time=data["best_time"],
                    best_speed=data["best_speed"],
                    event_title=event_title,
                    event_date=event_date,
                )
            )

        # Step 5: Sort by best time ascending (fastest first)
        entries.sort(key=lambda e: e.best_time if e.best_time is not None else float("inf"))

        return LeaderboardResponse(items=entries, total=len(entries), distance=distance)

    except Exception as e:
        logger.error(f"Error fetching leaderboard: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch leaderboard: {str(e)}")