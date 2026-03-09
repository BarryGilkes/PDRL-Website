"""
Temporary utility endpoint to upload local flyer images to Object Storage
and update the events table with permanent URLs.
"""
import logging
import os
import httpx
from fastapi import APIRouter, HTTPException
from services.storage import StorageService
from schemas.storage import BucketRequest, FileUpDownRequest, OSSBaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/upload-flyers", tags=["upload-flyers"])

BUCKET_NAME = "event-flyers"

FLYER_FILES = {
    1: {"path": "/tmp/pdrl-flyers/shootout-night.png", "key": "shootout-night.png"},
    2: {"path": "/tmp/pdrl-flyers/summer-nationals.png", "key": "summer-nationals.png"},
    3: {"path": "/tmp/pdrl-flyers/fall-classic.png", "key": "fall-classic.png"},
    4: {"path": "/tmp/pdrl-flyers/winter-warmup.png", "key": "winter-warmup.png"},
}


@router.post("/create-bucket")
async def create_bucket():
    """Create the event-flyers bucket"""
    try:
        service = StorageService()
        request = BucketRequest(bucket_name=BUCKET_NAME, visibility="public")
        result = await service.create_bucket(request)
        return {"status": "success", "bucket": result}
    except Exception as e:
        logger.error(f"Failed to create bucket: {e}")
        return {"status": "error", "detail": str(e)}


@router.post("/upload-all")
async def upload_all_flyers():
    """Upload all flyer images to Object Storage and return their download URLs"""
    results = []
    service = StorageService()

    for event_id, info in FLYER_FILES.items():
        file_path = info["path"]
        object_key = info["key"]

        if not os.path.exists(file_path):
            results.append({
                "event_id": event_id,
                "status": "error",
                "detail": f"File not found: {file_path}"
            })
            continue

        try:
            # Get upload presigned URL
            upload_req = FileUpDownRequest(bucket_name=BUCKET_NAME, object_key=object_key)
            upload_resp = await service.create_upload_url(upload_req)
            upload_url = upload_resp.upload_url

            if not upload_url:
                results.append({
                    "event_id": event_id,
                    "status": "error",
                    "detail": "No upload URL returned"
                })
                continue

            # Upload the file using the presigned URL
            with open(file_path, "rb") as f:
                file_data = f.read()

            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.put(
                    upload_url,
                    content=file_data,
                    headers={"Content-Type": "image/png"}
                )

            if resp.status_code not in (200, 201, 204):
                results.append({
                    "event_id": event_id,
                    "status": "error",
                    "detail": f"Upload failed with status {resp.status_code}: {resp.text[:200]}"
                })
                continue

            # Get download URL
            download_req = FileUpDownRequest(bucket_name=BUCKET_NAME, object_key=object_key)
            download_resp = await service.create_download_url(download_req)
            download_url = download_resp.download_url

            results.append({
                "event_id": event_id,
                "object_key": object_key,
                "status": "success",
                "download_url": download_url
            })

        except Exception as e:
            logger.error(f"Failed to upload flyer for event {event_id}: {e}")
            results.append({
                "event_id": event_id,
                "status": "error",
                "detail": str(e)
            })

    return {"results": results}