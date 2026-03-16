"""
Onboarding analysis route.
Triggered after a farmer draws their field polygon and enters crop details.
Runs: NDVI (GEE), weather (OWM), soil (SoilGrids) in parallel,
then returns a combined snapshot.
"""
import asyncio
from datetime import date, timedelta
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from backend.services.gee_service import compute_indices
from backend.services.weather_service import get_current_weather, get_forecast
from backend.services.soilgrids_service import get_soil_data

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])


class AnalyzeRequest(BaseModel):
    lat: float
    lon: float
    crop_type: str
    buffer_m: int = 500
    polygon: Optional[List[List[float]]] = None   # [[lat, lon], ...] — used as GEE AOI when provided
    field_name: Optional[str] = "My Field"


@router.post("/analyze", summary="Run combined NDVI + weather + soil analysis for onboarding")
async def analyze(body: AnalyzeRequest):
    end   = date.today().isoformat()
    start = (date.today() - timedelta(days=30)).isoformat()

    # Build parallel tasks — polygon passed to GEE for accurate per-field AOI
    ndvi_task     = asyncio.to_thread(
        compute_indices, body.lat, body.lon, start, end, body.buffer_m, 30, body.polygon
    )
    weather_task  = get_current_weather(body.lat, body.lon)
    forecast_task = get_forecast(body.lat, body.lon)
    soil_task     = get_soil_data(body.lat, body.lon)

    ndvi_result, weather_result, forecast_result, soil_result = await asyncio.gather(
        ndvi_task, weather_task, forecast_task, soil_task,
        return_exceptions=True,
    )

    # Gracefully handle individual failures
    ndvi_data     = ndvi_result    if not isinstance(ndvi_result,    Exception) else {"image_count": 0, "indices": {}}
    weather_data  = weather_result if not isinstance(weather_result, Exception) else None
    forecast_data = forecast_result if not isinstance(forecast_result, Exception) else None
    soil_data     = soil_result    if not isinstance(soil_result,    Exception) else {"available": False}

    # Pull out NDVI value and health zone for the summary card
    ndvi_index = ndvi_data.get("indices", {}).get("NDVI", {})
    ndvi_val   = ndvi_index.get("value")
    ndvi_zone  = ndvi_index.get("health_zone", "Unknown")
    ndvi_desc  = ndvi_index.get("description", "")

    return {
        "period":      {"start": start, "end": end},
        "ndvi": {
            "value":        ndvi_val,
            "health_zone":  ndvi_zone,
            "description":  ndvi_desc,
            "image_count":  ndvi_data.get("image_count", 0),
            "all_indices":  ndvi_data.get("indices", {}),
        },
        "weather":   weather_data,
        "forecast":  forecast_data,
        "soil":      soil_data,
    }
