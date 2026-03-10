from fastapi import APIRouter, Request,Depends
from services.work_service import handle_work_chat
from security.auth_utils import get_current_user
from security.auth_utils import get_current_user_from_token
from pydantic import BaseModel
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect
import json
from services.ws_utils import stream_response
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

@router.websocket("/work/ws/{project_id}")
async def work_chat_ws(
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

        print("🔎 WEBSOCKET CURRENT USER:", current_user)

# JONCY START
        # token = websocket.query_params.get("token")

        # if not token:
        #     await websocket.close(code=1008)
        #     return

        # current_user = get_current_user_from_token(token)

        # if not current_user:
        #     await websocket.close(code=1008)
        #     return

        # print("🔎 WEBSOCKET CURRENT USER:", current_user)
# JONCY END
        
        while True:
            # Receive message from frontend
            raw_data = await websocket.receive_text()
            data_dict = json.loads(raw_data)

            # Inject project_id from URL
            data_dict["project_id"] = project_id

            # Convert to Pydantic model
            data = WorkChatRequest(**data_dict)

            stream = await handle_work_chat(
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
        print("🔌 WebSocket disconnected")

    except Exception as e:
        print("❌ Work WebSocket error:", str(e))

        try:
            await websocket.send_json({
                "type": "error",
                "message": "⚠ Something went wrong. Please try again."
            })
        except:
            pass

        await websocket.close()