"""
Advisory Engine route — combines growth stage, weather advisories,
NDVI stress signals, and fertiliser recommendations into a single
actionable advisory response for a field.
"""
import asyncio
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List

from backend.core.auth import get_current_user
from backend.services import advisory_service
from backend.services.weather_service import get_current_weather, get_forecast

router = APIRouter(prefix="/api/advisory", tags=["Advisory Engine"])


class AdvisoryRequest(BaseModel):
    crop_type: str
    lat: float
    lon: float
    sowing_date: Optional[str] = None
    # Optional pre-computed values (if caller already has them)
    ndvi:       Optional[float] = None
    ndwi:       Optional[float] = None
    ndre:       Optional[float] = None
    bsi:        Optional[float] = None
    cwsi:       Optional[float] = None
    surface_sm: Optional[float] = None
    soil_ph:    Optional[float] = None


@router.post("", summary="Get full advisory: growth stage, weather cards, fertiliser schedule")
async def get_advisory(body: AdvisoryRequest, _user: dict = Depends(get_current_user)):
    """
    Returns:
    - Current crop growth stage + upcoming actions
    - Weather advisory cards (heat, rain, frost, fungal risk...)
    - NDVI/NDWI/NDRE-based stress advisory cards
    - Irrigation advisory (CWSI / soil moisture)
    - Fertiliser schedule for the crop
    """
    # Fetch live weather in parallel
    weather_res, forecast_res = await asyncio.gather(
        get_current_weather(body.lat, body.lon),
        get_forecast(body.lat, body.lon),
        return_exceptions=True,
    )

    weather  = weather_res  if not isinstance(weather_res,  Exception) else None
    forecast = forecast_res if not isinstance(forecast_res, Exception) else None

    # Build indices dict from optional pre-computed values
    indices = None
    if any(v is not None for v in [body.ndvi, body.ndwi, body.ndre, body.bsi]):
        indices = {
            "NDVI": {"value": body.ndvi},
            "NDWI": {"value": body.ndwi},
            "NDRE": {"value": body.ndre},
            "BSI":  {"value": body.bsi},
        }

    result = advisory_service.build_advisory(
        crop_type  = body.crop_type,
        sowing_date= body.sowing_date,
        weather    = weather,
        forecast   = forecast,
        indices    = indices,
        cwsi       = body.cwsi,
        surface_sm = body.surface_sm,
        soil_ph    = body.soil_ph,
    )

    return result


@router.get("/crops", summary="List all crops with calendar data")
def list_crops(_user: dict = Depends(get_current_user)):
    """Returns the list of crops that have a growth stage calendar."""
    return {
        "crops": [
            {"key": k, "name": v["name"], "total_days": v["total_days"],
             "stage_count": len(v["stages"])}
            for k, v in advisory_service.CROP_CALENDAR.items()
        ]
    }


@router.get("/fertilizer/{crop_type}", summary="Fertiliser schedule for a crop")
def get_fertilizer(crop_type: str, soil_ph: Optional[float] = None,
                   _user: dict = Depends(get_current_user)):
    """Returns the standard NPK fertiliser schedule for the given crop."""
    recs = advisory_service.get_fertilizer_recommendations(crop_type, soil_ph)
    return {"crop": crop_type, "recommendations": recs}


@router.get("/stage/{crop_type}", summary="Get current growth stage")
def get_stage(crop_type: str, sowing_date: str,
              _user: dict = Depends(get_current_user)):
    """Returns the current growth stage based on sowing date and today's date."""
    stage = advisory_service.get_growth_stage(crop_type, sowing_date)
    if not stage:
        return {"error": f"No calendar available for crop: {crop_type}"}
    return stage
