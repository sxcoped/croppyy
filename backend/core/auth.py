"""
JWT authentication middleware — verifies Supabase JWT tokens.
Every protected endpoint uses `Depends(get_current_user)`.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt                     # PyJWT
from jwt import PyJWTError
from backend.core.config import SUPABASE_JWT_SECRET
from backend.core.supabase_client import get_supabase

bearer_scheme = HTTPBearer(auto_error=True)


def _decode_token(token: str) -> dict:
    """Decode and verify a Supabase-issued JWT."""
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth not configured — set SUPABASE_JWT_SECRET in .env",
        )
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},   # Supabase sets aud=authenticated
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired — please log in again")
    except PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency — validates JWT and returns the user payload.
    Attach to any route: `user: dict = Depends(get_current_user)`
    Returns payload with at least: sub (user_id), email, role
    """
    payload = _decode_token(credentials.credentials)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")

    # Optionally enrich with profile data from DB
    try:
        supabase = get_supabase()
        res = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
        profile = res.data or {}
    except Exception:
        profile = {}

    return {
        "id":       user_id,
        "email":    payload.get("email", ""),
        "role":     profile.get("role", payload.get("role", "farmer")),
        "name":     profile.get("name", ""),
        "language": profile.get("language", "en"),
    }


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
) -> dict | None:
    """Same as get_current_user but doesn't fail if no token provided (for public endpoints)."""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_role(*roles: str):
    """Dependency factory — restricts endpoint to specific roles."""
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied — requires role: {', '.join(roles)}",
            )
        return user
    return checker
