from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from security.auth_utils import get_current_user,get_current_user_from_token
from services.dual_service import handle_dual_chat
from fastapi import WebSocket, WebSocketDisconnect
import json
from services.ws_utils import stream_response
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

@router.websocket("/dual/ws")
async def dual_chat_ws(
    websocket: WebSocket
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

        print("🔎 DUAL WEBSOCKET CURRENT USER:", current_user)

        while True:
            # Receive message from frontend
            raw_data = await websocket.receive_text()
            data_dict = json.loads(raw_data)

            # Convert to Pydantic model
            data = DualChatRequest(**data_dict)

            stream = await handle_dual_chat(
                data,
                current_user,
                stream=True
            )

            await stream_response(websocket, stream)

            # Signal completion
            await websocket.send_json({
                "type": "done"
            })

    except WebSocketDisconnect:
        print("🔌 Dual WebSocket disconnected")

    except Exception as e:
        print("❌ Dual WebSocket error:", e)
        await websocket.send_json({
            "type": "error",
            "message": "Something went wrong while processing your request."
        })
        await websocket.close()