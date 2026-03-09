@field_validator("object_key")
@classmethod
def validate_object_key(cls, v):
    if not v or len(v.strip()) == 0:
        raise ValueError("object_key cannot be empty")

    stripped = v.strip()

    # Split into path components, sanitize each part individually,
    # but preserve the directory structure (forward slashes)
    parts = stripped.split("/")
    sanitized_parts = []
    for part in parts:
        if not part:
            continue  # skip empty parts from leading/trailing/double slashes
        safe_part = re.sub(r"[^A-Za-z0-9._-]", "-", part)
        sanitized_parts.append(safe_part)

    if not sanitized_parts:
        raise ValueError("object_key cannot be empty")

    safe_object_key = "/".join(sanitized_parts)

    if len(safe_object_key) > 255:
        raise ValueError("object_key too long")

    return safe_object_key
