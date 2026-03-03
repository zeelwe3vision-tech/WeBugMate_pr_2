from fastapi import APIRouter, Depends
from services.chat_service import handle_common_chat
from security.auth_utils import get_current_user
from services.work_service import handle_work_chat
from pydantic import BaseModel
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect
from security.auth_utils import get_current_user_from_token
import json
from services.ws_utils import stream_response
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

@router.websocket("/common/ws/{project_id}")
async def common_chat_ws(
    websocket: WebSocket,
    project_id: str
):
    await websocket.accept()

    try:
        # 🔐 Extract token from query params
        token = websocket.query_params.get("token")
        user_email = websocket.query_params.get("user_email")

        if token != "webugmate123":
            await websocket.close(code=1008)
            return

        if not user_email:
            await websocket.close(code=1008)
            return

        current_user = {
            "email": user_email,
            "name": "User"
        }

        print("🔎 COMMON WEBSOCKET CURRENT USER:", current_user)

        while True:
            raw_data = await websocket.receive_text()
            data_dict = json.loads(raw_data)

            # Inject project_id from URL
            data_dict["project_id"] = project_id

            # Convert to your existing Pydantic model
            data = CommonChatRequest(**data_dict)

            stream = await handle_common_chat(
                data,
                current_user,
                stream=True
            )

            await stream_response(websocket, stream)

    except WebSocketDisconnect:
        print("🔌 Common WebSocket disconnected")

    except Exception as e:
        print("❌ Common WS error:", e)
        await websocket.send_json({
            "type": "error",
            "message": "Something went wrong."
        })
        await websocket.close()