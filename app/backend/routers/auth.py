import logging
import os
from typing import Optional
from urllib.parse import urlencode

import httpx
from core.auth import (
    IDTokenValidationError,
    build_authorization_url,
    build_logout_url,
    generate_code_challenge,
    generate_code_verifier,
    generate_nonce,
    generate_state,
    get_oidc_discovery,
    validate_id_token,
)
from core.config import settings
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from schemas.auth import UserResponse
from services.auth import AuthService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _local_patch(url: str) -> str:
    """Patch URL for local development."""
    if os.getenv("LOCAL_PATCH", "").lower() not in ("true", "1"):
        return url
    patched_url = url.replace("https://", "http://").replace(":8000", ":3000")
    logger.debug("[get_dynamic_backend_url] patching URL from %s to %s", url, patched_url)
    return patched_url


def get_dynamic_backend_url(request: Request) -> str:
    """Get backend URL dynamically from request headers.

    Priority: mgx-external-domain > x-forwarded-host > host > settings.backend_url
    """
    mgx_external_domain = request.headers.get("mgx-external-domain")
    x_forwarded_host = request.headers.get("x-forwarded-host")
    host = request.headers.get("host")
    scheme = request.headers.get("x-forwarded-proto", "https")

    effective_host = mgx_external_domain or x_forwarded_host or host
    if not effective_host:
        logger.warning("[get_dynamic_backend_url] No host found, fallback to %s", settings.backend_url)
        return settings.backend_url

    dynamic_url = _local_patch(f"{scheme}://{effective_host}")
    logger.debug(
        "[get_dynamic_backend_url] mgx-external-domain=%s, x-forwarded-host=%s, host=%s, scheme=%s, dynamic_url=%s",
        mgx_external_domain, x_forwarded_host, host, scheme, dynamic_url,
    )
    return dynamic_url


def derive_name_from_email(email: str) -> str:
    return email.split("@", 1)[0] if email else ""


# ---------------------------------------------------------------------------
# OIDC Login Flow
# ---------------------------------------------------------------------------

@router.get("/login")
async def login(request: Request, db: AsyncSession = Depends(get_db)):
    """Start OIDC login flow with PKCE."""
    state = generate_state()
    nonce = generate_nonce()
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)

    # Store state, nonce, and code verifier in database
    auth_service = AuthService(db)
    await auth_service.store_oidc_state(state, nonce, code_verifier)

    # Build redirect_uri dynamically from request
    backend_url = get_dynamic_backend_url(request)
    redirect_uri = f"{backend_url}/api/v1/auth/callback"
    logger.info("[login] Starting OIDC flow with redirect_uri=%s", redirect_uri)

    # build_authorization_url is now async (uses discovery)
    auth_url = await build_authorization_url(state, nonce, code_challenge, redirect_uri=redirect_uri)
    return RedirectResponse(
        url=auth_url,
        status_code=status.HTTP_302_FOUND,
        headers={"X-Request-ID": state},
    )


