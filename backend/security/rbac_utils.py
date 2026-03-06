from fastapi import Request, HTTPException, Depends
from security.auth_utils import get_current_user
from core import supabase

def require_permission(page_name: str, required_action: str = 'View'):
    """
    FastAPI dependency to enforce strict RBAC.
    """
    async def permission_checker(
        request: Request,
        current_user: dict = Depends(get_current_user)
    ):
        email = current_user.get("email")
        role = current_user.get("role")
        
        # 1. Admin bypass
        if role == "Admin":
            return current_user
            
        # 2. Fetch User Permissions from Database securely
        try:
            response = supabase.table("user_logins").select("permission_roles").eq("email", email).limit(1).execute()
            
            if not response.data or 'permission_roles' not in response.data[0]:
                raise HTTPException(status_code=403, detail="Forbidden: No permissions assigned.")
                
            user_permissions = response.data[0]['permission_roles'] or {}
            
            # 3. Check requested page
            page_perms = user_permissions.get(page_name, {})
            if not page_perms:
                raise HTTPException(status_code=403, detail=f"Forbidden: Access to {page_name} denied.")
                
            # 4. Check specific action or "All"
            has_all_access = page_perms.get("All", False)
            has_action_access = page_perms.get(required_action, False)
            
            if not (has_all_access or has_action_access):
                raise HTTPException(
                    status_code=403, 
                    detail=f"Forbidden: You do not have {required_action} permission for {page_name}."
                )
                
            return current_user
        except Exception as e:
            raise HTTPException(status_code=403, detail=f"Permission check failed: {str(e)}")
            
    return permission_checker
