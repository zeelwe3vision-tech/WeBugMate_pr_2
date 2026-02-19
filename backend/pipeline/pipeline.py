from canonical.schema import CANONICAL_SCHEMAS
from canonical.mapper import map_to_canonical
from cleaning.engine import clean_payload
from persistence.deduplication import check_duplicates
from core import supabase

def ingest(payload: dict) -> dict:
    return payload

def map_to_db(payload: dict) -> dict:
    return payload

def insert(table: str, payload: dict):
    raw = ingest(payload)

    schema = CANONICAL_SCHEMAS.get(table)
    if not schema:
        raise ValueError(f"No canonical schema for table: {table}")

    canonical = map_to_canonical(table, raw, schema)
    cleaned = clean_payload(canonical)
    
    # 🔒 DUPLICATE CHECK
    # We check duplicates on the CLEANED data (so 'test@example.com' matches 'test@example.com')
    check_duplicates(table, cleaned)
    
    db_data = map_to_db(cleaned)

    return supabase.table(table).insert(db_data).execute()


def update(table_name: str, record_id: str, payload: dict):
    schema = CANONICAL_SCHEMAS.get(table_name)
    if not schema:
        raise ValueError(f"No canonical schema for table: {table_name}")

    canonical = map_to_canonical(table_name, payload, schema)
    cleaned = clean_payload(canonical)
    
    # 🔒 DUPLICATE CHECK (Excluding self)
    check_duplicates(table_name, cleaned, exclude_id=record_id)
    
    db_data = map_to_db(cleaned)

    return (
        supabase
        .table(table_name)
        .update(db_data)
        .eq("id", record_id)
        .execute()
    )