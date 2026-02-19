from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from security.auth_utils import get_current_user
from services.dual_service import handle_dual_chat

router = APIRouter(prefix="/chat", tags=["Dual Chat"])

class DualChatRequest(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None
    user_input: Optional[str] = None
    project_id: Optional[str] = "default"
    chat_id: Optional[str] = None
    model: Optional[str] = None


@router.post("/dual")
async def dual_chat(
    data: DualChatRequest,
    current_user=Depends(get_current_user)
):
    return await handle_dual_chat(data, current_user)