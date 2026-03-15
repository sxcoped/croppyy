"""
Weather service — fetches current conditions + 5-day forecast
from OpenWeatherMap free tier.
Also pulls historical weather from NASA POWER API (no key required).
"""
import httpx
from backend.core.config import OPENWEATHER_API_KEY

OWM_BASE = "https://api.openweathermap.org/data/2.5"
NASA_POWER_BASE = "https://power.larc.nasa.gov/api/temporal/daily/point"


async def get_current_weather(lat: float, lon: float) -> dict:
    if not OPENWEATHER_API_KEY:
        return {"error": "OPENWEATHER_API_KEY not configured"}

    url = f"{OWM_BASE}/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    return {
        "temp_c":      data["main"]["temp"],
        "humidity_pct": data["main"]["humidity"],
        "description": data["weather"][0]["description"].title(),
        "wind_kph":    round(data["wind"]["speed"] * 3.6, 1),
        "rainfall_mm": data.get("rain", {}).get("1h", 0.0),
    }


async def get_forecast(lat: float, lon: float) -> list:
    if not OPENWEATHER_API_KEY:
        return []

    url = f"{OWM_BASE}/forecast"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric",
        "cnt": 40,   # 5 days × 8 per day (3-hr intervals)
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    # Aggregate to daily
    daily = {}
    for item in data["list"]:
        day = item["dt_txt"][:10]
        if day not in daily:
            daily[day] = {"temps": [], "humidity": [], "rain": 0.0, "desc": ""}
        daily[day]["temps"].append(item["main"]["temp"])
        daily[day]["humidity"].append(item["main"]["humidity"])
        daily[day]["rain"] += item.get("rain", {}).get("3h", 0.0)
        daily[day]["desc"]  = item["weather"][0]["description"].title()

    forecast = []
    for day, vals in list(daily.items())[:5]:
        forecast.append({
            "date":       day,
            "temp_min":   round(min(vals["temps"]), 1),
            "temp_max":   round(max(vals["temps"]), 1),
            "humidity":   round(sum(vals["humidity"]) / len(vals["humidity"]), 1),
            "rainfall_mm": round(vals["rain"], 1),
            "description": vals["desc"],
        })
    return forecast


async def get_nasa_power_weather(lat: float, lon: float,
                                  start: str, end: str) -> dict:
    """
    Fetches daily historical weather from NASA POWER API.
    Parameters: T2M (temp), RH2M (humidity), PRECTOTCORR (rainfall), WS2M (wind)
    start/end format: YYYYMMDD
    """
    params = {
        "parameters": "T2M,RH2M,PRECTOTCORR,WS2M",
        "community": "AG",
        "longitude": lon,
        "latitude":  lat,
        "start":     start.replace("-", ""),
        "end":       end.replace("-", ""),
        "format":    "JSON",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(NASA_POWER_BASE, params=params)
        resp.raise_for_status()
        data = resp.json()

    props = data.get("properties", {}).get("parameter", {})
    dates = list(props.get("T2M", {}).keys())

    results = []
    for d in sorted(dates):
        results.append({
            "date":        f"{d[:4]}-{d[4:6]}-{d[6:]}",
            "temp_c":      props.get("T2M",          {}).get(d),
            "humidity_pct": props.get("RH2M",         {}).get(d),
            "rainfall_mm": props.get("PRECTOTCORR",   {}).get(d),
            "wind_ms":     props.get("WS2M",          {}).get(d),
        })
    return {"data": results}
