from __future__ import annotations
import re
from pathlib import Path
from uuid import uuid4
from ..database import DATA_DIR

UPLOADS = DATA_DIR / "uploads"
UPLOADS.mkdir(parents=True, exist_ok=True)


def save_original(filename: str, content: bytes) -> str:
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)[:120] or "document"
    key = f"{uuid4().hex}_{safe_name}"
    destination = UPLOADS / key
    destination.write_bytes(content)
    return str(destination.relative_to(DATA_DIR))


def read_original(key: str) -> bytes | None:
    candidate = (DATA_DIR / key).resolve()
    if not candidate.is_relative_to(UPLOADS.resolve()) or not candidate.exists():
        return None
    return candidate.read_bytes()
