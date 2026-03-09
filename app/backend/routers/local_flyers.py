"""
Local file-based flyer upload and serving.
Stores flyer images on the local server filesystem instead of requiring
an external Object Storage Service (OSS).

All uploaded images (JPEG, PNG, GIF) are automatically converted to WebP
for faster page loads. PDFs are stored as-is.
"""
import io
import logging
import mimetypes
import os
import re
import time
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
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
# Image types that should be converted to WebP
CONVERTIBLE_TYPES = {"image/jpeg", "image/png", "image/gif"}
WEBP_QUALITY = 85  # Good balance of quality vs size
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _sanitize_filename(name: str) -> str:
    """Sanitize a filename to only safe characters."""
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)


def _convert_to_webp(data: bytes, max_dimension: int | None = None) -> bytes:
    """Convert image bytes to WebP format, optionally resizing.

    Args:
        data: Raw image bytes (JPEG, PNG, GIF, etc.)
        max_dimension: If set, resize so the largest side is at most this many pixels.

    Returns:
        WebP-encoded image bytes.
    """
    from PIL import Image

    img = Image.open(io.BytesIO(data))

    # Convert RGBA/P to RGB if needed (WebP supports RGBA but smaller as RGB for opaque images)
    if img.mode in ("RGBA", "LA", "PA"):
        # Keep alpha channel for transparency
        pass
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Resize if requested
    if max_dimension and max(img.size) > max_dimension:
        img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=WEBP_QUALITY, method=4)
    return buf.getvalue()


@router.post("/api/v1/flyers/upload")
async def upload_flyer(file: UploadFile = File(...)):
    """Upload a flyer image to local storage.

    Images (JPEG, PNG, GIF) are automatically converted to WebP for
    faster page loads. PDFs are stored as-is. Returns the public URL.
    """

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

    # Convert images to WebP (skip PDFs and already-WebP files)
    if file.content_type in CONVERTIBLE_TYPES:
        original_size = len(data)
        data = _convert_to_webp(data)
        # Replace extension with .webp
        stem = Path(original_name).stem
        safe_name = f"{timestamp}-{stem}.webp"
        logger.info(
            f"Converted {file.content_type} to WebP: {original_size} -> {len(data)} bytes "
            f"({100 - len(data) * 100 // original_size}% smaller)"
        )
    else:
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
