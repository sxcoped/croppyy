"""
Fields routes — Supabase-backed, JWT-protected.
All operations are scoped to the authenticated user via RLS.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Any
from backend.core.auth import get_current_user
from backend.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/fields", tags=["Fields"])


class FieldCreate(BaseModel):
    name: str
    lat: float
    lon: float
    buffer_m: int = 1000
    crop_type: str
    sowing_date: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    irrigation_type: Optional[str] = "rainfed"
    polygon: Optional[List[List[float]]] = None   # [[lat, lon], ...] vertices
    area_ha: Optional[float] = None


class FieldResponse(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    buffer_m: Optional[int] = 1000
    crop_type: str
    sowing_date: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    irrigation_type: Optional[str] = "rainfed"
    polygon: Optional[Any] = None
    area_ha: Optional[float] = None
    created_at: Optional[str] = None


@router.post("", response_model=FieldResponse, status_code=201, summary="Register a new field")
def create_field(body: FieldCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    payload = {
        "user_id":          user["id"],
        "name":             body.name,
        "lat":              body.lat,
        "lon":              body.lon,
        "buffer_m":         body.buffer_m,
        "crop_type":        body.crop_type,
        "sowing_date":      body.sowing_date or None,   # empty string → NULL
        "state":            body.state or None,
        "district":         body.district or None,
        "irrigation_type":  body.irrigation_type or "rainfed",
        "polygon":          body.polygon,
        "area_ha":          body.area_ha,
    }

    try:
        res = supabase.table("fields").insert(payload).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    if not res.data:
        raise HTTPException(status_code=500, detail="Insert returned no data — check DB logs")

    try:
        return FieldResponse(**res.data[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Response parsing error: {e}")


@router.get("", response_model=List[FieldResponse], summary="List all registered fields")
def list_fields(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("fields").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return [FieldResponse(**f) for f in (res.data or [])]


@router.get("/{field_id}", response_model=FieldResponse, summary="Get field details")
def get_field(field_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("fields").select("*").eq("id", field_id).eq("user_id", user["id"]).maybe_single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Field not found")
    return FieldResponse(**res.data)


@router.put("/{field_id}", response_model=FieldResponse, summary="Update a field")
def update_field(field_id: str, body: FieldCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    existing = supabase.table("fields").select("id").eq("id", field_id).eq("user_id", user["id"]).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Field not found")

    payload = {
        "name":             body.name,
        "lat":              body.lat,
        "lon":              body.lon,
        "buffer_m":         body.buffer_m,
        "crop_type":        body.crop_type,
        "sowing_date":      body.sowing_date,
        "state":            body.state,
        "district":         body.district,
        "irrigation_type":  body.irrigation_type,
        "polygon":          body.polygon,
        "area_ha":          body.area_ha,
    }
    res = supabase.table("fields").update(payload).eq("id", field_id).eq("user_id", user["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Field not found")
    return FieldResponse(**res.data[0])


@router.delete("/{field_id}", status_code=204, summary="Delete a field")
def delete_field(field_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("fields").delete().eq("id", field_id).eq("user_id", user["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Field not found")
