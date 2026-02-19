from fastapi import APIRouter, Depends, Body, HTTPException
from security.api_key import verify_api_key_dependency
from core import supabase

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.post("/get_user_project")
def get_user_project(
    payload: dict = Body(...),
    _: None = Depends(verify_api_key_dependency),
):
    user_email = payload.get("email")

    if not user_email:
        return {
            "project_id": "default",
            "project_name": "Default Project",
            "message": "No email provided",
        }

    try:
        result = (
            supabase
            .table("projects")
            .select("id, project_name, project_description")
            .contains("assigned_to_emails", [user_email])
            .execute()
        )

        if result.data and len(result.data) > 0:
            project = result.data[0]
            return {
                "project_id": str(project["id"]),
                "project_name": project["project_name"],
                "project_description": project.get("project_description", ""),
            }

        return {
            "project_id": "default",
            "project_name": "Default Project",
            "message": "No assigned projects found",
        }

    except Exception:
        return {
            "project_id": "default",
            "project_name": "Default Project",
            "message": "Database error",
        }

@router.get("/debug_projects")
def debug_projects(
    _: None = Depends(verify_api_key_dependency),
):
    try:
        result = supabase.table("projects").select("*").execute()

        return {
            "total_projects": len(result.data) if result.data else 0,
            "projects": result.data or [],
            "message": "All projects retrieved"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )