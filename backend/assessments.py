# [29] SAVED ASSESSMENTS - stores every assessment the user saves from the Calculator so LCAs can be TRACKED
#      over time on the Reports page. Kept in a JSON file (data/assessments.json): works offline, no database needed.
import json
import threading
import uuid
from datetime import datetime
from pathlib import Path

FILE = Path(__file__).parent / "data" / "assessments.json"
_LOCK = threading.Lock()
MAX_ITEMS = 1000


MAX_FILE_BYTES = 5_000_000   # refuse to grow the store past ~5 MB


class StoreError(RuntimeError):
    pass


def _read():
    """Read the store. A damaged file is NOT treated as empty (that would let the next save wipe it):
    it is copied aside and an error is raised so nothing is overwritten."""
    if not FILE.exists():
        return []
    try:
        data = json.loads(FILE.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError("store is not a list")
        return data
    except (json.JSONDecodeError, ValueError, OSError) as e:
        bad = FILE.with_name(f"assessments.corrupt-{datetime.now():%Y%m%d-%H%M%S}.json")
        try:
            FILE.replace(bad)
        except OSError:
            pass
        raise StoreError(f"Saved assessments file was damaged and was moved to {bad.name}: {e}")


def _write(items):
    text = json.dumps(items, indent=1)
    if len(text.encode("utf-8")) > MAX_FILE_BYTES:
        raise StoreError("Assessment store is full (5 MB). Delete old assessments first.")
    tmp = FILE.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8")
    # atomic swap: a crash leaves either the old file or the new one, never half of each.
    # Concurrent requests in this process are serialised by _LOCK; this is a single-user file store,
    # not a database (no multi-process transactions).
    tmp.replace(FILE)


def list_assessments():
    with _LOCK:
        return sorted(_read(), key=lambda a: a["created_at"], reverse=True)


def save_assessment(data):
    item = {**data, "id": uuid.uuid4().hex[:12], "created_at": datetime.now().isoformat(timespec="seconds")}
    if not str(item.get("title", "")).strip():
        item["title"] = f"{item.get('metal', 'Metal')} - {item.get('route', '')} route"
    with _LOCK:
        items = _read()
        items.append(item)
        _write(items[-MAX_ITEMS:])
    return item


def delete_assessment(item_id):
    with _LOCK:
        items = _read()
        kept = [a for a in items if a.get("id") != item_id]
        _write(kept)
        return len(kept) < len(items)
