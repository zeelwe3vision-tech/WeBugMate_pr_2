from fastapi import APIRouter, Depends, HTTPException
# Tanmey and Kirtan Start
from fastapi.responses import JSONResponse
# Tanmey and Kirtan Stop
from core import supabase
from security.auth_utils import get_current_user
from security.rbac_utils import require_permission
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api", tags=["Project Broadcasts"])

@router.get("/project-broadcast")
async def get_project_broadcasts(
    current_user=Depends(require_permission("Communication", "View"))
):
    try:
        res = (
            supabase
            .table("project_broadcasts")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )

        return res.data or []

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateBroadcastRequest(BaseModel):
    title: str
    description: Optional[str] = None
    type: Optional[str] = "general"
    organization_id: Optional[str] = None

@router.post("/project-broadcast", status_code=201)
async def create_project_broadcast(
    data: CreateBroadcastRequest,
    current_user=Depends(require_permission("Communication", "Insert"))
):
    try:
        org_id = data.organization_id

        # 🔹 Fallback organization logic
        if not org_id:
            try:
                org_res = (
                    supabase
                    .table("organizations")
                    .select("id")
                    .limit(1)
                    .execute()
                )

                if org_res.data:
                    org_id = org_res.data[0]["id"]
                else:
                    new_org = {
                        "name": "Default Organization",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }

                    org_create = (
                        supabase
                        .table("organizations")
                        .insert(new_org)
                        .execute()
                    )

                    if org_create.data:
                        org_id = org_create.data[0]["id"]

            except Exception as e_org:
                print("Organization fallback error:", e_org)

        new_broadcast = {
            "title": data.title,
            "description": data.description,
            "type": data.type,
            "organization_id": org_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "broadcast_code": f"BRD-{uuid.uuid4().hex[:8].upper()}"
        }

        res = (
            supabase
            .table("project_broadcasts")
            .insert(new_broadcast)
            .execute()
        )

        return res.data[0] if res.data else {}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateBroadcastTaskRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: Optional[str] = "medium"
    deadline: Optional[str] = None
    project_id: Optional[str] = None

# Tanmey and Kirtan Start
@router.post("/project-broadcast/{broadcast_id}/task", status_code=201)
async def create_broadcast_task(
    broadcast_id: str,
    data: CreateBroadcastTaskRequest,
    current_user=Depends(require_permission("Communication", "Insert"))
):
    try:
        desc = data.description or ""
        
        # If we have a project_id but no column, we prefix the description as a hidden metadata link
        if data.project_id:
            desc = f"[Project:{data.project_id}] {desc}".strip()

        new_task = {
            "broadcast_id": broadcast_id,
            "title": data.title,
            "description": desc,
            "priority": data.priority,
            "deadline": data.deadline,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # We try to use project_id column if it exists
        try:
            # First attempt with project_id
            temp_task = new_task.copy()
            if data.project_id:
                temp_task["project_id"] = data.project_id
            res = supabase.table("broadcast_tasks").insert(temp_task).execute()
        except Exception:
            # Fallback: Just save without the column (link is preserved in the description prefix)
            res = supabase.table("broadcast_tasks").insert(new_task).execute()

        return res.data[0] if res.data else {}

    except Exception as e:
        error_msg = str(e)
        print("TASK CREATION ERROR:", error_msg)
        with open("error_log.txt", "a") as f:
            f.write(f"{datetime.now()}: {error_msg}\n")
        return JSONResponse(status_code=500, content={"error": error_msg})
# Tanmey and Kirtan Stop

@router.get("/project-broadcast/{broadcast_id}/tasks")
async def get_broadcast_tasks(
    broadcast_id: str,
    current_user=Depends(require_permission("Communication", "View"))
):
    try:
        res = (
            supabase
            .table("broadcast_tasks")
            .select("*")
            .eq("broadcast_id", broadcast_id)
            .execute()
        )

# Tanmey and Kirtan Start
        tasks = res.data or []
        import re
        for task in tasks:
            d = task.get("description") or ""
            # 1. Extract project_id if present in tag format
            match = re.search(r"\[Project:([a-f0-9-]+)\]", d)
            if match:
                task["project_id"] = match.group(1)
            
            # 2. Clean the description for clean UI display
            task["description"] = re.sub(r"\[Project:[^\]]+\]", "", d).strip()
            
        return tasks
# Tanmey and Kirtan Stop

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
