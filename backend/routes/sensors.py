"""
Sensor ingestion routes — Supabase-backed, JWT-protected.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from backend.core.auth import get_current_user
from backend.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/sensors", tags=["Sensors"])


class SensorReading(BaseModel):
    device_id: str
    field_id: str
    soil_moisture: Optional[float] = None
    soil_temp: Optional[float] = None
    air_temp: Optional[float] = None
    humidity: Optional[float] = None
    leaf_wetness: Optional[float] = None
    rainfall: Optional[float] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


class SensorResponse(BaseModel):
    status: str
    reading_id: str


@router.post(
    "/ingest",
    response_model=SensorResponse,
    status_code=201,
    summary="Ingest a sensor reading from a field device",
)
def ingest(reading: SensorReading, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    # Verify the field belongs to this user
    field_res = supabase.table("fields").select("id").eq("id", reading.field_id).eq("user_id", user["id"]).maybe_single().execute()
    if not field_res.data:
        raise HTTPException(status_code=404, detail="Field not found or access denied")

    res = supabase.table("sensor_readings").insert({
        "field_id":     reading.field_id,
        "device_id":    reading.device_id,
        "soil_moisture": reading.soil_moisture,
        "soil_temp":    reading.soil_temp,
        "air_temp":     reading.air_temp,
        "humidity":     reading.humidity,
        "leaf_wetness": reading.leaf_wetness,
        "rainfall":     reading.rainfall,
        "lat":          reading.lat,
        "lon":          reading.lon,
        "recorded_at":  datetime.utcnow().isoformat(),
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to store sensor reading")

    return SensorResponse(status="ok", reading_id=res.data[0]["id"])


@router.get("/{field_id}/latest", summary="Latest sensor reading for a field")
def get_latest(field_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    # Check field ownership
    field_res = supabase.table("fields").select("id").eq("id", field_id).eq("user_id", user["id"]).maybe_single().execute()
    if not field_res.data:
        raise HTTPException(status_code=404, detail="Field not found")

    res = supabase.table("sensor_readings").select("*").eq("field_id", field_id).order("recorded_at", desc=True).limit(1).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="No sensor readings for this field")
    return res.data[0]


@router.get("/{field_id}/history", summary="Recent sensor readings (up to 100)")
def get_history(field_id: str, limit: int = 100, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    field_res = supabase.table("fields").select("id").eq("id", field_id).eq("user_id", user["id"]).maybe_single().execute()
    if not field_res.data:
        raise HTTPException(status_code=404, detail="Field not found")

    res = supabase.table("sensor_readings").select("*").eq("field_id", field_id).order("recorded_at", desc=True).limit(min(limit, 100)).execute()
    return res.data or []
