"""
Local file-based flyer upload and serving.
Stores flyer images on the local server filesystem instead of requiring
an external Object Storage Service (OSS).
"""
import logging
import os
import re
import time
import mimetypes
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["flyers"])

# Directory where flyers will be stored (relative to backend root)
FLYER_DIR = Path(__file__).parent.parent / "static" / "flyers"

# Ensure the directory exists on module load
FLYER_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _sanitize_filename(name: str) -> str:
    """Sanitize a filename to only safe characters."""
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)


@router.post("/api/v1/flyers/upload")
async def upload_flyer(file: UploadFile = File(...)):
    """Upload a flyer image to local storage. Returns the public URL."""

    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Allowed: JPG, PNG, WebP, GIF, PDF.",
        )

    # Read file data and check size
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")

    # Build a unique, safe filename
    timestamp = int(time.time() * 1000)
    original_name = _sanitize_filename(file.filename or "upload")
    safe_name = f"{timestamp}-{original_name}"

    dest = FLYER_DIR / safe_name
    dest.write_bytes(data)

    logger.info(f"Flyer saved locally: {dest}  ({len(data)} bytes)")

    # Return the object key and the URL the frontend can use
    object_key = f"flyers/{safe_name}"
    public_url = f"/api/v1/flyers/file/{safe_name}"

    return {
        "object_key": object_key,
        "url": public_url,
        "filename": safe_name,
        "size": len(data),
    }


@router.get("/api/v1/flyers/file/{filename}")
async def serve_flyer(filename: str):
    """Serve a flyer image from local storage."""
    safe = _sanitize_filename(filename)
    path = FLYER_DIR / safe

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Flyer not found")

    content_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(
        path,
        media_type=content_type or "application/octet-stream",
        filename=safe,
    )
