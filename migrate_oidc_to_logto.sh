#!/usr/bin/env bash
# ============================================================================
# PDRL OIDC Provider Migration Script
# Migrates from atoms.dev to a standards-compliant OIDC provider (e.g. Logto)
#
# What this script does:
#   1. Backs up all files it will modify into ./backups_oidc_migration/
#   2. Rewrites app/backend/core/auth.py — uses OIDC Discovery for all endpoints
#   3. Rewrites app/backend/routers/auth.py — removes atoms.dev-specific token
#      exchange, uses discovery for token/auth/logout URLs
#   4. Rewrites app/backend/schemas/auth.py — removes PlatformTokenExchangeRequest
#   5. Rewrites app/backend/routers/settings.py — updates env var descriptions
#   6. Rewrites app/backend/alembic/env.py — keeps oidc_states in exclusion list
#   7. Creates a template .env.oidc.example with the values you need to fill in
#   8. Prints a post-migration checklist
#
# Usage:
#   cd /path/to/PDRL-Website-Working-Base
#   chmod +x migrate_oidc_to_logto.sh
#   ./migrate_oidc_to_logto.sh
#
# After running:
#   1. Copy .env.oidc.example values into your actual .env
#   2. Restart your backend
#   3. Test login flow
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups_oidc_migration_$(date +%Y%m%d_%H%M%S)"
APP_DIR="${SCRIPT_DIR}/app"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERR]${NC}  $1"; }

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================
log_info "=== PDRL OIDC Provider Migration Script ==="
log_info "Migrating from atoms.dev to standards-compliant OIDC (Logto/Keycloak/etc)"
echo ""

# Check we're in the right directory
if [ ! -d "${BACKEND_DIR}/core" ] || [ ! -d "${BACKEND_DIR}/routers" ]; then
    log_error "Cannot find app/backend/core/ or app/backend/routers/"
    log_error "Please run this script from the PDRL-Website-Working-Base root directory."
    exit 1
fi

# Check files exist
FILES_TO_MODIFY=(
    "${BACKEND_DIR}/core/auth.py"
    "${BACKEND_DIR}/routers/auth.py"
    "${BACKEND_DIR}/schemas/auth.py"
    "${BACKEND_DIR}/routers/settings.py"
    "${BACKEND_DIR}/alembic/env.py"
)

for f in "${FILES_TO_MODIFY[@]}"; do
    if [ ! -f "$f" ]; then
        log_error "Required file not found: $f"
        exit 1
    fi
done

log_success "All required source files found"

# ============================================================================
# BACKUP
# ============================================================================
log_info "Creating backups in ${BACKUP_DIR}/ ..."
mkdir -p "${BACKUP_DIR}"

for f in "${FILES_TO_MODIFY[@]}"; do
    rel_path="${f#${SCRIPT_DIR}/}"
    backup_path="${BACKUP_DIR}/${rel_path}"
    mkdir -p "$(dirname "${backup_path}")"
    cp "$f" "${backup_path}"
done

# Also backup .env if it exists
if [ -f "${BACKEND_DIR}/.env" ]; then
    cp "${BACKEND_DIR}/.env" "${BACKUP_DIR}/app/backend/.env"
    log_success "Backed up .env"
fi

log_success "All originals backed up to ${BACKUP_DIR}/"
echo ""

# ============================================================================
# FILE 1: app/backend/core/auth.py
# ============================================================================
log_info "Writing app/backend/core/auth.py (OIDC Discovery + provider-agnostic) ..."

cat > "${BACKEND_DIR}/core/auth.py" << 'CORE_AUTH_EOF'
import base64
import hashlib
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx
from core.config import settings
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError, JWSSignatureError, JWTClaimsError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OIDC Discovery cache — fetched once, reused for the lifetime of the process
# ---------------------------------------------------------------------------
_oidc_discovery_cache: Optional[Dict[str, Any]] = None
_oidc_discovery_fetched_at: float = 0.0
_OIDC_DISCOVERY_TTL: int = 3600  # Re-fetch discovery document every hour


