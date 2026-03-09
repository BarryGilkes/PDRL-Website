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

        # Convert JWK → PEM (supports both RSA and EC keys)
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa, ec

        def base64url_decode(inp):
            padding = 4 - (len(inp) % 4)
            if padding != 4:
                inp += "=" * padding
            return base64.urlsafe_b64decode(inp)

        try:
            key_type = key.get("kty", "RSA")
            alg = key.get("alg", "RS256")

            if key_type == "EC":
                # Elliptic Curve key (used by Logto, some other providers)
                crv_map = {
                    "P-256": ec.SECP256R1(),
                    "P-384": ec.SECP384R1(),
                    "P-521": ec.SECP521R1(),
                }
                crv = key.get("crv", "P-256")
                curve = crv_map.get(crv)
                if not curve:
                    raise ValueError(f"Unsupported EC curve: {crv}")

                x = int.from_bytes(base64url_decode(key["x"]), "big")
                y = int.from_bytes(base64url_decode(key["y"]), "big")
                public_numbers = ec.EllipticCurvePublicNumbers(x, y, curve)
                public_key = public_numbers.public_key()
                logger.info("Using EC key (curve=%s, alg=%s)", crv, alg)

            else:
                # RSA key (default for many providers)
                n = int.from_bytes(base64url_decode(key["n"]), "big")
                e = int.from_bytes(base64url_decode(key["e"]), "big")
                public_numbers = rsa.RSAPublicNumbers(e, n)
                public_key = public_numbers.public_key()
                alg = "RS256"
                logger.info("Using RSA key (alg=%s)", alg)

            pem_key = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        except Exception as e:
            logger.error("ID token validation failed: JWK→PEM conversion error: %s", e)
            raise IDTokenValidationError("Authentication key processing failed", "key_conversion_error")

        # Determine the algorithm(s) to accept for verification
        # EC: ES256, ES384, ES512  |  RSA: RS256, RS384, RS512
        accepted_algs = [alg] if alg else ["RS256", "ES256", "ES384", "ES512"]

        # Use the issuer from the discovery document — this is the canonical
        # value that the provider puts into its tokens.
        discovery = await get_oidc_discovery()
        expected_issuer = discovery.get("issuer", settings.oidc_issuer_url)

        # Decode and verify
        try:
            payload = jwt.decode(
                id_token,
                pem_key,
                algorithms=accepted_algs,
                issuer=expected_issuer,
                audience=settings.oidc_client_id,
                options={"verify_at_hash": False},
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
