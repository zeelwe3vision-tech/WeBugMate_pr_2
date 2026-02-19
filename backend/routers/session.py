from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="",tags=["Session"])

class SessionPayload(BaseModel):
    email: str
    name: str | None = None

@router.post("/set_session")
async def set_session(payload: SessionPayload):
    return {
        "status": "ok",
        "email": payload.email,
        "name": payload.name
    }
