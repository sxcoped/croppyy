"""
JWT authentication middleware — verifies tokens via Supabase Auth.
Every protected endpoint uses `Depends(get_current_user)`.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.core.supabase_client import get_supabase

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency — validates the Bearer token by calling Supabase Auth
    and returns the user payload.
    Attach to any route: `user: dict = Depends(get_current_user)`
    """
    token = credentials.credentials
    supabase = get_supabase()

    try:
        # Supabase verifies the token server-side; no local JWT secret needed
        resp = supabase.auth.get_user(token)
        auth_user = resp.user
        if not auth_user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")

    user_id = auth_user.id

    # Enrich with profile data
    try:
        res = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
        profile = res.data or {}
    except Exception:
        profile = {}

    return {
        "id":       user_id,
        "email":    auth_user.email or "",
        "role":     profile.get("role", "farmer"),
        "name":     profile.get("name", ""),
        "language": profile.get("language", "en"),
    }


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
) -> dict | None:
    """Same as get_current_user but doesn't fail if no token provided."""
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
