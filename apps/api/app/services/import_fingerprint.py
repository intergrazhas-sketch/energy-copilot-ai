"""Upload fingerprint for import audit deduplication."""

from __future__ import annotations

import hashlib
import uuid


def compute_upload_fingerprint(
    plant_id: uuid.UUID,
    mode: str,
    files: list[tuple[str, bytes]],
) -> str:
    """Stable hash for plant + mode + ordered file names/sizes/content."""
    parts = [str(plant_id), mode]
    for filename, raw in sorted(files, key=lambda item: item[0].lower()):
        digest = hashlib.sha256(raw).hexdigest()
        parts.append(f"{filename}:{len(raw)}:{digest}")
    payload = "|".join(parts)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
