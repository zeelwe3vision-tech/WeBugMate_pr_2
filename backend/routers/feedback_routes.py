from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Union, Dict, Any
from datetime import datetime, timezone
from core import supabase, get_user_perms_id, get_user_preference_summary
from security.auth_utils import get_current_user
import uuid



chat_feedback_router = APIRouter(prefix="/chat", tags=["Feedback"])

class FeedbackRequest(BaseModel):
    message_id: str
    feedback: Optional[int] = None
    context_feedback: Optional[Union[bool, str]] = None
    project_id: Optional[str] = None
    chat_id: Optional[str] = None

@chat_feedback_router.post("/feedback")
async def chat_feedback(
    data: FeedbackRequest,
    current_user=Depends(get_current_user)
):
    try:
        user_email = current_user["email"]
        user_id = get_user_perms_id(user_email)

        message_id = data.message_id
        context_feedback = data.context_feedback
        feedback_raw = data.feedback

        # Normalize frontend weird values
        if context_feedback in ["None", "", "null"]:
            context_feedback = None

        if isinstance(context_feedback, str):
            v = context_feedback.strip().lower()
            if v in ["true", "1", "yes", "up", "like"]:
                context_feedback = True
            elif v in ["false", "0", "no", "down", "dislike"]:
                context_feedback = False

        if context_feedback is None and feedback_raw is not None:
            if feedback_raw == 1:
                context_feedback = True
            elif feedback_raw == -1:
                context_feedback = False

        if not message_id:
            raise HTTPException(status_code=400, detail="message_id required")

        # Validate UUID format
        try:
            uuid.UUID(message_id)
        except ValueError:
            print(f"⚠️ Invalid UUID format received: {message_id}")
            # Instead of crashing, just return a friendly error or ignore
            raise HTTPException(status_code=400, detail="Invalid message_id format (must be UUID)")

        # Fetch message
        res = supabase.table("user_memorys") \
            .select("role, context_feedback, user_id") \
            .eq("id", message_id) \
            .execute()

        if not res.data:
            raise HTTPException(status_code=404, detail="Message not found")

        msg = res.data[0]

        # Ownership check
        if str(msg.get("user_id")) != str(user_id):
            raise HTTPException(status_code=403, detail="Unauthorized access to message")

        # Assistant only
        if msg.get("role") != "assistant":
            raise HTTPException(status_code=400, detail="Feedback only allowed on assistant messages")

        # Update feedback
        supabase.table("user_memorys") \
            .update({"context_feedback": context_feedback}) \
            .eq("id", message_id) \
            .execute()

        # Re-fetch
        after = supabase.table("user_memorys") \
            .select("id, context_feedback, role, user_id") \
            .eq("id", message_id) \
            .execute()

        after_row = after.data[0] if after.data else None

        try:
            get_user_preference_summary(user_id)
        except Exception:
            pass

        return {
            "message": "✅ Feedback stored successfully",
            "status": "success",
            "message_id": message_id,
            "context_feedback": after_row.get("context_feedback") if after_row else None
        }

    except HTTPException:
        # Re-raise known HTTP exceptions (403, 404, 400) without changing them
        raise
    except Exception as e:
        # Only catch unexpected errors as 500
        print(f"Error in chat_feedack: {e}")
        raise HTTPException(status_code=500, detail=str(e))

general_feedback_router = APIRouter(prefix="/api", tags=["General Feedback"])

class GeneralFeedbackRequest(BaseModel):
    rating: int
    comment: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}

#kirtan start
@general_feedback_router.post("/feedback", status_code=201)
async def submit_general_feedback(
    data: GeneralFeedbackRequest,
    current_user=Depends(get_current_user)
):
    try:
        metadata = data.metadata or {}

        user_email = current_user.get("email")

        if not metadata.get("user_email") and user_email:
            metadata["user_email"] = user_email
        elif not metadata.get("user_email"):
            metadata["user_email"] = "Guest"

        new_feedback = {
            "rating": data.rating,
            "comment": data.comment,
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        print(f"📥 [DEBUG] Storing general feedback: {new_feedback}")

        res = supabase.table("feedback").insert(new_feedback).execute()

        return {
            "success": True,
            "message": "Feedback submitted successfully",
            "data": res.data[0] if res.data else {}
        }

    except Exception as e:
        print(f"❌ Feedback submission failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
#kirtan end

#kirtan start
@general_feedback_router.get("/feedback/all")
async def get_all_feedback(
    current_user=Depends(get_current_user)
):
    try:
        # Optional: Restrict to admin only
        if current_user.get("role").lower() != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        res = (
            supabase
            .table("feedback")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )

        return {
            "success": True,
            "data": res.data if res.data else []
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#kirtan end

