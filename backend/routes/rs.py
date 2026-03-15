"""
Remote Sensing routes — JWT-protected.
Computes all vegetation/soil indices from Sentinel-2 via GEE.
Results optionally saved to Supabase index_readings table.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from backend.models.schemas import (
    IndicesRequest, IndicesResponse,
    TimeseriesResponse, TimeseriesPoint,
)
from backend.services import gee_service
from backend.core.auth import get_current_user
from backend.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/rs", tags=["Remote Sensing"])


@router.post("/indices", response_model=IndicesResponse, summary="Compute all 8 vegetation & soil indices")
def get_indices(
    req: IndicesRequest,
    field_id: Optional[str] = Query(None, description="If provided, results are saved to DB"),
    user: dict = Depends(get_current_user),
):
    """
    Computes NDVI, EVI, SAVI, NDWI, NDRE, MSAVI, BSI, NDMI
    from Sentinel-2 SR imagery for the given location and date range.
    """
    try:
        result = gee_service.compute_indices(
            lat=req.lat, lon=req.lon, start=req.start, end=req.end,
            buffer_m=req.buffer_m, cloud_pct=req.cloud_pct,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GEE error: {str(e)}")

    if result["image_count"] == 0:
        raise HTTPException(
            status_code=404,
            detail="No Sentinel-2 images found for this location/date range.",
        )

    # Save to DB if field_id provided
    if field_id:
        try:
            supabase = get_supabase()
            indices = result["indices"]
            supabase.table("index_readings").insert({
                "field_id":    field_id,
                "source":      "sentinel2",
                "image_count": result["image_count"],
                "ndvi":  indices.get("NDVI",  {}).get("value"),
                "evi":   indices.get("EVI",   {}).get("value"),
                "savi":  indices.get("SAVI",  {}).get("value"),
                "ndwi":  indices.get("NDWI",  {}).get("value"),
                "ndre":  indices.get("NDRE",  {}).get("value"),
                "msavi": indices.get("MSAVI", {}).get("value"),
                "bsi":   indices.get("BSI",   {}).get("value"),
                "ndmi":  indices.get("NDMI",  {}).get("value"),
            }).execute()
        except Exception:
            pass   # Don't fail the main request if DB save fails

    return IndicesResponse(
        lat=req.lat, lon=req.lon, start=req.start, end=req.end,
        image_count=result["image_count"], indices=result["indices"],
    )


@router.post("/ndvi", summary="Quick NDVI only (backward-compatible)")
def get_ndvi(req: IndicesRequest, user: dict = Depends(get_current_user)):
    try:
        result = gee_service.compute_indices(
            lat=req.lat, lon=req.lon, start=req.start, end=req.end,
            buffer_m=req.buffer_m, cloud_pct=req.cloud_pct,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    ndvi_data = result["indices"].get("NDVI", {})
    return {
        "mean_ndvi":   ndvi_data.get("value"),
        "health_zone": ndvi_data.get("health_zone"),
        "image_count": result["image_count"],
    }


@router.post("/timeseries", response_model=TimeseriesResponse, summary="NDVI/EVI/NDWI/NDRE time series")
def get_timeseries(req: IndicesRequest, user: dict = Depends(get_current_user)):
    """
    Returns a time series of key indices across the date range.
    Each point = one Sentinel-2 acquisition (~5-day revisit).
    """
    try:
        points = gee_service.compute_timeseries(
            lat=req.lat, lon=req.lon, start=req.start, end=req.end,
            buffer_m=req.buffer_m,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GEE error: {str(e)}")

    return TimeseriesResponse(
        lat=req.lat, lon=req.lon,
        points=[TimeseriesPoint(**p) for p in points],
    )


@router.post("/soil-moisture", summary="Soil moisture from NASA SMAP via GEE")
def get_soil_moisture(req: IndicesRequest, user: dict = Depends(get_current_user)):
    """Returns surface and sub-surface soil moisture (NASA SMAP, 10 km resolution)."""
    try:
        result = gee_service.compute_soil_moisture(
            lat=req.lat, lon=req.lon, start=req.start, end=req.end,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GEE error: {str(e)}")
    return result


@router.get("/history/{field_id}", summary="Historical index readings from DB")
def get_field_history(field_id: str, limit: int = 30, user: dict = Depends(get_current_user)):
    """Retrieve stored Sentinel-2 index readings for a field from the database."""
    supabase = get_supabase()
    # Verify field access
    field_res = supabase.table("fields").select("id").eq("id", field_id).eq("user_id", user["id"]).maybe_single().execute()
    if not field_res.data:
        raise HTTPException(status_code=404, detail="Field not found")

    res = supabase.table("index_readings").select("*").eq("field_id", field_id).order("recorded_at", desc=True).limit(limit).execute()
    return res.data or []
