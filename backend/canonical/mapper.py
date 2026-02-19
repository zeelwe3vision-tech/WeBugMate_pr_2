# from utils.key_converter import camel_to_snake

# def map_to_canonical(table: str, payload: dict, schema: dict) -> dict:
#     canonical = {}

#     for key in schema.keys():
#         frontend_key = snake_to_camel(key)
#         canonical[key] = payload.get(frontend_key)

#     return canonical

from utils.key_converter import camel_to_snake


def map_to_canonical(table: str, payload: dict, schema: dict) -> dict:
    canonical = {}

    # 🔥 UNIVERSAL KEY MAPPING
    for frontend_key, value in payload.items():
        canonical_key = camel_to_snake(frontend_key)

        if canonical_key in schema:
            canonical[canonical_key] = value

    # 🔥 SPECIAL CASE: team members
    if table == "projects" and "teamAssignments" in payload:
        canonical["team_members"] = _normalize_team_members(
            payload.get("teamAssignments", [])
        )

    return canonical



def snake_to_camel(snake):
    parts = snake.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])

def _normalize_team_members(members):
    """
    Ensure team members list has snake_case keys.
    """
    if not isinstance(members, list):
        return []
    
    normalized = []
    for m in members:
        if isinstance(m, dict):
            # Recursively convert keys in dict
            new_m = {}
            for k, v in m.items():
                new_key = camel_to_snake(k)
                new_m[new_key] = v
            normalized.append(new_m)
        else:
            normalized.append(m)
    return normalized
