cat > /tmp/fix_ec_keys.py << 'PYFIX'
import re

filepath = "/opt/pdrl/app/backend/core/auth.py"

with open(filepath, "r") as f:
    content = f.read()

# Replace the JWK-to-PEM conversion block and the jwt.decode algorithms
# Find the old RSA-only block and replace with EC+RSA support

old_block = '''        # Convert JWK → PEM
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
            )'''

new_block = '''        # Convert JWK → PEM (supports both RSA and EC keys)
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
            )'''

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(filepath, "w") as f:
        f.write(content)
    print("✅ Patched core/auth.py — EC + RSA key support added")
else:
    print("❌ Could not find the exact block to replace.")
    print("   Trying line-by-line search...")
    
    # Fallback: check if already patched
    if "key_type == \"EC\"" in content:
        print("   File appears to already be patched!")
    else:
        print("   Manual edit required.")
PYFIX

python3 /tmp/fix_ec_keys.py
