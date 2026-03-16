"""
Auth routes — delegates fully to Supabase Auth.
Register, Login, Refresh, Logout, Profile update.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from backend.core.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from backend.core.supabase_client import get_supabase
from backend.core.auth import get_current_user
from supabase import create_client
import httpx

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "farmer"       # farmer / agronomist / admin
    language: str = "en"
    phone: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None


@router.post("/register", status_code=201, summary="Register a new user")
def register(req: RegisterRequest):
    supabase = get_supabase()
    try:
        # Sign up with Supabase Auth — passes metadata to trigger
        res = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
            "options": {
                "data": {
                    "name": req.name,
                    "role": req.role,
                }
            }
        })
        user = res.user
        if not user:
            raise HTTPException(status_code=400, detail="Registration failed — check email/password")

        # Update profile with extra fields
        supabase.table("profiles").update({
            "name":     req.name,
            "role":     req.role,
            "language": req.language,
            "phone":    req.phone,
            "state":    req.state,
            "district": req.district,
        }).eq("id", user.id).execute()

        return {
            "user_id": user.id,
            "email":   user.email,
            "message": "Registration successful — check your email to confirm your account",
            "session": {
                "access_token":  res.session.access_token  if res.session else None,
                "refresh_token": res.session.refresh_token if res.session else None,
                "expires_in":    res.session.expires_in    if res.session else None,
            } if res.session else None,
        }
    except Exception as e:
        err = str(e)
        if "already registered" in err.lower() or "already been registered" in err.lower():
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(status_code=400, detail=err)


@router.post("/login", summary="Log in and receive JWT tokens")
def login(req: LoginRequest):
    supabase = get_supabase()
    try:
        res = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password,
        })
        user    = res.user
        session = res.session

        if not user or not session:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Get profile
        profile_res = supabase.table("profiles").select("*").eq("id", user.id).maybe_single().execute()
        profile = profile_res.data or {}

        return {
            "user": {
                "id":       user.id,
                "email":    user.email,
                "name":     profile.get("name", ""),
                "role":     profile.get("role", "farmer"),
                "language": profile.get("language", "en"),
            },
            "session": {
                "access_token":  session.access_token,
                "refresh_token": session.refresh_token,
                "expires_in":    session.expires_in,
                "token_type":    "bearer",
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")


@router.post("/refresh", summary="Refresh access token")
def refresh(refresh_token: str):
    supabase = get_supabase()
    try:
        res = supabase.auth.refresh_session(refresh_token)
        session = res.session
        if not session:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        return {
            "access_token":  session.access_token,
            "refresh_token": session.refresh_token,
            "expires_in":    session.expires_in,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token refresh failed: {e}")


@router.get("/me", summary="Get current user profile")
def me(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    profile_res = supabase.table("profiles").select("*").eq("id", user["id"]).maybe_single().execute()
    profile = profile_res.data or {}
    return {
        "id":       user["id"],
        "email":    user["email"],
        "name":     profile.get("name", user.get("name", "")),
        "role":     profile.get("role", user.get("role", "farmer")),
        "language": profile.get("language", "en"),
        "phone":    profile.get("phone"),
        "state":    profile.get("state"),
        "district": profile.get("district"),
    }


@router.put("/profile", summary="Update user profile")
def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = supabase.table("profiles").update(update_data).eq("id", user["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Profile update failed")
    return {"message": "Profile updated", "profile": res.data[0]}


@router.post("/logout", summary="Sign out (invalidate session server-side)")
def logout(user: dict = Depends(get_current_user)):
    # Supabase handles token invalidation client-side; server can't invalidate JWTs without a blocklist
    return {"message": "Logged out successfully — discard your tokens"}


class ConfirmEmailRequest(BaseModel):
    email: str


@router.post("/dev-confirm-email", summary="Force-confirm a user's email via admin API (dev only)")
async def dev_confirm_email(req: ConfirmEmailRequest):
    """
    Workaround for localhost dev: confirms email without clicking the link.
    Remove this endpoint before going to production.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json",
    }
    base = SUPABASE_URL.rstrip("/")

    async with httpx.AsyncClient() as client:
        # 1. Find the user by email
        resp = await client.get(
            f"{base}/auth/v1/admin/users",
            headers=headers,
            params={"page": 1, "per_page": 1000},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to list users from Supabase")

        users = resp.json().get("users", [])
        user = next((u for u in users if u.get("email") == req.email), None)
        if not user:
            raise HTTPException(status_code=404, detail="No account found with that email")

        # 2. Force-confirm the email
        patch = await client.put(
            f"{base}/auth/v1/admin/users/{user['id']}",
            headers=headers,
            json={"email_confirm": True},
        )
        if patch.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Confirmation failed: {patch.text}")

    return {"message": f"Email confirmed for {req.email}. You can now sign in."}
