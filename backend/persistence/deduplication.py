from core import supabase
from canonical.schema import CANONICAL_SCHEMAS

def check_duplicates(table: str, data: dict, exclude_id: str = None):
    """
    Check if a record already exists in Supabase based on unique fields.
    Raises ValueError if a duplicate is found.
    :param exclude_id: Optional ID to exclude from check (for updates)
    """
    schema = CANONICAL_SCHEMAS.get(table)
    if not schema:
        return  # No schema, skip check

    # 1. Determine Unique Fields
    # Look for a special key '_unique_fields' in the schema, or default to some logic
    unique_fields = schema.get("_unique_fields", [])
    
    # If no explicit unique fields, we can't check efficiently.
    if not unique_fields:
        return

    # 2. Build Query
    query = supabase.table(table).select("*")
    
    # Exclude current record if updating
    if exclude_id:
        # Assuming primary key is 'id' or 'uuid'. 
        # Projects seem to use 'uuid' in some places in app.py, but 'id' in others.
        # We try filtering on 'id' as standard. If your DB uses 'uuid', change this.
        query = query.neq("id", exclude_id)
    
    conditions_met = False
    for field in unique_fields:
        value = data.get(field)
        if value:
            # Check if we should use 'eq' or 'ilike' (case-insensitive) for strings?
            # Ideally, data is already cleaned/lowercased, so 'eq' is fine.
            query = query.eq(field, value)
            conditions_met = True
    
    if not conditions_met:
        return

    # 3. Execute
    response = query.execute()
    
    if response.data and len(response.data) > 0:
        # Construct error message
        found_record = response.data[0]
        conflicts = [f"{k}={found_record.get(k)}" for k in unique_fields if k in found_record]
        raise ValueError(f"Duplicate record found in '{table}' with {', '.join(conflicts)}")
