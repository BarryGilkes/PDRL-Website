"""
Local file-based ASR (Additional Supplementary Regulations) document upload and serving.
Stores ASR PDF documents on the local server filesystem.
"""
import logging
import mimetypes
import os
import re
import time
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["asrs"])

# Directory where ASRs will be stored (relative to backend root)
ASR_DIR = Path(__file__).parent.parent / "static" / "asrs"

# Ensure the directory exists on module load
ASR_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {"application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _sanitize_filename(name: str) -> str:
    """Sanitize a filename to only safe characters."""
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)


@router.post("/api/v1/asrs/upload")
async def upload_asr(file: UploadFile = File(...)):
    """Upload an ASR document (PDF) to local storage.

    Returns the public URL for downloading/viewing the document.
    """

    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Only PDF files are allowed.",
        )

    # Read file data and check size
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")

    # Build a unique, safe filename
    timestamp = int(time.time() * 1000)
    original_name = _sanitize_filename(file.filename or "upload.pdf")
    safe_name = f"{timestamp}-{original_name}"

    dest = ASR_DIR / safe_name
    dest.write_bytes(data)

    logger.info(f"ASR saved locally: {dest}  ({len(data)} bytes)")

    # Return the object key and the URL the frontend can use
    object_key = f"asrs/{safe_name}"
    public_url = f"/api/v1/asrs/file/{safe_name}"

    return {
        "object_key": object_key,
        "url": public_url,
        "filename": safe_name,
        "size": len(data),
    }


@router.get("/api/v1/asrs/file/{filename}")
async def serve_asr(filename: str):
    """Serve an ASR document from local storage."""
    safe = _sanitize_filename(filename)
    path = ASR_DIR / safe

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="ASR document not found")

    content_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(
        path,
        media_type=content_type or "application/pdf",
        filename=safe,
    )
