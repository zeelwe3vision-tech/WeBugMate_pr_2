# This file defines API routes for task assignments and manager dashboard
# Tanmey and Kirtan Start
import re
# Tanmey and Kirtan Stop
from fastapi import APIRouter,HTTPException,Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from core import supabase
from security.auth_utils import get_current_user
from security.rbac_utils import require_permission

router = APIRouter(prefix="/api", tags=["Tasks"])

class AssignTaskRequest(BaseModel):
    user_ids: List[int]
    assigned_by_email: Optional[str] = None

@router.post("/task/{task_id}/assign", status_code=201)
async def assign_task(
    task_id: str,
    data: AssignTaskRequest,
    current_user=Depends(require_permission("Communication", "Insert"))
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
    current_user=Depends(require_permission("Dashboard", "View"))
):
    if not user_email:
        return []

    try:
        # STEP 1 — get user id
        user_res = (
            supabase
            .table("user_perms")
            .select("id")
            .eq("email", user_email)
            .execute()
        )

        if not user_res.data:
            return []

        user_id = user_res.data[0]["id"]

        # STEP 2 — get task assignments
        assignments = (
            supabase
            .table("task_assignments")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )

        if not assignments.data:
            return []

        tasks = []
        # STEP 3 — fetch task details
        for a in assignments.data:
            # Fetch task info
            task_res = (
                supabase
                .table("broadcast_tasks")
                .select("*")
                .eq("id", a["task_id"])
                .execute()
            )
            
            task_data = task_res.data[0] if task_res.data else None
            broadcast_title = "N/A"

            if task_data:
                # Fetch broadcast info
                broadcast_res = (
                    supabase
                    .table("project_broadcasts")
                    .select("title")
                    .eq("id", task_data["broadcast_id"])
                    .execute()
                )
                if broadcast_res.data:
                    broadcast_title = broadcast_res.data[0].get("title", "N/A")

            desc = task_data["description"] or "" if task_data else ""
            
            # Start with project_id from task_data (if it exists as a column)
            extracted_project_id = task_data.get("project_id") if task_data else None
            
            if desc:
                # Also try matching in description for backward compatibility
                match = re.search(r"\[Project:([a-f0-9-]+)\]", desc)
                if match:
                    if not extracted_project_id:
                        extracted_project_id = match.group(1)
                    # Always clean the description
                    desc = re.sub(r'\[Project:[^\]]+\]', '', desc).strip()

            tasks.append({
                "assignment_id": a["id"],
                "status": a["status"],
                "assigned_at": a["assigned_at"],
                "task_title": task_data["title"] if task_data else "Unnamed Task",
                "description": desc,
                "project_id": extracted_project_id,
                "priority": task_data["priority"] if task_data else "low",
                "deadline": task_data["deadline"] if task_data else None,
                "broadcast_title": broadcast_title
            })
# Tanmey and Kirtan Stop

        return tasks

    except Exception as e:
        print("MY TASK ERROR:", e)
        return []
        
class UpdateAssignmentStatusRequest(BaseModel):
    status: str

@router.patch("/task-assignment/{assignment_id}/status")
async def update_assignment_status(
    assignment_id: str,
    data: UpdateAssignmentStatusRequest,
    current_user=Depends(require_permission("Dashboard", "Update")) 
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
    current_user=Depends(require_permission("Dashboard", "View"))
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
