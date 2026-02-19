# security/api_key.py

from fastapi import Request, HTTPException
from core import verify_api_key   # reuse your existing logic

def verify_api_key_dependency(request: Request):
    """
    FastAPI-compatible wrapper around core.verify_api_key
    """
    if not verify_api_key(request.headers):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized"
        )
