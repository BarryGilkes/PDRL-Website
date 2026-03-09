import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/migration", tags=["migration"])

# Pre-defined, static SQL statements for each column migration.
# No dynamic string building — every statement is a complete string literal,
# eliminating any possibility of SQL injection.
_MIGRATION_STATEMENTS: dict[str, str] = {
    "race_date_time": "ALTER TABLE race_times ADD COLUMN race_date_time TIMESTAMP WITH TIME ZONE",
    "lane": "ALTER TABLE race_times ADD COLUMN lane VARCHAR",
    "redlight": "ALTER TABLE race_times ADD COLUMN redlight BOOLEAN",
    "dial_in": "ALTER TABLE race_times ADD COLUMN dial_in FLOAT",
    "driver_name": "ALTER TABLE race_times ADD COLUMN driver_name VARCHAR",
    "breakout": "ALTER TABLE race_times ADD COLUMN breakout BOOLEAN",
    "win": "ALTER TABLE race_times ADD COLUMN win BOOLEAN",
    "competition_number": "ALTER TABLE race_times ADD COLUMN competition_number INTEGER",
}

# Ordered list of columns to add (preserves migration order)
_COLUMNS_TO_ADD: list[str] = [
    "race_date_time",
    "lane",
    "redlight",
    "dial_in",
    "driver_name",
    "breakout",
    "win",
    "competition_number",
]


@router.post("/add-race-times-fields")
async def add_race_times_fields(db: AsyncSession = Depends(get_db)):
    """Add new fields to race_times table: race_date_time, lane, redlight, dial_in, driver_name, breakout, win"""
    try:
        added = []
        skipped = []

        for col_name in _COLUMNS_TO_ADD:
            try:
                # Look up the pre-defined static SQL statement — no string building
                static_sql = _MIGRATION_STATEMENTS[col_name]
                await db.execute(text(static_sql))
                added.append(col_name)
            except KeyError:
                logger.error(f"No migration statement defined for column: {col_name}")
                raise HTTPException(
                    status_code=400,
                    detail=f"No migration statement defined for column: {col_name}",
                )
            except Exception as col_err:
                err_str = str(col_err)
                if "already exists" in err_str.lower() or "duplicate column" in err_str.lower():
                    skipped.append(col_name)
                    # Need to rollback the failed statement in async session
                    await db.rollback()
                else:
                    raise col_err

        await db.commit()

        return {
            "message": "Migration completed successfully",
            "columns_added": added,
            "columns_skipped": skipped,
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Migration error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")