# routers/user_routes.py

from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel
from core import get_user_llm_model, update_user_llm_model, get_user_role, supabase
from security.auth_utils import get_current_user
from security.api_key import verify_api_key_dependency


router = APIRouter(prefix="/api", tags=["Users"])


# -------- Get User LLM --------
@router.get("/user/llm")
def get_user_llm(current_user=Depends(get_current_user)):
    email = current_user.get("email")

    model = get_user_llm_model(email)

    return {
        "llm_model": model,
        "success": True
    }


# -------- Update User LLM --------
class UpdateLLMRequest(BaseModel):
    llm_model: str
    target_email: str | None = None


@router.put("/user/llm")
def update_user_llm(
    data: UpdateLLMRequest,
    current_user=Depends(get_current_user)
):
    email = current_user.get("email")

    if not data.llm_model:
        raise HTTPException(status_code=400, detail="llm_model required")

    user_role = get_user_role(email)

    # Only Admin can update others
    if data.target_email and user_role != "Admin":
        raise HTTPException(status_code=403, detail="Admin only")

    success = update_user_llm_model(
        email,
        data.llm_model,
        data.target_email
    )

    if success:
        return {
            "success": True,
            "llm_model": data.llm_model
        }

    raise HTTPException(status_code=500, detail="Update failed")


# -------- Users List --------
@router.get("/users-list")
def get_users_list_route(
    _: None = Depends(verify_api_key_dependency)
):
    try:
        res = (
            supabase
            .table("user_perms")
            .select("id, email, role, name")
            .execute()
        )

        return [
            {
                "user_id": u["id"],
                "email": u["email"],
                "role": u["role"],
                "name": u["name"]
            }
            for u in (res.data or [])
        ]

    except Exception:
        return []

@router.post("/get_user_uuid")
def get_user_uuid(
    payload: dict = Body(...),
    _: None = Depends(verify_api_key_dependency),
):
    """
    Fetch auth user UUID by email (admin/service role)
    """
    try:
        email = payload.get("email")

        if not email:
            raise HTTPException(
                status_code=400,
                detail="Email required"
            )

        res = (
            supabase
            .table("user_perms")
            .select("id")
            .eq("email", email)
            .execute()
        )

        if res.data and len(res.data) > 0:
            return {"uuid": str(res.data[0]["id"])}

        raise HTTPException(
            status_code=404,
            detail="User UUID not found in user_perms"
        )

    except HTTPException:
        raise

    except Exception as e:
        print(f"Error fetching user UUID: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


