import logging
import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.race_times import Race_times

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/race-data-import", tags=["race_data_import"])


class DatFileRow(BaseModel):
    """A single parsed row from a .dat file"""
    race_date_time: Optional[str] = None
    class_name: Optional[str] = None
    lane: Optional[str] = None
    driver_name: Optional[str] = None
    competition_number: Optional[int] = None
    quarter_mile_time: Optional[float] = None
    quarter_mile_speed: Optional[float] = None
    reaction_time: Optional[float] = None
    redlight: Optional[bool] = None
    dial_in: Optional[float] = None
    breakout: Optional[bool] = None
    sixty_foot: Optional[float] = None
    three_thirty_foot: Optional[float] = None
    eighth_mile_time: Optional[float] = None
    win: Optional[bool] = None
    notes: Optional[str] = None


class ImportRequest(BaseModel):
    """Request to import parsed .dat file data"""
    event_id: int
    race_type: str  # Grudge, Practice, Qualifying, Elimination
    rows: List[DatFileRow]


class ImportResponse(BaseModel):
    """Response from import operation"""
    message: str
    imported_count: int
    skipped_count: int
    duplicate_count: int
    errors: List[str]
    debug_info: Optional[dict] = None


def parse_float_safe(value: str) -> Optional[float]:
    """Safely parse a float value, returning None for empty/invalid values."""
    if not value or value.strip() == '' or value.strip() == '-' or value.strip() == '.':
        return None
    try:
        val = float(value.strip())
        # Treat 0.0 or 0.000 as None (no data recorded)
        if val == 0.0:
            return None
        return val
    except (ValueError, TypeError):
        return None


def parse_bool_field(value: str) -> Optional[bool]:
    """Parse a boolean-like field from .dat file.
    Common values: empty, 0, 1, or text like 'Yes'/'No'."""
    if not value or value.strip() == '' or value.strip() == '-':
        return None
    v = value.strip().lower()
    if v in ('1', 'yes', 'true', 'y', '*'):
        return True
    if v in ('0', 'no', 'false', 'n'):
        return False
    return None


def parse_win_field(value: str) -> Optional[bool]:
    """Parse the WIN field."""
    if not value or value.strip() == '' or value.strip() == '-':
        return None
    v = value.strip().lower()
    if v in ('1', 'yes', 'true', 'win', 'w'):
        return True
    if v in ('0', 'no', 'false', 'loss', 'l'):
        return False
    return None


def parse_driver_field(raw_value: str) -> tuple:
    """Extract competition number and driver name from the raw driver field.
    
    The driver field may contain a competition number prefix (any length of leading digits)
    followed by a name. Also removes commas from the driver name.
    
    Examples:
        "001John Smith"    -> (1, "John Smith")
        "45Jane Doe"       -> (45, "Jane Doe")
        "123Smith, John"   -> (123, "Smith John")
        "D1, D1"           -> (None, "D1 D1")
        "   Some Name"     -> (None, "Some Name")
        "1234"             -> (1234, "")
        "Doe, Jane"        -> (None, "Doe Jane")
    
    Returns:
        tuple: (competition_number: int or None, driver_name: str)
    """
    if not raw_value or len(raw_value.strip()) == 0:
        return (None, "")
    
    raw = raw_value.strip()
    
    # Use regex to extract leading digits as competition number
    match = re.match(r'^(\d+)\s*(.*)', raw)
    
    competition_number = None
    name_part = raw
    
    if match:
        num_str = match.group(1)
        name_part = match.group(2).strip()
        try:
            competition_number = int(num_str)
            # If it parsed as 0, treat as None (no valid comp number)
            if competition_number == 0:
                competition_number = None
        except ValueError:
            competition_number = None
            name_part = raw
    
    # Remove commas from the driver name
    name_part = name_part.replace(',', '').strip()
    
    # Collapse multiple spaces into one
    name_part = re.sub(r'\s+', ' ', name_part).strip()
    
    return (competition_number, name_part)


