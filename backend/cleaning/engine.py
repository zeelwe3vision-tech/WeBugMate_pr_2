from utils.key_converter import convert_keys_to_snake
from cleaning.rules import deep_clean, validate_date_order

def clean_payload(payload: dict) -> dict:
    # 🔥 Convert frontend keys → DB keys
    payload = convert_keys_to_snake(payload)

    cleaned = {}
    for key, value in payload.items():
        cleaned[key] = deep_clean(value)

    validate_date_order(cleaned)
    return cleaned
