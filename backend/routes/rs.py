"""
Remote Sensing routes — JWT-protected.
Computes all vegetation/soil indices from Sentinel-2 via GEE.
Results optionally saved to Supabase index_readings table.
Also provides CHIRPS rainfall, MODIS LST, and NASADEM elevation endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from backend.models.schemas import (
    IndicesRequest, IndicesResponse,
    TimeseriesResponse, TimeseriesPoint,
)
from backend.services import gee_service
from backend.services.auto_alerts import generate_index_alerts
from backend.core.auth import get_current_user
from backend.core.supabase_client import get_supabase


class GeoRequest(BaseModel):
    lat: float
    lon: float
    start: str
    end: str
    buffer_m: int = 1000
    polygon: Optional[List[List[float]]] = None   # [[lat, lon], ...] — overrides buffer when provided


class TopographyRequest(BaseModel):
    lat: float
    lon: float
    buffer_m: int = 1000
    polygon: Optional[List[List[float]]] = None

router = APIRouter(prefix="/api/rs", tags=["Remote Sensing"])


@router.post("/indices", response_model=IndicesResponse, summary="Compute all 8 vegetation & soil indices")
def get_indices(
    req: IndicesRequest,
    field_id: Optional[str] = Query(None, description="If provided, results are saved to DB"),
    _user: dict = Depends(get_current_user),
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

    # Save to DB and auto-generate alerts if field_id provided
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

        try:
            # Resolve field metadata for alert messages
            supabase = get_supabase()
            field_row = (supabase.table("fields")
                         .select("name, crop_type, user_id")
                         .eq("id", field_id)
                         .maybe_single()
                         .execute())
            if field_row.data:
                generate_index_alerts(
                    field_id  = field_id,
                    user_id   = field_row.data["user_id"],
                    field_name= field_row.data.get("name", "Field"),
                    crop_type = field_row.data.get("crop_type", "crop"),
                    indices   = result["indices"],
                )
        except Exception:
            pass   # Never fail the main response over alert generation

    return IndicesResponse(
        lat=req.lat, lon=req.lon, start=req.start, end=req.end,
        image_count=result["image_count"], indices=result["indices"],
    )


@router.post("/ndvi", summary="Quick NDVI only (backward-compatible)")
def get_ndvi(req: IndicesRequest, _user: dict = Depends(get_current_user)):
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
def get_timeseries(req: IndicesRequest, _user: dict = Depends(get_current_user)):
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
def get_soil_moisture(req: IndicesRequest, _user: dict = Depends(get_current_user)):
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


@router.post("/rainfall", summary="Daily rainfall from CHIRPS v2.0 (free, global, 5 km)")
def get_rainfall(req: GeoRequest, _user: dict = Depends(get_current_user)):
    """
    Returns daily precipitation (mm) for the given AOI and date range using
    CHIRPS v2.0 (Climate Hazards Group). Includes period total and daily average.
    Use the `polygon` field to restrict the AOI to the actual field boundary.
    """
    try:
        result = gee_service.get_chirps_rainfall(
            lat=req.lat, lon=req.lon, start=req.start, end=req.end,
            polygon=req.polygon,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GEE error: {str(e)}")
    return result


@router.post("/land-surface-temp", summary="MODIS land surface temperature + CWSI proxy (1 km, daily)")
def get_lst(req: GeoRequest, _user: dict = Depends(get_current_user)):
    """
    Returns daytime land surface temperature (°C) from MODIS Terra MOD11A1
    and a simple Crop Water Stress Index (CWSI) proxy.
    CWSI 0 = no heat stress, 1 = severe heat stress.
    """
    try:
        result = gee_service.get_land_surface_temp(
            lat=req.lat, lon=req.lon, start=req.start, end=req.end,
            polygon=req.polygon,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GEE error: {str(e)}")
    return result


@router.post("/topography", summary="Elevation, slope, and drainage risk from NASADEM (30 m)")
def get_topography(req: TopographyRequest, _user: dict = Depends(get_current_user)):
    """
    Returns mean elevation (m), slope (°), aspect (°), slope class, and
    drainage risk classification from NASADEM (NASA DEM, 30 m resolution).
    """
    try:
        result = gee_service.get_elevation(
            lat=req.lat, lon=req.lon, polygon=req.polygon,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GEE error: {str(e)}")
    return result


@router.post("/zone-map", summary="Spatial NDVI zone map — stress hotspot detection (50 m grid)")
def get_zone_map(req: GeoRequest, _user: dict = Depends(get_current_user)):
    """
    Divides the field into a 50 m grid and returns per-cell NDVI as a
    GeoJSON FeatureCollection. Cells where NDVI < (field_mean − 0.15)
    are flagged as stress hotspots. Useful for precision spot-treatment.
    """
    try:
        result = gee_service.get_zone_map(
            lat=req.lat, lon=req.lon, start=req.start, end=req.end,
            polygon=req.polygon, buffer_m=req.buffer_m,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GEE error: {str(e)}")
    return result


class IndexThumbnailRequest(BaseModel):
    lat: float
    lon: float
    start: str
    end: str
    index: str = "NDVI"
    buffer_m: int = 500
    polygon: Optional[List[List[float]]] = None


@router.post("/index-thumbnail", summary="False-colour spectral index thumbnail from Sentinel-2")
def get_index_thumbnail(req: IndexThumbnailRequest, _user: dict = Depends(get_current_user)):
    """
    Returns a signed GEE thumbnail URL coloured by the requested spectral index
    (NDVI, EVI, NDWI, NDRE, SAVI, BSI, NDMI). URL valid ~24 hours.
    """
    try:
        result = gee_service.get_index_thumbnail(
            lat=req.lat, lon=req.lon, start=req.start, end=req.end,
            index=req.index, polygon=req.polygon, buffer_m=req.buffer_m,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GEE error: {str(e)}")
    return result


@router.post("/thumbnail", summary="True-color Sentinel-2 RGB thumbnail URL for the field")
def get_thumbnail(req: GeoRequest, _user: dict = Depends(get_current_user)):
    """
    Returns a signed GEE thumbnail URL showing the field in natural colour
    (B4/B3/B2). URL is valid for ~24 hours. Use in <img> tags or map overlays.
    """
    try:
        result = gee_service.get_rgb_thumbnail(
            lat=req.lat, lon=req.lon, start=req.start, end=req.end,
            polygon=req.polygon, buffer_m=req.buffer_m,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GEE error: {str(e)}")
    return result
