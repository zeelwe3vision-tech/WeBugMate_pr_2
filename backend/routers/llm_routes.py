from fastapi import APIRouter,HTTPException, Depends, Query
from security.auth_utils import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core import get_user_llm_model,update_user_llm_model, get_user_role, get_active_llm, set_active_llm, get_user_id,supabase 

router = APIRouter(prefix="/api", tags=["LLM"])

@router.get("/user/llm")
async def get_user_llm(current_user=Depends(get_current_user)):
    user_email = current_user["email"]

    model = get_user_llm_model(user_email)

    return {
        "llm_model": model,
        "success": True
    }
class UpdateLLMRequest(BaseModel):
    llm_model: str
    target_email: Optional[str] = None

@router.put("/user/llm")
async def update_user_llm(
    data: UpdateLLMRequest,
    current_user=Depends(get_current_user)
):
    user_email = current_user["email"]
    user_role = get_user_role(user_email)

    if data.target_email and user_role != "Admin":
        raise HTTPException(status_code=403, detail="Admin only")

    success = update_user_llm_model(
        user_email,
        data.llm_model,
        data.target_email
)

    if not success:
        raise HTTPException(status_code=500, detail="Update failed")

    return {
        "success": True,
        "llm_model": data.llm_model
    }
@router.get("/admin/llms")
async def get_all_user_llms(current_user=Depends(get_current_user)):
    user_email = current_user["email"]

    role = get_user_role(user_email)

    print("LOGIN EMAIL:", user_email)
    print("ROLE FROM DB:", role)

    if role != "Admin":
        raise HTTPException(status_code=403, detail="Admin only")

    result = supabase.table("user_llm_settings").select("*").execute()

    return {
        "data": result.data,
        "success": True
    }

@router.get("/llm/active")
async def get_active_llm_route(
    email: str | None = Query(None),
    current_user=Depends(get_current_user)
):
    print("JWT PAYLOAD:", current_user)

    logged_in_email = current_user["email"]
    role = get_user_role(logged_in_email)

    print("DEBUG LOGIN EMAIL:", logged_in_email)
    print("DEBUG ROLE:", role)

    if email and email.strip() and email != logged_in_email:
        if role.lower() != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
        target_email = email
    else:
        target_email = logged_in_email

    user_id = get_user_id(target_email)

    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")

    settings = get_active_llm(user_id)

    return settings

class SelectLLMRequest(BaseModel):
    model: str
    email: Optional[str] = None
    user_id: Optional[str] = None
    provider: Optional[str] = None

@router.post("/llm/select")
async def select_llm_route(
    data: SelectLLMRequest,
    current_user=Depends(get_current_user)
):
    logged_in_email = current_user["email"]
    role = get_user_role(logged_in_email)

    # If email provided → only Admin allowed
    if data.email:
        if role.lower() != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
        target_email = data.email
    else:
        target_email = logged_in_email

    # Resolve user_id
    resolved_id = get_user_id(target_email)
    user_id = resolved_id if resolved_id else data.user_id

    if not user_id:
        raise HTTPException(
            status_code=404,
            detail="User ID not found via email; try passing explicit user_id"
        )

    success = set_active_llm(user_id, data.model, data.provider)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to save settings")

    return {
        "message": "✅ Model updated",
        "model": data.model
    }
@router.post("/llm/sync_users")
async def sync_users_route(current_user=Depends(get_current_user)):
    logged_in_email = current_user["email"]
    role = get_user_role(logged_in_email)

    if role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        # 1️⃣ Fetch all users from user_profiles
        res = supabase.table("user_profiles") \
            .select("user_id, email") \
            .execute()

        users = res.data or []

        synced_count = 0
        errors = []

        for u in users:
            uid = u.get("user_id")
            email = u.get("email")

            if not uid or not email:
                continue

            try:
                # 2️⃣ Check if settings exist
                exist = supabase.table("user_llm_settings") \
                    .select("user_id") \
                    .eq("user_id", uid) \
                    .execute()

                if exist.data:
                    continue

                # 3️⃣ Insert default settings
                default_settings = {
                    "user_id": uid,
                    "llm_model": "openai/gpt-4o-mini",
                    "provider": "openai",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }

                supabase.table("user_llm_settings") \
                    .insert(default_settings) \
                    .execute()

                synced_count += 1

            except Exception as e:
                errors.append(f"Failed to sync {email}: {str(e)}")

        return {
            "message": f"Synced {synced_count} new users.",
            "total_checked": len(users),
            "errors": errors
        }

    except Exception as grand_e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(grand_e)}")

