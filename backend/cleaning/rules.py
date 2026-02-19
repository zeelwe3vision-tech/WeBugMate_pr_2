import re
import json
from datetime import datetime

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)

# ------------------------
# TEXT CLEAN
# ------------------------
def clean_text(value):
    if not isinstance(value, str):
        return value

    value = value.strip()
    value = re.sub(r"\s+", " ", value)

    if value == "":
        return None

    # Force lowercase if it looks like an email (check regex or simple heuristic)
    # The regex allows mixed case, but we return .lower()
    # Relaxed check: if it has @ and ., treat as email to enforce lowercase
    if EMAIL_REGEX.match(value) or ("@" in value and "." in value):
        return value.lower()
        
    # User might have "Test@Example.com " -> stripped -> "Test@Example.com" -> matched -> lowercased
    
    return value


# ------------------------
# DATE PARSE
# ------------------------
def clean_date(value):
    if value is None:
        return None

    if isinstance(value, str):
        return datetime.fromisoformat(value).date()

    return value


def validate_date_order(data):
    start = data.get("start_date")
    end = data.get("end_date")

    if start and end and end < start:
        raise ValueError("end_date cannot be earlier than start_date")


# ------------------------
# ADDITIVE SAFETY HELPERS
# ------------------------
def _normalize_for_dedupe(value):
    """
    Normalize values ONLY for dedup comparison.
    Stored data is NOT modified here.
    """
    if isinstance(value, str):
        return value.strip().lower()

    if isinstance(value, list):
        return [_normalize_for_dedupe(v) for v in value]

    if isinstance(value, dict):
        return {k: _normalize_for_dedupe(v) for k, v in sorted(value.items())}

    return value


def _fingerprint(value) -> str:
    """
    Generate stable fingerprint for any JSON-like value.
    """
    normalized = _normalize_for_dedupe(value)
    return json.dumps(normalized, sort_keys=True, separators=(",", ":"))


# ------------------------
# DEEP CLEAN (ALL TYPES)
# ------------------------
def deep_clean(value):
    # STRING
    if isinstance(value, str):
        return clean_text(value)

    # LIST
    if isinstance(value, list):
        cleaned = []
        seen = set()

        for item in value:
            cleaned_item = deep_clean(item)
            if cleaned_item is None:
                continue

            # Existing logic (kept intact)
            if isinstance(cleaned_item, dict):
                email = cleaned_item.get("email")
                role = cleaned_item.get("role")
                # Specific check for team members (or objects with email/role)
                if email or role:
                    dedupe_key = f"{email}|{role}"
                else:
                    # Fallback for other objects (e.g. documents)
                    dedupe_key = _fingerprint(cleaned_item)
            else:
                dedupe_key = str(cleaned_item)

            # 🔒 ADDITIVE SAFETY LAYER (NO LOGIC REMOVED)
            dedupe_key = _fingerprint(dedupe_key)

            if dedupe_key not in seen:
                seen.add(dedupe_key)
                cleaned.append(cleaned_item)

        return cleaned

    # DICT (JSONB)
    if isinstance(value, dict):
        cleaned_dict = {}
        for k, v in value.items():
            if k in ("start_date", "end_date"):
                cleaned_dict[k] = clean_date(v)
            else:
                cleaned_dict[k] = deep_clean(v)
        return cleaned_dict

    # OTHER TYPES
    return value
