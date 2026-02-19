# from fastapi import APIRouter, HTTPException
# from pydantic import BaseModel
# from typing import Optional

# router = APIRouter(prefix="/chat", tags=["Chat"])


# # Define request body model
# class CommonChatRequest(BaseModel):
#     query: Optional[str] = None
#     message: Optional[str] = None
#     project_id: Optional[str] = "default"


# @router.post("/common")
# async def common_chat(payload: CommonChatRequest):

#     user_query = (payload.query or payload.message or "").strip()
#     project_id = payload.project_id

#     if not user_query:
#         raise HTTPException(status_code=400, detail="Query is required")

#     return {
#         "reply": f"You said: {user_query}",
#         "project_id": project_id
#     }
# from fastapi import APIRouter
# from pydantic import BaseModel
# from services.chat_service import handle_common_chat

# router = APIRouter(prefix="/chat", tags=["Chat"])


# class ChatRequest(BaseModel):
#     query: str


# @router.post("/common")
# async def chat_common(request: ChatRequest):
#     user_email = "test@example.com"  # 🔥 temporary (JWT later)

#     result = await handle_common_chat(request.dict(), user_email)

#     return result

from fastapi import APIRouter, Depends
from services.chat_service import handle_common_chat
from security.auth_utils import get_current_user
from services.work_service import handle_work_chat
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/chat", tags=["Chat"])

class CommonChatRequest(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None
    user_input: Optional[str] = None  
    project_id: Optional[str] = "default"
    chat_id: Optional[str] = None

@router.post("/common")
async def common_chat(
    data: CommonChatRequest,
    current_user=Depends(get_current_user)
):
    return await handle_common_chat(data, current_user)


# @router.post("/work")
# async def work_chat(data: dict, current_user=Depends(get_current_user)):
#     user_email = current_user["sub"]
#     return await handle_work_chat(data, user_email)
