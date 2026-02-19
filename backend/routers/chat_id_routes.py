from fastapi import APIRouter, Depends, Body
from security.api_key import verify_api_key_dependency
from core import supabase
import uuid

router = APIRouter(prefix="",tags=["Utilities"])

@router.post("/get_chat_id")
def get_chat_id(
    payload: dict = Body(...),
    _: None = Depends(verify_api_key_dependency),
):
    project_id = payload.get("project_id")
    user_email = payload.get("user_email")  # intentionally unused (Flask parity)
    email = payload.get("email")

    if not project_id or not email:
        return {"error": "Missing data"}, 400

    try:
        user = (
            supabase
            .table("user_perms")
            .select("id")
            .eq("email", email)
            .execute()
        )

        user_id = user.data[0]["id"] if user.data else None

        existing = (
            supabase
            .table("chat_id_counters")
            .select("chat_id")
            .eq("project_id", project_id)
            .eq("user_id", user_id)
            .execute()
        )

        if existing.data:
            return {"chat_id": existing.data[0]["chat_id"]}

        new_chat_id = str(uuid.uuid4())

        supabase.table("chat_id_counters").insert({
            "project_id": project_id,
            "chat_id": new_chat_id,
            "user_id": user_id
        }).execute()

        return {"chat_id": new_chat_id}

    except Exception as e:
        print("❌ Error fetching chat_id:", e)
        return {"chat_id": "default"}
