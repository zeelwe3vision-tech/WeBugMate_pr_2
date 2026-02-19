# fastapi newfile
from fastapi import APIRouter, Response, HTTPException, Request
from pydantic import BaseModel
from fastapi import Depends
from .models.user import User
from .auth_utils import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    verify_token
)
from core import get_user_role

router = APIRouter(prefix="/auth", tags=["Auth"])


# -------- Request Schema --------
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str | None = ""


# -------- Register Route --------
@router.post("/register")
def register(data: RegisterRequest):

    user = User.create(
        email=data.email,
        password=data.password,
        name=data.name
    )

    access_token = create_access_token({
        "id": user.id,
        "email": user.email,
        "role": "user"
    })

    refresh_token = create_refresh_token(user.id)

    return {
        "message": "User registered successfully",
        "access_token": access_token,
        "refresh_token": refresh_token
    }



class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(data: LoginRequest, response: Response):

    user = User.get_by_email(data.email)

    if not user or not user.check_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 🔥 FIX: get role from DB
    role = get_user_role(user.email)

    access_token = create_access_token({
        "id": user.id,
        "email": user.email,
        "role": role
    })

    refresh_token = create_refresh_token(user.id)

    response.set_cookie(
        key="token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=15 * 60
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": str(user.id),
            "email": user.email
        }
    }


@router.get("/me")
def get_me(user=Depends(get_current_user)):
    return {
    "message": "You are authenticated",
    "user_id": user["sub"],
    "email": user.get("email")
}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("token")
    response.delete_cookie("refresh_token")

    return {
        "message": "Successfully logged out"
    }



@router.post("/refresh")
def refresh(request: Request):

    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=400, detail="Refresh token required")

    payload = verify_token(refresh_token)

    if "error" in payload:
        raise HTTPException(status_code=401, detail=payload["error"])

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    new_access_token = create_access_token(payload["sub"])

    return {
        "access_token": new_access_token,
        "token_type": "Bearer",
        "expires_in": 15 * 60
    }
