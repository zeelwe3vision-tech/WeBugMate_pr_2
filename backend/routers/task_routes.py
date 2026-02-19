# This file defines API routes for task assignments and manager dashboard
from fastapi import APIRouter,HTTPException,Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from core import supabase
from security.auth_utils import get_current_user

router = APIRouter(prefix="/api", tags=["Tasks"])

class AssignTaskRequest(BaseModel):
    user_ids: List[int]
    assigned_by_email: Optional[str] = None

@router.post("/task/{task_id}/assign", status_code=201)
async def assign_task(
    task_id: str,
    data: AssignTaskRequest,
    current_user=Depends(get_current_user)
):
    if not data.user_ids:
        raise HTTPException(status_code=400, detail="No users provided")

    try:
        assigned_by_id = None

        # 🔹 If frontend sends assigned_by_email
        if data.assigned_by_email:
            assigner = (
                supabase
                .table("user_perms")
                .select("id")
                .eq("email", data.assigned_by_email)
                .limit(1)
                .execute()
            )

            if assigner.data:
                assigned_by_id = assigner.data[0]["id"]

        assignments = []

        for uid in data.user_ids:
            assignments.append({
                "task_id": task_id,
                "user_id": int(uid),
                "assigned_by": assigned_by_id,
                "status": "pending",
                "assigned_at": datetime.now(timezone.utc).isoformat(),
                "is_active": True
            })

        supabase.table("task_assignments").insert(assignments).execute()

        return {
            "success": True,
            "count": len(assignments)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-tasks")
async def get_my_tasks(
    user_email: str = Query(None),
    current_user=Depends(get_current_user)
):
    if not user_email:
        return []

    try:
        # Resolve email to user_perms.id (int)
        user_res = (
            supabase
            .table("user_perms")
            .select("id")
            .eq("email", user_email)
            .execute()
        )

        if not user_res.data:
            return []

        my_user_id = user_res.data[0]["id"]

        # Fetch assignments for this user
        res = (
            supabase
            .table("task_assignments")
            .select("*, broadcast_tasks(*, project_broadcasts(title))")
            .eq("user_id", my_user_id)
            .execute()
        )

        return res.data or []

    except Exception:
        return []
        
class UpdateAssignmentStatusRequest(BaseModel):
    status: str

@router.patch("/task-assignment/{assignment_id}/status")
async def update_assignment_status(
    assignment_id: str,
    data: UpdateAssignmentStatusRequest,
    current_user=Depends(get_current_user)
):
    try:
        supabase.table("task_assignments") \
            .update({"status": data.status}) \
            .eq("id", assignment_id) \
            .execute()

        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/manager/dashboard")
async def get_manager_dashboard(
    current_user=Depends(get_current_user)
):
    try:
        total_broadcasts = (
            supabase
            .table("project_broadcasts")
            .select("id", count="exact")
            .execute()
            .count
        )

        total_tasks = (
            supabase
            .table("broadcast_tasks")
            .select("id", count="exact")
            .execute()
            .count
        )

        assignments = (
            supabase
            .table("task_assignments")
            .select("status")
            .execute()
        )

        status_counts = {}

        for a in (assignments.data or []):
            s = a.get("status", "unknown")
            status_counts[s] = status_counts.get(s, 0) + 1

        return {
            "total_broadcasts": total_broadcasts,
            "total_tasks": total_tasks,
            "total_assignments": len(assignments.data or []),
            "status_breakdown": status_counts
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
