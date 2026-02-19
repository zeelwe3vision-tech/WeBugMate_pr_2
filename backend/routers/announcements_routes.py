# routers/announcement_routes.py

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from datetime import datetime, timezone
from core import supabase
from security.auth_utils import get_current_user

router = APIRouter(prefix="/announcements", tags=["Announcements"])


# -------- Get Announcements --------
@router.get("/get")
def get_announcements(
    current_user=Depends(get_current_user),
):
    user_email = current_user.get("email")

    try:
        res = (
            supabase.table("announcements")
            .select("*")
            .or_(f"sender_email.eq.{user_email},recipient_email.eq.{user_email}")
            .order("timestamp", desc=True)
            .execute()
        )

        return res.data or []

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------- Add Announcement --------
class AddAnnouncementRequest(BaseModel):
    recipient_email: str
    message: str
    type: str | None = "General"


@router.post("/add")
def add_announcement(
    data: AddAnnouncementRequest,
    current_user=Depends(get_current_user)
):
    try:
        sender_email = current_user.get("email")

        new_ann = {
            "sender_email": sender_email,
            "recipient_email": data.recipient_email,
            "message": data.message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "Pending" if data.type == "Task" else "Message"
        }

        res = supabase.table("announcements").insert(new_ann).execute()

        return {
            "success": True,
            "data": res.data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------- Delete Announcement --------
class DeleteAnnouncementRequest(BaseModel):
    id: int


@router.post("/delete")
def delete_announcement(
    data: DeleteAnnouncementRequest,
    current_user=Depends(get_current_user)
):
    try:
        res = (
            supabase.table("announcements")
            .delete()
            .eq("id", data.id)
            .execute()
        )

        return {
            "success": True,
            "deleted": res.data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
