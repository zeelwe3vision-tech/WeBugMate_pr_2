import os
import jwt
import datetime
from functools import wraps
from pathlib import Path

# Load keys
KEY_DIR = os.path.join(os.path.dirname(__file__), '..', 'config', 'keys')
PRIVATE_KEY_PATH = os.getenv('PRIVATE_KEY_PATH', os.path.join(KEY_DIR, 'private.pem'))
PUBLIC_KEY_PATH = os.getenv('PUBLIC_KEY_PATH', os.path.join(KEY_DIR, 'public.pem'))

# Load keys
with open(PRIVATE_KEY_PATH, 'r') as f:
    PRIVATE_KEY = f.read()

with open(PUBLIC_KEY_PATH, 'r') as f:
    PUBLIC_KEY = f.read()

# JWT configuration
JWT_ALGORITHM = 'RS256'
JWT_ISSUER = os.getenv('JWT_ISSUER', 'your-company')
JWT_AUDIENCE = os.getenv('JWT_AUDIENCE', 'your-audience')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '15'))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv('REFRESH_TOKEN_EXPIRE_DAYS', '7'))

def create_access_token(user: dict):
    now = datetime.datetime.utcnow()

    payload = {
        'sub': str(user["id"]),
        'email': user["email"],
        'role': user["role"],
        'iat': now,
        'exp': now + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        'iss': JWT_ISSUER,
        'aud': JWT_AUDIENCE,
        'type': 'access'
    }

    return jwt.encode(payload, PRIVATE_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id):
    """Create a new refresh token"""
    now = datetime.datetime.utcnow()
    payload = {
        'sub': str(user_id),
        'iat': now,
        'exp': now + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        'iss': JWT_ISSUER,
        'aud': JWT_AUDIENCE,
        'type': 'refresh'
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm=JWT_ALGORITHM)

def verify_token(token):
    """Verify a JWT token and return the payload if valid"""
    try:
        payload = jwt.decode(
            token,
            PUBLIC_KEY,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE
        )
        return payload
    except jwt.ExpiredSignatureError:
        return {'error': 'Token expired'}
    except jwt.InvalidTokenError as e:
        return {'error': f'Invalid token: {str(e)}'}


# fastapi start
from fastapi import Request, HTTPException
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()
def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    # 🔹 Bypass for development/migration
    if token == "webugmate123":
        # Try to find email in headers or query params (checks user_email AND email)
        email = (
            request.headers.get("user_email") 
            or request.query_params.get("user_email")
            or request.headers.get("email")
            or request.query_params.get("email")
        )
        
        # Fallback to a default if not found
        if not email:
            email = "dev_user@example.com"

        return {
            "sub": "dev_user_id",
            "email": email,
            "role": "admin", # Assume admin for dev
            "type": "bypass"
        }

    payload = verify_token(token)

    if "error" in payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    return payload

# fastapi over