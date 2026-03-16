"""
SoilGrids v2 REST API integration.
Fetches estimated soil properties (pH, texture) for a given coordinate.
Free tier — no API key required.
"""
import httpx
from typing import Optional


SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"

# Clay/sand/silt values come back as cg/kg (divide by 10 to get %)
# pH comes back as pH*10 (divide by 10 to get pH)


def _classify_texture(clay_pct: float, sand_pct: float, silt_pct: float) -> str:
    """USDA soil texture triangle simplified classification."""
    if clay_pct >= 40:
        return "Clay"
    if sand_pct >= 70 and clay_pct < 15:
        return "Sandy"
    if silt_pct >= 80:
        return "Silty"
    if clay_pct >= 27 and sand_pct < 45:
        return "Clay Loam"
    if clay_pct >= 20 and sand_pct >= 45:
        return "Sandy Clay Loam"
    if sand_pct >= 50 and clay_pct < 20:
        return "Sandy Loam"
    if silt_pct >= 50 and clay_pct < 27:
        return "Silt Loam"
    return "Loam"


def _ph_description(ph: float) -> str:
    if ph < 5.5:
        return "Strongly acidic — lime application recommended"
    if ph < 6.0:
        return "Moderately acidic — suitable for acid-loving crops"
    if ph < 7.0:
        return "Slightly acidic — ideal for most crops"
    if ph < 7.5:
        return "Neutral — excellent for most crops"
    if ph < 8.0:
        return "Slightly alkaline — monitor micronutrient availability"
    return "Alkaline — may need soil amendment"


async def get_soil_data(lat: float, lon: float) -> dict:
    """
    Returns soil properties at the given coordinate from SoilGrids v2.
    Depth: 0–5 cm (topsoil).
    """
    params = [
        ("lon", lon),
        ("lat", lat),
        ("property", "phh2o"),
        ("property", "clay"),
        ("property", "sand"),
        ("property", "silt"),
        ("property", "soc"),
        ("depth", "0-5cm"),
        ("value", "mean"),
    ]

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(SOILGRIDS_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return {"error": str(e), "available": False}

    properties = {
        item["name"]: item
        for item in data.get("properties", {}).get("layers", [])
    }

    def mean_val(prop_name: str) -> Optional[float]:
        prop = properties.get(prop_name)
        if not prop:
            return None
        depths = prop.get("depths", [])
        if not depths:
            return None
        val = depths[0].get("values", {}).get("mean")
        return val

    ph_raw    = mean_val("phh2o")   # pH * 10
    clay_raw  = mean_val("clay")    # cg/kg
    sand_raw  = mean_val("sand")    # cg/kg
    silt_raw  = mean_val("silt")    # cg/kg
    soc_raw   = mean_val("soc")     # dg/kg

    ph_val   = round(ph_raw / 10, 1)   if ph_raw   is not None else None
    clay_pct = round(clay_raw / 10, 1) if clay_raw is not None else None
    sand_pct = round(sand_raw / 10, 1) if sand_raw is not None else None
    silt_pct = round(silt_raw / 10, 1) if silt_raw is not None else None
    soc_pct  = round(soc_raw  / 10, 2) if soc_raw  is not None else None

    soil_type = None
    if clay_pct is not None and sand_pct is not None and silt_pct is not None:
        soil_type = _classify_texture(clay_pct, sand_pct, silt_pct)

    return {
        "available":   True,
        "estimated":   True,           # remind UI to show "estimated" label
        "ph":          ph_val,
        "ph_desc":     _ph_description(ph_val) if ph_val else None,
        "clay_pct":    clay_pct,
        "sand_pct":    sand_pct,
        "silt_pct":    silt_pct,
        "soc_pct":     soc_pct,        # soil organic carbon %
        "soil_type":   soil_type,
        "depth":       "0–5 cm",
        "source":      "SoilGrids v2 (ISRIC)",
    }
