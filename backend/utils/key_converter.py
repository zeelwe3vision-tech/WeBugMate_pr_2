import re

def camel_to_snake(name: str) -> str:
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()



def convert_keys_to_snake(obj):
    """
    Recursively converts dict keys from camelCase to snake_case
    """
    if isinstance(obj, list):
        return [convert_keys_to_snake(i) for i in obj]

    if isinstance(obj, dict):
        new_dict = {}
        for k, v in obj.items():
            new_key = camel_to_snake(k)
            new_dict[new_key] = convert_keys_to_snake(v)
        return new_dict

    return obj