def parse_datetime_safe(value: str) -> Optional[datetime]:
    """Parse datetime from various formats."""
    if not value or value.strip() == '':
        return None
    # Normalize multiple spaces to single space
    v = re.sub(r'\s+', ' ', value.strip())
    # Try common formats (including 2-digit year)
    formats = [
        '%m/%d/%y %I:%M:%S %p',   # 02/18/26 05:38:25 AM (2-digit year)
        '%m/%d/%Y %I:%M:%S %p',   # 02/18/2026 02:30:00 PM
        '%m/%d/%y %H:%M:%S',      # 02/18/26 14:30:00 (2-digit year)
        '%m/%d/%Y %H:%M:%S',      # 02/18/2026 14:30:00
        '%Y-%m-%d %H:%M:%S',      # 2026-02-18 14:30:00
        '%m/%d/%y %I:%M %p',      # 02/18/26 02:30 PM (2-digit year)
        '%m/%d/%Y %I:%M %p',      # 02/18/2026 02:30 PM
        '%m/%d/%y',                # 02/18/26 (2-digit year)
        '%m/%d/%Y',                # 02/18/2026
        '%Y-%m-%d',                # 2026-02-18
        '%d/%m/%Y %H:%M:%S',      # 18/02/2026 14:30:00
        '%d/%m/%Y %I:%M:%S %p',   # 18/02/2026 02:30:00 PM
    ]
    for fmt in formats:
        try:
            return datetime.strptime(v, fmt)
        except ValueError:
            continue
    logger.warning(f"Could not parse datetime: {v}")
    return None


@router.post("/parse-dat", response_model=dict)
async def parse_dat_content(
    data: dict,
):
    """Parse .dat file content and return structured rows for preview.
    Expects: { "content": "...", "race_type": "..." }
    """
    content = data.get("content", "")
    race_type = data.get("race_type", "Unknown")

    if not content.strip():
        raise HTTPException(status_code=400, detail="Empty file content")

    # Handle both \r\n and \n line endings
    lines = content.replace('\r\n', '\n').replace('\r', '\n').strip().split('\n')
    parsed_rows = []
    errors = []
    debug_lines = []

    for line_num, line in enumerate(lines, 1):
        raw_line = line
        line = line.strip()
        if not line:
            debug_lines.append(f"Line {line_num}: EMPTY, skipping")
            continue

        # Split by tab
        cols = line.split('\t')
        num_cols = len(cols)

        debug_lines.append(f"Line {line_num}: {num_cols} cols, first_col='{cols[0][:30] if cols[0] else ''}'")

        # Need at least 7 columns for basic data
        if num_cols < 7:
            errors.append(f"Line {line_num}: Too few columns ({num_cols}), skipping. Content: {line[:100]}")
            continue

        try:
            # Parse driver field: first 3 chars = competition number, rest = name
            comp_number, driver_name = parse_driver_field(cols[3]) if num_cols > 3 else (None, '')

            # Find the WIN column dynamically by scanning from the end
            win_value = None
            notes_value = None

            for i in range(num_cols - 1, 12, -1):
                col_val = cols[i].strip().upper()
                if col_val == 'WIN' or col_val == 'LOSS':
                    win_value = parse_win_field(cols[i])
                    # Notes/win-margin is the column after WIN
                    if i + 1 < num_cols and cols[i + 1].strip() and cols[i + 1].strip() != '.':
                        notes_value = cols[i + 1].strip()
                    break

            row = {
                "race_date_time": cols[0].strip() if cols[0].strip() else None,
                "class_name": cols[1].strip() if num_cols > 1 and cols[1].strip() else None,
                "lane": cols[2].strip() if num_cols > 2 and cols[2].strip() else None,
                "driver_name": driver_name if driver_name else None,
                "competition_number": comp_number,
                "quarter_mile_time": parse_float_safe(cols[4]) if num_cols > 4 else None,
                "quarter_mile_speed": parse_float_safe(cols[5]) if num_cols > 5 else None,
                "reaction_time": parse_float_safe(cols[6]) if num_cols > 6 else None,
                "redlight": parse_bool_field(cols[7]) if num_cols > 7 else None,
                "dial_in": parse_float_safe(cols[8]) if num_cols > 8 else None,
                "breakout": parse_bool_field(cols[9]) if num_cols > 9 else None,
                "sixty_foot": parse_float_safe(cols[10]) if num_cols > 10 else None,
                "three_thirty_foot": parse_float_safe(cols[11]) if num_cols > 11 else None,
                "eighth_mile_time": parse_float_safe(cols[12]) if num_cols > 12 else None,
                "win": win_value,
                "notes": notes_value,
            }
            parsed_rows.append(row)
        except Exception as e:
            logger.error(f"Line {line_num}: Parse error - {str(e)}")
            errors.append(f"Line {line_num}: Parse error - {str(e)}")

    return {
        "rows": parsed_rows,
        "total_lines": len(lines),
        "parsed_count": len(parsed_rows),
        "errors": errors,
        "race_type": race_type,
        "debug_lines": debug_lines,
    }


