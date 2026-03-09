import logging
import mimetypes
from typing import Optional
from urllib.parse import urljoin

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public", tags=["public"])


class FlyerUrlResponse(BaseModel):
    download_url: str
    expires_at: Optional[str] = None


@router.get("/flyer-url")
async def get_public_flyer_url(
    object_key: str = Query(..., description="The flyer object key (full path, e.g. /images/photo1771442659.jpg)"),
    bucket_name: str = Query("event-flyers", description="The bucket name"),
):
    """Get a public download URL for an event flyer - no auth required.
    
    This endpoint calls the OSS service directly instead of using FileUpDownRequest,
    because the FileUpDownRequest schema validator strips directory prefixes from
    object_key (e.g., '/images/photo1771442659.jpg' becomes '/images/photo1771442659.jpg'), which breaks lookups.
    """
    if not object_key or not object_key.strip():
        raise HTTPException(status_code=400, detail="object_key is required")

    try:
        if not settings.oss_service_url or not settings.oss_api_key:
            raise ValueError("OSS service not configured. Set OSS_SERVICE_URL and OSS_API_KEY.")

        headers = {
            "Authorization": f"Bearer {settings.oss_api_key}",
            "Content-Type": "application/json",
        }

        content_type, _ = mimetypes.guess_type(str(object_key))
        if not content_type:
            content_type = "application/octet-stream"

        endpoint = f"/api/v1/infra/client/oss/buckets/{bucket_name}/objects/download_url"
        payload = {
            "content_type": content_type,
            "expires_in": 0,
            "object_key": object_key,
        }

        url = urljoin(settings.oss_service_url, endpoint)
        logger.info(f"Requesting flyer download URL: bucket={bucket_name}, key={object_key}")

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.request(
                method="POST",
                url=url,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            result = response.json()

            if result.get("code") != 0:
                error_msg = result.get("error", "Unknown error")
                message = result.get("message", "")
                logger.error(f"OSS service error for key={object_key}: {error_msg}. {message}")
                raise ValueError(f"OSS error: {error_msg}. {message}")

            data = result.get("data", {})
            download_url = data.get("download_url", "")
            logger.info(f"Got flyer download URL for key={object_key}: {download_url[:80]}...")

            return {
                "download_url": download_url,
                "expires_at": data.get("expires_at", ""),
            }

    except httpx.HTTPStatusError as e:
        error_msg = f"OSS HTTP error: {e.response.status_code} - {e.response.text}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=f"Failed to get flyer URL: {error_msg}")
    except ValueError as e:
        logger.error(f"Value error getting flyer URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get public flyer URL for key={object_key}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get flyer URL: {str(e)}")