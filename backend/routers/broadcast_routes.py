from fastapi import APIRouter, Depends, HTTPException
from core import supabase
from security.auth_utils import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api", tags=["Project Broadcasts"])

@router.get("/project-broadcast")
async def get_project_broadcasts(
    current_user=Depends(get_current_user)
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
    current_user=Depends(get_current_user)
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

@router.post("/project-broadcast/{broadcast_id}/task", status_code=201)
async def create_broadcast_task(
    broadcast_id: str,
    data: CreateBroadcastTaskRequest,
    current_user=Depends(get_current_user)
):
    try:
        desc = data.description or ""

        # 🔹 Embed project reference if provided
        if data.project_id:
            proj_tag = f"[Project:{data.project_id}]"
            if proj_tag not in desc:
                desc = f"{proj_tag} {desc}".strip()

        new_task = {
            "broadcast_id": broadcast_id,
            "title": data.title,
            "description": desc,
            "priority": data.priority,
            "deadline": data.deadline,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        res = (
            supabase
            .table("broadcast_tasks")
            .insert(new_task)
            .execute()
        )

        return res.data[0] if res.data else {}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/project-broadcast/{broadcast_id}/tasks")
async def get_broadcast_tasks(
    broadcast_id: str,
    current_user=Depends(get_current_user)
):
    try:
        res = (
            supabase
            .table("broadcast_tasks")
            .select("*")
            .eq("broadcast_id", broadcast_id)
            .execute()
        )

        return res.data or []

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
