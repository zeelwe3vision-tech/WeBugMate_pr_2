from fastapi import APIRouter, Request,Depends
from services.work_service import handle_work_chat
from security.auth_utils import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/chat", tags=["Work Chat"])

class WorkChatRequest(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None
    user_input: Optional[str] = None  
    project_id: Optional[str] = None
    chat_id: Optional[str] = None
    model: Optional[str] = None
    
@router.post("/work")
async def work_chat(
    data: WorkChatRequest,
    current_user=Depends(get_current_user)
):
    return await handle_work_chat(data, current_user)