@router.post("/import", response_model=ImportResponse)
async def import_race_data(
    request: ImportRequest,
    db: AsyncSession = Depends(get_db),
):
    """Import parsed race data rows into the race_times table.
    Includes duplicate detection to prevent re-importing the same data.
    """
    from models.registrations import Registrations

    imported_count = 0
    skipped_count = 0
    duplicate_count = 0
    errors = []
    debug_info = {
        "total_rows_received": len(request.rows),
        "event_id": request.event_id,
        "race_type": request.race_type,
        "row_details": [],
    }

    logger.info(f"Import request: {len(request.rows)} rows for event {request.event_id}, type={request.race_type}")

    # Pre-load registrations for this event to match by competition_number
    reg_by_comp = {}
    try:
        stmt = select(Registrations).where(Registrations.event_id == request.event_id)
        result = await db.execute(stmt)
        regs = result.scalars().all()
        for reg in regs:
            if reg.competition_number is not None:
                reg_by_comp[int(reg.competition_number)] = reg
        debug_info["registrations_loaded"] = len(reg_by_comp)
    except Exception as e:
        logger.warning(f"Could not load registrations for matching: {e}")
        debug_info["registrations_error"] = str(e)

    # Pre-load existing race times for this event to detect duplicates
    existing_times = []
    try:
        existing_stmt = select(Race_times).where(Race_times.event_id == request.event_id)
        existing_result = await db.execute(existing_stmt)
        existing_times = existing_result.scalars().all()
        debug_info["existing_race_times"] = len(existing_times)
    except Exception as e:
        logger.warning(f"Could not load existing race times: {e}")
        debug_info["existing_times_error"] = str(e)

    # Build a set of fingerprints for existing records to detect duplicates
    # Fingerprint = (event_id, driver_name, lane, quarter_mile_time, reaction_time, round)
    existing_fingerprints = set()
    for et in existing_times:
        fp = (
            et.event_id,
            (et.driver_name or '').strip().lower(),
            (et.lane or '').strip().lower(),
            round(et.quarter_mile_time, 3) if et.quarter_mile_time else None,
            round(et.reaction_time, 3) if et.reaction_time else None,
            (et.round or '').strip().lower(),
        )
        existing_fingerprints.add(fp)

    debug_info["existing_fingerprints_count"] = len(existing_fingerprints)

    # Collect all new records to insert in a single batch
    records_to_insert = []

    for idx, row in enumerate(request.rows):
        row_debug = {
            "index": idx + 1,
            "driver_name": row.driver_name,
            "quarter_mile_time": row.quarter_mile_time,
            "reaction_time": row.reaction_time,
            "lane": row.lane,
        }
        try:
            # Parse the datetime
            race_dt = parse_datetime_safe(row.race_date_time) if row.race_date_time else None

            # Try to match registration by competition number
            registration_id = 0
            if row.competition_number and row.competition_number in reg_by_comp:
                registration_id = reg_by_comp[row.competition_number].id

            # Check for duplicates using fingerprint
            fp = (
                request.event_id,
                (row.driver_name or '').strip().lower(),
                (row.lane or '').strip().lower(),
                round(row.quarter_mile_time, 3) if row.quarter_mile_time else None,
                round(row.reaction_time, 3) if row.reaction_time else None,
                request.race_type.strip().lower(),
            )

            row_debug["fingerprint"] = str(fp)

            if fp in existing_fingerprints:
                duplicate_count += 1
                row_debug["status"] = "duplicate"
                logger.info(f"Row {idx + 1}: Duplicate detected for {row.driver_name}, fp={fp}")
            else:
                # Also check against records we're about to insert in this batch
                existing_fingerprints.add(fp)

                # Build the race_times record
                record = Race_times(
                    event_id=request.event_id,
                    registration_id=registration_id,
                    round=request.race_type,
                    race_date_time=race_dt,
                    lane=row.lane,
                    driver_name=row.driver_name,
                    competition_number=row.competition_number,
                    quarter_mile_time=row.quarter_mile_time,
                    quarter_mile_speed=row.quarter_mile_speed,
                    reaction_time=row.reaction_time,
                    redlight=row.redlight,
                    dial_in=row.dial_in,
                    breakout=row.breakout,
                    sixty_foot=row.sixty_foot,
                    three_thirty_foot=row.three_thirty_foot,
                    eighth_mile_time=row.eighth_mile_time,
                    win=row.win,
                    notes=row.notes or (f"Class: {row.class_name}" if row.class_name else None),
                    recorded_at=datetime.now(),
                    created_at=datetime.now(),
                )
                records_to_insert.append(record)
                row_debug["status"] = "prepared"
                logger.info(f"Row {idx + 1}: Prepared for import - {row.driver_name}")

        except Exception as e:
            skipped_count += 1
            row_debug["status"] = f"error: {str(e)}"
            errors.append(f"Row {idx + 1} ({row.driver_name}): {str(e)}")
            logger.error(f"Row {idx + 1}: Error preparing record - {str(e)}")

        debug_info["row_details"].append(row_debug)

    debug_info["records_to_insert"] = len(records_to_insert)

    # Batch insert all records in a single transaction
    if records_to_insert:
        try:
            db.add_all(records_to_insert)
            await db.commit()
            imported_count = len(records_to_insert)
            debug_info["batch_insert"] = "success"
            logger.info(f"Successfully imported {imported_count} records in batch")
        except Exception as e:
            await db.rollback()
            debug_info["batch_insert"] = f"failed: {str(e)}"
            logger.error(f"Batch import failed: {str(e)}")
            # Fall back to individual inserts
            logger.info("Falling back to individual inserts...")
            imported_count = 0
            for record in records_to_insert:
                try:
                    # Create a fresh object to avoid detached instance issues
                    new_record = Race_times(
                        event_id=record.event_id,
                        registration_id=record.registration_id,
                        round=record.round,
                        race_date_time=record.race_date_time,
                        lane=record.lane,
                        driver_name=record.driver_name,
                        competition_number=record.competition_number,
                        quarter_mile_time=record.quarter_mile_time,
                        quarter_mile_speed=record.quarter_mile_speed,
                        reaction_time=record.reaction_time,
                        redlight=record.redlight,
                        dial_in=record.dial_in,
                        breakout=record.breakout,
                        sixty_foot=record.sixty_foot,
                        three_thirty_foot=record.three_thirty_foot,
                        eighth_mile_time=record.eighth_mile_time,
                        win=record.win,
                        notes=record.notes,
                        recorded_at=datetime.now(),
                        created_at=datetime.now(),
                    )
                    db.add(new_record)
                    await db.commit()
                    imported_count += 1
                except Exception as inner_e:
                    await db.rollback()
                    skipped_count += 1
                    driver = getattr(record, 'driver_name', 'Unknown')
                    errors.append(f"Failed to import record for {driver}: {str(inner_e)}")
                    logger.error(f"Individual insert failed for {driver}: {str(inner_e)}")

    msg_parts = [f"{imported_count} records imported"]
    if duplicate_count > 0:
        msg_parts.append(f"{duplicate_count} duplicates skipped")
    if skipped_count > 0:
        msg_parts.append(f"{skipped_count} errors")

    return ImportResponse(
        message=f"Import complete: {', '.join(msg_parts)}",
        imported_count=imported_count,
        skipped_count=skipped_count,
        duplicate_count=duplicate_count,
        errors=errors[:20],
        debug_info=debug_info,
    )