@router.get("/callback")
async def callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle OIDC callback — provider-agnostic."""
    backend_url = get_dynamic_backend_url(request)

    def redirect_with_error(message: str) -> RedirectResponse:
        fragment = urlencode({"msg": message})
        return RedirectResponse(
            url=f"{backend_url}/auth/error?{fragment}",
            status_code=status.HTTP_302_FOUND,
        )

    if error:
        detail = error_description or error
        logger.warning("[callback] OIDC error from provider: %s — %s", error, detail)
        return redirect_with_error(f"Authentication error: {detail}")

    if not code or not state:
        return redirect_with_error("Missing code or state parameter")

    # Validate state using database
    auth_service = AuthService(db)
    temp_data = await auth_service.get_and_delete_oidc_state(state)
    if not temp_data:
        return redirect_with_error("Invalid or expired state parameter")

    nonce = temp_data["nonce"]
    code_verifier = temp_data.get("code_verifier")

    try:
        # Build redirect_uri dynamically from request
        redirect_uri = f"{backend_url}/api/v1/auth/callback"
        logger.info("[callback] Exchanging code for tokens with redirect_uri=%s", redirect_uri)

        # Get the token endpoint from OIDC Discovery
        discovery = await get_oidc_discovery()
        token_url = discovery["token_endpoint"]

        # Exchange authorization code for tokens with PKCE
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": settings.oidc_client_id,
            "client_secret": settings.oidc_client_secret,
        }

        if code_verifier:
            token_data["code_verifier"] = code_verifier

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                token_response = await client.post(
                    token_url,
                    data=token_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
        except httpx.HTTPError as e:
            logger.error("[callback] Token exchange HTTP error: url=%s, error=%s", token_url, str(e), exc_info=True)
            return redirect_with_error(f"Token exchange failed: {e}")

        if token_response.status_code != 200:
            logger.error(
                "[callback] Token exchange failed: url=%s, status=%s, body=%s",
                token_url, token_response.status_code, token_response.text,
            )
            return redirect_with_error(f"Token exchange failed (HTTP {token_response.status_code})")

        tokens = token_response.json()

        # Validate ID token
        id_token = tokens.get("id_token")
        if not id_token:
            return redirect_with_error("No ID token received from provider")

        id_claims = await validate_id_token(id_token)

        # Validate nonce
        if id_claims.get("nonce") != nonce:
            return redirect_with_error("Invalid nonce")

        # Get email/name from ID token claims first
        email = id_claims.get("email", "")
        name = id_claims.get("name", "")

        # If email is missing, try fetching from userinfo endpoint
        if not email:
            access_token = tokens.get("access_token")
            if access_token:
                try:
                    userinfo_url = discovery.get("userinfo_endpoint")
                    if not userinfo_url:
                        # Derive from issuer
                        issuer = discovery.get("issuer", "").rstrip("/")
                        userinfo_url = f"{issuer}/me"
                    async with httpx.AsyncClient(timeout=15.0) as uc:
                        ui_resp = await uc.get(
                            userinfo_url,
                            headers={"Authorization": f"Bearer {access_token}"},
                        )
                    if ui_resp.status_code == 200:
                        userinfo = ui_resp.json()
                        email = userinfo.get("email", "") or email
                        name = userinfo.get("name", "") or name
                        logger.info("[callback] Got email from userinfo: %s", email)
                    else:
                        logger.warning("[callback] Userinfo request failed: %s %s", ui_resp.status_code, ui_resp.text[:200])
                except Exception as ui_err:
                    logger.warning("[callback] Failed to fetch userinfo: %s", ui_err)

        name = name or derive_name_from_email(email)
        user = await auth_service.get_or_create_user(
            platform_sub=id_claims["sub"], email=email, name=name,
        )

        # Issue application JWT token
        app_token, expires_at, _ = await auth_service.issue_app_token(user=user)

        fragment = urlencode(
            {
                "token": app_token,
                "expires_at": int(expires_at.timestamp()),
                "token_type": "Bearer",
            }
        )

        redirect_url = f"{backend_url}/auth/callback?{fragment}"
        logger.info("[callback] OIDC callback successful, redirecting to %s", redirect_url)
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)

    except IDTokenValidationError as e:
        return redirect_with_error(f"Authentication failed: {e.message}")
    except HTTPException as e:
        return redirect_with_error(str(e.detail))
    except Exception as e:
        logger.exception("[callback] Unexpected error in OIDC callback: %s", e)
        return redirect_with_error(
            "Authentication processing failed. Please try again or contact support if the issue persists."
        )


# ---------------------------------------------------------------------------
# Token info & Logout
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@router.get("/logout")
async def logout():
    """Logout user — redirect to OIDC provider's end_session_endpoint."""
    # build_logout_url is now async (uses discovery)
    logout_url = await build_logout_url()
    return {"redirect_url": logout_url}


# ---------------------------------------------------------------------------
# Health / Debug
# ---------------------------------------------------------------------------

@router.get("/oidc-status")
async def oidc_status():
    """Check OIDC provider connectivity (useful for debugging new provider setup)."""
    try:
        discovery = await get_oidc_discovery(force_refresh=True)
        return {
            "status": "ok",
            "issuer": discovery.get("issuer"),
            "authorization_endpoint": discovery.get("authorization_endpoint"),
            "token_endpoint": discovery.get("token_endpoint"),
            "jwks_uri": discovery.get("jwks_uri"),
            "end_session_endpoint": discovery.get("end_session_endpoint"),
            "scopes_supported": discovery.get("scopes_supported", []),
        }
    except Exception as e:
        return {
            "status": "error",
            "detail": str(e),
            "oidc_issuer_url_configured": getattr(settings, "oidc_issuer_url", "NOT SET"),
        }