async def get_oidc_discovery(force_refresh: bool = False) -> Dict[str, Any]:
    """Fetch and cache the OIDC Discovery document (RFC 8414).

    Works with any standards-compliant provider:
      Logto, Keycloak, Authentik, ZITADEL, Auth0, AWS Cognito, etc.
    """
    global _oidc_discovery_cache, _oidc_discovery_fetched_at

    now = time.time()
    if (
        not force_refresh
        and _oidc_discovery_cache is not None
        and (now - _oidc_discovery_fetched_at) < _OIDC_DISCOVERY_TTL
    ):
        return _oidc_discovery_cache

    issuer_url = settings.oidc_issuer_url.rstrip("/")
    discovery_url = f"{issuer_url}/.well-known/openid-configuration"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info("Fetching OIDC discovery from: %s", discovery_url)
            response = await client.get(discovery_url)
            response.raise_for_status()
            data = response.json()

            # Validate that essential fields are present
            required_fields = ["issuer", "authorization_endpoint", "token_endpoint", "jwks_uri"]
            missing = [f for f in required_fields if f not in data]
            if missing:
                logger.error("OIDC discovery missing required fields: %s", missing)
                raise Exception(f"OIDC discovery document missing: {missing}")

            _oidc_discovery_cache = data
            _oidc_discovery_fetched_at = now
            logger.info(
                "OIDC discovery loaded — issuer=%s, endpoints=%d fields",
                data.get("issuer"),
                len(data),
            )
            return data
    except httpx.TimeoutException as e:
        logger.error("Timeout fetching OIDC discovery from %s: %s", discovery_url, e)
        raise Exception("Unable to retrieve OIDC configuration (timeout)")
    except httpx.HTTPStatusError as e:
        logger.error(
            "HTTP %s fetching OIDC discovery from %s: %s",
            e.response.status_code,
            discovery_url,
            e.response.text,
        )
        raise Exception("Unable to retrieve OIDC configuration (HTTP error)")
    except Exception as e:
        logger.error("Failed to fetch OIDC discovery from %s: %s", discovery_url, e)
        raise Exception("Unable to retrieve OIDC configuration")


# ---------------------------------------------------------------------------
# PKCE helpers
# ---------------------------------------------------------------------------

def generate_state() -> str:
    """Generate a secure state parameter for OIDC."""
    return secrets.token_urlsafe(32)


def generate_nonce() -> str:
    """Generate a secure nonce parameter for OIDC."""
    return secrets.token_urlsafe(32)


def generate_code_verifier() -> str:
    """Generate PKCE code verifier."""
    return secrets.token_urlsafe(96)


