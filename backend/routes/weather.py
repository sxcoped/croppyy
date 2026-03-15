from fastapi import APIRouter, HTTPException
from backend.services.weather_service import (
    get_current_weather,
    get_forecast,
    get_nasa_power_weather,
)

router = APIRouter(prefix="/api/weather", tags=["Weather"])


@router.get("/current", summary="Current weather at coordinates (OpenWeatherMap)")
async def current(lat: float, lon: float):
    try:
        return await get_current_weather(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/forecast", summary="5-day daily forecast (OpenWeatherMap)")
async def forecast(lat: float, lon: float):
    try:
        return await get_forecast(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/historical", summary="Historical daily weather from NASA POWER API (no key needed)")
async def historical(lat: float, lon: float, start: str, end: str):
    """
    start/end format: YYYY-MM-DD
    Returns T2M (temp), RH2M (humidity), PRECTOTCORR (rainfall), WS2M (wind speed).
    Free, no API key needed.
    """
    try:
        return await get_nasa_power_weather(lat, lon, start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