def generate_code_challenge(code_verifier: str) -> str:
    """Generate PKCE code challenge from verifier using SHA256."""
    digest = hashlib.sha256(code_verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


# ---------------------------------------------------------------------------
# JWKS retrieval (via discovery)
# ---------------------------------------------------------------------------

async def get_jwks() -> Dict[str, Any]:
    """Get JWKS from the provider's jwks_uri discovered via OIDC Discovery."""
    discovery = await get_oidc_discovery()
    jwks_url = discovery["jwks_uri"]

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            logger.info("Fetching JWKS from: %s", jwks_url)
            response = await client.get(jwks_url)
            response.raise_for_status()
            jwks_data = response.json()
            logger.info(
                "Successfully fetched JWKS with %d keys",
                len(jwks_data.get("keys", [])),
            )
            return jwks_data
    except httpx.TimeoutException as e:
        logger.error("Timeout while fetching JWKS from %s: %s", jwks_url, e)
        raise Exception("Unable to retrieve authentication keys")
    except httpx.HTTPStatusError as e:
        logger.error(
            "HTTP error %s while fetching JWKS from %s: %s",
            e.response.status_code,
            jwks_url,
            e.response.text,
        )
        raise Exception("Unable to retrieve authentication keys")
    except Exception as e:
        logger.error("Failed to fetch JWKS from %s: %s", jwks_url, e)
        raise Exception("Unable to retrieve authentication keys")


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class IDTokenValidationError(Exception):
    """Custom exception for ID token validation errors."""

    def __init__(self, message: str, error_type: str = "validation_error"):
        self.message = message
        self.error_type = error_type
        super().__init__(self.message)


class AccessTokenError(Exception):
    """Custom exception for application JWT access token errors."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


# ---------------------------------------------------------------------------
# Application JWT (issued by *this* backend — not the OIDC provider)
# ---------------------------------------------------------------------------

def create_access_token(claims: Dict[str, Any], expires_minutes: Optional[int] = None) -> str:
    """Create signed JWT access token from provided claims."""
    if not settings.jwt_secret_key:
        logger.error("JWT secret key is not configured")
        raise ValueError("JWT secret key is not configured")

    now = datetime.now(timezone.utc)
    token_claims = claims.copy()

    expiry_minutes = expires_minutes if expires_minutes is not None else int(settings.jwt_expire_minutes)
    expire_at = now + timedelta(minutes=expiry_minutes)

    token_claims.update(
        {
            "exp": expire_at,
            "iat": now,
            "nbf": now,
        }
    )

    token = jwt.encode(token_claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    user_id = token_claims.get("sub", "unknown")
    user_hash = hashlib.sha256(str(user_id).encode()).hexdigest()[:8] if user_id != "unknown" else "unknown"
    logger.debug("Authentication token created for user hash: %s", user_hash)
    return token


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate JWT access token."""
    if not settings.jwt_secret_key:
        logger.error("JWT secret key is not configured")
        raise AccessTokenError("Authentication service is misconfigured")

    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub", "unknown")
        user_hash = hashlib.sha256(str(user_id).encode()).hexdigest()[:8] if user_id != "unknown" else "unknown"
        logger.debug("Authentication token validated for user hash: %s", user_hash)
        return payload
    except ExpiredSignatureError as exc:
        logger.info("Authentication token has expired")
        raise AccessTokenError("Token has expired") from exc
    except JWTError as exc:
        logger.warning("Token validation failed: %s", type(exc).__name__)
        raise AccessTokenError("Invalid authentication token") from exc


# ---------------------------------------------------------------------------
# ID Token validation (from the OIDC provider)
# ---------------------------------------------------------------------------

async def validate_id_token(id_token: str) -> Optional[Dict[str, Any]]:
    """Validate ID token with proper JWT signature verification using JWKS.

    Uses the issuer from the discovery document for validation so that it works
    regardless of whether OIDC_ISSUER_URL has a trailing path segment that
    differs from the actual ``iss`` claim (common with Logto, Cognito, etc.).
    """
    try:
        header = jwt.get_unverified_header(id_token)
        kid = header.get("kid")

        if not kid:
            logger.error("ID token validation failed: No key ID found in JWT header")
            raise IDTokenValidationError("Token format is invalid", "missing_kid")

        # Fetch JWKS
        try:
            jwks = await get_jwks()
        except Exception as e:
            logger.error(
                "ID token validation failed: Failed to fetch JWKS from issuer %s: %s",
                settings.oidc_issuer_url,
                e,
            )
            raise IDTokenValidationError("Unable to retrieve authentication keys", "jwks_fetch_error")

        # Find matching key
        key = None
        for jwk in jwks.get("keys", []):
            if jwk.get("kid") == kid:
                key = jwk
                break

        if not key:
            logger.error(
                "ID token validation failed: No key found for kid: %s in JWKS",
                kid,
            )
            raise IDTokenValidationError("Authentication key validation failed", "key_not_found")

        # Convert JWK → PEM
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        def base64url_decode(inp):
            padding = 4 - (len(inp) % 4)
            if padding != 4:
                inp += "=" * padding
            return base64.urlsafe_b64decode(inp)

        try:
            n = int.from_bytes(base64url_decode(key["n"]), "big")
            e = int.from_bytes(base64url_decode(key["e"]), "big")
            public_numbers = rsa.RSAPublicNumbers(e, n)
            public_key = public_numbers.public_key()
            pem_key = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        except Exception as e:
            logger.error("ID token validation failed: JWK→PEM conversion error: %s", e)
            raise IDTokenValidationError("Authentication key processing failed", "key_conversion_error")

        # Use the issuer from the discovery document — this is the canonical
        # value that the provider puts into its tokens.
        discovery = await get_oidc_discovery()
        expected_issuer = discovery.get("issuer", settings.oidc_issuer_url)

        # Decode and verify
        try:
            payload = jwt.decode(
                id_token,
                pem_key,
                algorithms=["RS256"],
                issuer=expected_issuer,
                audience=settings.oidc_client_id,
            )
            user_id = payload.get("sub", "unknown")
            user_hash = (
                hashlib.sha256(str(user_id).encode()).hexdigest()[:8]
                if user_id != "unknown"
                else "unknown"
            )
            logger.info("ID token successfully validated for user hash: %s", user_hash)
            return payload
        except ExpiredSignatureError:
            logger.error("JWT validation failed: ID token has expired")
            raise IDTokenValidationError("Token has expired", "token_expired")
        except JWSSignatureError:
            logger.error("JWT validation failed: Invalid JWT signature")
            raise IDTokenValidationError("Token signature verification failed", "invalid_signature")
        except JWTClaimsError as e:
            logger.error("JWT validation failed: Claims validation error: %s", e)
            if "iss" in str(e).lower() or "issuer" in str(e).lower():
                raise IDTokenValidationError("Token issuer validation failed", "invalid_issuer")
            elif "aud" in str(e).lower() or "audience" in str(e).lower():
                raise IDTokenValidationError("Token audience validation failed", "invalid_audience")
            else:
                raise IDTokenValidationError("Token claims validation failed", "invalid_claims")

    except IDTokenValidationError:
        raise
    except JWTError as e:
        logger.error("JWT validation failed: %s", e)
        raise IDTokenValidationError("Token validation failed", "jwt_error")
    except Exception as e:
        logger.error("Unexpected error during ID token validation: %s", e)
        raise IDTokenValidationError("Authentication processing failed", "unexpected_error")


# ---------------------------------------------------------------------------
# URL builders (now async — use discovery endpoints)
# ---------------------------------------------------------------------------

async def build_authorization_url(
    state: str,
    nonce: str,
    code_challenge: Optional[str] = None,
    redirect_uri: Optional[str] = None,
) -> str:
    """Build OIDC authorization URL using the discovered authorization_endpoint."""
    import urllib.parse

    discovery = await get_oidc_discovery()
    auth_endpoint = discovery["authorization_endpoint"]

    params = {
        "client_id": settings.oidc_client_id,
        "response_type": "code",
        "scope": settings.oidc_scope,
        "redirect_uri": redirect_uri or f"{settings.backend_url}/api/v1/auth/callback",
        "state": state,
        "nonce": nonce,
    }

    if code_challenge:
        params["code_challenge"] = code_challenge
        params["code_challenge_method"] = "S256"

    return f"{auth_endpoint}?" + urllib.parse.urlencode(params)


async def build_logout_url(id_token: Optional[str] = None) -> str:
    """Build OIDC RP-Initiated Logout URL using discovery.

    Falls back gracefully if the provider does not support end_session_endpoint
    (e.g. some minimal providers).
    """
    import urllib.parse

    discovery = await get_oidc_discovery()
    logout_endpoint = discovery.get("end_session_endpoint")

    if not logout_endpoint:
        # Provider doesn't advertise a logout endpoint — just redirect home
        logger.warning("OIDC provider does not advertise end_session_endpoint; returning frontend URL")
        return f"{settings.frontend_url}/logout-callback"

    params: Dict[str, str] = {
        "post_logout_redirect_uri": f"{settings.frontend_url}/logout-callback",
    }

    # Some providers also accept client_id on the logout request
    params["client_id"] = settings.oidc_client_id

    if id_token:
        params["id_token_hint"] = id_token

    return f"{logout_endpoint}?" + urllib.parse.urlencode(params)
CORE_AUTH_EOF

log_success "app/backend/core/auth.py written"


# ============================================================================
# FILE 2: app/backend/routers/auth.py
# ============================================================================
log_info "Writing app/backend/routers/auth.py (no atoms.dev platform exchange) ..."

cat > "${BACKEND_DIR}/routers/auth.py" << 'ROUTER_AUTH_EOF'
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

        # Get or create user
        email = id_claims.get("email", "")
        name = id_claims.get("name") or derive_name_from_email(email)
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
ROUTER_AUTH_EOF

log_success "app/backend/routers/auth.py written"


# ============================================================================
# FILE 3: app/backend/schemas/auth.py
# ============================================================================
log_info "Writing app/backend/schemas/auth.py (remove PlatformTokenExchangeRequest) ..."

cat > "${BACKEND_DIR}/schemas/auth.py" << 'SCHEMAS_AUTH_EOF'
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str  # String UUID — either OIDC provider 'sub' or local UUID
    email: str
    name: Optional[str] = None
    role: str = "user"  # user/admin
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True
SCHEMAS_AUTH_EOF

log_success "app/backend/schemas/auth.py written"


# ============================================================================
# FILE 4: app/backend/routers/settings.py
# ============================================================================
log_info "Writing app/backend/routers/settings.py (updated env var descriptions) ..."

cat > "${BACKEND_DIR}/routers/settings.py" << 'SETTINGS_EOF'
from pathlib import Path
from typing import Dict

from dependencies.auth import get_admin_user
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from schemas.auth import UserResponse

router = APIRouter(prefix="/api/v1/admin/settings", tags=["admin-settings"])


class EnvVariable(BaseModel):
    key: str
    value: str
    description: str = ""


class EnvConfig(BaseModel):
    backend_vars: Dict[str, EnvVariable]
    frontend_vars: Dict[str, EnvVariable]


class EnvVariableUpdate(BaseModel):
    value: str


def get_env_file_path(env_type: str) -> Path:
    """Get the path to the environment variable file."""
    base_path = Path(__file__).parent.parent
    if env_type == "backend":
        return base_path / ".env"
    elif env_type == "frontend":
        return base_path.parent / "frontend" / ".env"
    else:
        raise ValueError("Invalid env_type")


def read_env_file(env_type: str) -> Dict[str, str]:
    """Read an environment variable file."""
    env_file = get_env_file_path(env_type)
    if not env_file.exists():
        return {}

    env_vars = {}
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()
    return env_vars


def write_env_file(env_type: str, env_vars: Dict[str, str]):
    """Write to an environment variable file."""
    env_file = get_env_file_path(env_type)
    env_file.parent.mkdir(parents=True, exist_ok=True)
    with open(env_file, "w", encoding="utf-8") as f:
        for key, value in env_vars.items():
            f.write(f"{key}={value}\n")


@router.get("", response_model=EnvConfig)
async def get_settings(current_user: UserResponse = Depends(get_admin_user)):
    """Retrieve environment variable configuration."""
    try:
        backend_vars = read_env_file("backend")
        frontend_vars = read_env_file("frontend")

        backend_descriptions = {
            "DATABASE_URL": "Database cRIPE_SECRET_KEY": "Stripe secret key",
            "STRIPE_SUCCESS_URL": "Payment success callback URL",
            "STRIPE_CANCEL_URL": "Payment cancellation callback URL",
            "ALLOWED_DOMAINS": "Allowed domains",
            "OIDC_ISSUER_URL": "OIDC provider issuer URL (e.g. https://your-tenant.logto.app/oidc)",
            "OIDC_CLIENT_ID": "OIDC application / client ID",
            "OIDC_CLIENT_SECRET": "OIDC application / client secret",
            "OIDC_SCOPE": "OIDC scopes (e.g. openid profile email)",
            "HOST": "Server host address",
            "PORT": "Server port",
            "FRONTEND_URL": "Frontend URL",
            "JWT_SECRET_KEY": "JWT signing secret key",
            "JWT_ALGORITHM": "JWT signing algorithm",
            "JWT_EXPIRE_MINUTES": "JWT expiration time (minutes)",
            "ADMIN_USER_ID": "Admin user ID (OIDC sub claim of admin)",
            "ADMIN_USER_EMAIL": "Admin user email",
        }

        frontend_descriptions = {
            "VITE_API_BASE_URL": "Base API URL",
            "VITE_FRONTEND_URL": "Frontend URL",
        }

        backend_config = {}
        for key, value in backend_vars.items():
            backend_config[key] = EnvVariable(
                key=key, value=value, description=backend_descriptions.get(key, ""),
            )

        frontend_config = {}
        for key, value in frontend_vars.items():
            frontend_config[key] = EnvVariable(
                key=key, value=value, description=frontend_descriptions.get(key, ""),
            )

        return EnvConfig(backend_vars=backend_config, frontend_vars=frontend_config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read configuration: {str(e)}")


@router.put("/backend/{key}")
async def update_backend_setting(
    key: str, update: EnvVariableUpdate, current_user: UserResponse = Depends(get_admin_user)
):
    """Update a backend environment variable."""
    try:
        env_vars = read_env_file("backend")
        env_vars[key] = update.value
        write_env_file("backend", env_vars)
        return {"message": f"Backend configuration '{key}' updated successfully; restart required to take effect."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update configuration: {str(e)}")


@router.put("/frontend/{key}")
async def update_frontend_setting(
    key: str, update: EnvVariableUpdate, current_user: UserResponse = Depends(get_admin_user)
):
    """Update a frontend environment variable."""
    try:
        env_vars = read_env_file("frontend")
        env_vars[key] = update.value
        write_env_file("frontend", env_vars)
        return {"message": f"Frontend configuration '{key}' updated successfully; restart required to take effect."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update configuration: {str(e)}")


@router.post("/backend/{key}")
async def add_backend_setting(
    key: str, update: EnvVariableUpdate, current_user: UserResponse = Depends(get_admin_user)
):
    """Add a backend environment variable."""
    try:
        env_vars = read_env_file("backend")
        env_vars[key] = update.value
        write_env_file("backend", env_vars)
        return {"message": f"Backend configuration '{key}' added successfully; restart required to take effect."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add configuration: {str(e)}")


@router.post("/frontend/{key}")
async def add_frontend_setting(
    key: str, update: EnvVariableUpdate, current_user: UserResponse = Depends(get_admin_user)
):
    """Add a frontend environment variable."""
    try:
        env_vars = read_env_file("frontend")
        env_vars[key] = update.value
        write_env_file("frontend", env_vars)
        return {"message": f"Frontend configuration '{key}' added successfully; restart required to take effect."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add configuration: {str(e)}")


@router.delete("/backend/{key}")
async def delete_backend_setting(key: str, current_user: UserResponse = Depends(get_admin_user)):
    """Delete a backend environment variable."""
    try:
        env_vars = read_env_file("backend")
        if key in env_vars:
            del env_vars[key]
            write_env_file("backend", env_vars)
            return {"message": f"Backend configuration '{key}' deleted successfully; restart required to take effect."}
        else:
            raise HTTPException(status_code=404, detail=f"Configuration item '{key}' does not exist")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete configuration: {str(e)}")


@router.delete("/frontend/{key}")
async def delete_frontend_setting(key: str, current_user: UserResponse = Depends(get_admin_user)):
    """Delete a frontend environment variable."""
    try:
        env_vars = read_env_file("frontend")
        if key in env_vars:
            del env_vars[key]
            write_env_file("frontend", env_vars)
            return {"message": f"Frontend configuration '{key}' deleted successfully; restart required to take effect."}
        else:
            raise HTTPException(status_code=404, detail=f"Configuration item '{key}' does not exist")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete configuration: {str(e)}")
SETTINGS_EOF

log_success "app/backend/routers/settings.py written"


# ============================================================================
# FILE 5: app/backend/alembic/env.py  (unchanged logic, cleaned comments)
# ============================================================================
log_info "Writing app/backend/alembic/env.py (keeping oidc_states in exclusion) ..."

cat > "${BACKEND_DIR}/alembic/env.py" << 'ALEMBIC_EOF'
#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Desc   : Alembic migrations environment

import asyncio
import importlib
import pkgutil
from logging.config import fileConfig

import models
from alembic import context
from core.database import Base
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

# Automatically import all ORM models under Models
for _, module_name, _ in pkgutil.iter_modules(models.__path__):
    importlib.import_module(f"{models.__name__}.{module_name}")

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def alembic_include_object(object, name, type_, reflected, compare_to):
    # type_ can be 'table', 'index', 'column', 'constraint'
    # Ignore tables managed outside of Alembic migrations
    if type_ == "table" and name in ["users", "sessions", "oidc_states"]:
        return False
    return True


async def run_migrations_online():
    connectable = create_async_engine(config.get_main_option("sqlalchemy.url"), poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(
            lambda sync_conn: context.configure(
                connection=sync_conn,
                target_metadata=target_metadata,
                compare_type=True,
                compare_server_default=True,
                include_object=alembic_include_object,
            )
        )
        async with connection.begin():
            await connection.run_sync(lambda sync_conn: context.run_migrations())
    await connectable.dispose()


def run_migrations():
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(run_migrations_online())
    except RuntimeError:
        asyncio.run(run_migrations_online())


run_migrations()
ALEMBIC_EOF

log_success "app/backend/alembic/env.py written"


# ============================================================================
# FILE 6: .env.oidc.example — template for new provider config
# ============================================================================
log_info "Creating .env.oidc.example template ..."

cat > "${BACKEND_DIR}/.env.oidc.example" << 'ENV_EXAMPLE_EOF'
# ============================================================================
# PDRL — OIDC Configuration Template
# Replace the values below with your chosen provider's details.
# ============================================================================

# ---- OIDC Provider ----
# Logto Cloud example:
#   OIDC_ISSUER_URL=https://your-tenant-id.logto.app/oidc
# Keycloak example:
#   OIDC_ISSUER_URL=https://keycloak.example.com/realms/pdrl
# ZITADEL example:
#   OIDC_ISSUER_URL=https://your-instance.zitadel.cloud
# AWS Cognito example:
#   OIDC_ISSUER_URL=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXX

OIDC_ISSUER_URL=https://YOUR_TENANT.logto.app/oidc
OIDC_CLIENT_ID=YOUR_CLIENT_ID
OIDC_CLIENT_SECRET=YOUR_CLIENT_SECRET
OIDC_SCOPE=openid profile email

# ---- Redirect URIs to register with your provider ----
# Callback (must be registered):  https://your-domain.com/api/v1/auth/callback
# Logout  (must be registered):   https://your-domain.com/logout-callback

# ---- Application JWT (issued by this backend — keep these) ----
JWT_SECRET_KEY=CHANGE_ME_TO_A_RANDOM_SECRET
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# ---- Admin ----
ADMIN_USER_ID=oidc-sub-claim-of-admin-user
ADMIN_USER_EMAIL=admin@example.com

# ---- Other ----
# DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/pdrl
# FRONTEND_URL=https://your-domain.com
# HOST=0.0.0.0
# PORT=8000
ENV_EXAMPLE_EOF

log_success ".env.oidc.example created"


# ============================================================================
# SUMMARY & POST-MIGRATION CHECKLIST
# ============================================================================
echo ""
echo "=================================================================="
echo -e "${GREEN}  MIGRATION COMPLETE${NC}"
echo "=================================================================="
echo ""
echo "  Files modified:"
echo "    ✅  app/backend/core/auth.py           (OIDC Discovery, provider-agnostic)"
echo "    ✅  app/backend/routers/auth.py         (removed atoms.dev token exchange)"
echo "    ✅  app/backend/schemas/auth.py         (removed PlatformTokenExchangeRequest)"
echo "    ✅  app/backend/routers/settings.py     (updated env var descriptions)"
echo "    ✅  app/backend/alembic/env.py          (preserved, cleaned comments)"
echo "    ✅  app/backend/.env.oidc.example       (new — template for your provider)"
echo ""
echo "  Backups saved to:"
echo "    📂  ${BACKUP_DIR}/"
echo ""
echo "=================================================================="
echo -e "${YELLOW}  POST-MIGRATION CHECKLIST${NC}"
echo "=================================================================="
echo ""
echo "  1. CHOOSE & CONFIGURE YOUR OIDC PROVIDER"
echo "     - Recommended: Logto Cloud (https://logto.io) — free 50k MAU"
echo "     - Create a 'Traditional Web App'"
echo "     - Register redirect URI:"
echo "         https://YOUR-DOMAIN/api/v1/auth/callback"
echo "     - Register post-logout redirect URI:"
echo "         https://YOUR-DOMAIN/logout-callback"
echo "     - Copy the Endpoint, App ID, and App Secret"
echo ""
echo "  2. UPDATE YOUR .env"
echo "     - See app/backend/.env.oidc.example for the template"
echo "     - Replace OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET"
echo ""
echo "  3. TEST OIDC DISCOVERY"
echo "     - Start your backend"
echo "     - Visit: http://localhost:8000/api/v1/auth/oidc-status"
echo "     - Verify all endpoints are populated and status is 'ok'"
echo ""
echo "  4. TEST LOGIN FLOW"
echo "     - Click Login on the frontend"
echo "     - Should redirect to your new provider's login page"
echo "     - After login, should redirect back with a token"
echo ""
echo "  5. TEST ADMIN FLOW"
echo "     - Ensure ADMIN_USER_ID matches the 'sub' claim from your new provider"
echo "     - Log in, go to /admin, verify access"
echo ""
echo "  6. FILES UNCHANGED (no action needed):"
echo "     - dependencies/auth.py      (JWT decode — same format)"
echo "     - services/auth.py          (user CRUD + OIDC state — same interface)"
echo "     - models/auth.py            (User + OIDCState — same schema)"
echo "     - middleware/admin_auth.py   (admin checks — downstream of JWT)"
echo "     - All frontend files         (call /api/v1/auth/* — same URLs)"
echo "     - public/app.js             (Auth.login() → same backend URL)"
echo "     - public/auth/callback/     (reads token from URL — same format)"
echo ""
echo "  7. TO ROLLBACK:"
echo "     - Copy files from ${BACKUP_DIR}/ back to their original locations"
echo ""
echo "=================================================================="
