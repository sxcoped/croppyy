"""
Google Earth Engine service — computes all vegetation/soil indices
from Sentinel-2 SR imagery, plus CHIRPS rainfall, MODIS LST, and NASADEM elevation.
"""
import ee
from typing import Optional, List
from backend.core.config import GEE_PROJECT_ID


def initialize_ee():
    try:
        ee.Initialize(project=GEE_PROJECT_ID)
    except ee.EEException:
        ee.Authenticate()
        ee.Initialize(project=GEE_PROJECT_ID)


def _make_aoi(lat: float, lon: float, buffer_m: int,
              polygon: Optional[List[List[float]]] = None) -> ee.Geometry:
    """
    Build a GEE AOI from a farmer-drawn polygon when available,
    otherwise fall back to a point+buffer circle.
    polygon format: [[lat, lon], ...] (our internal storage order)
    GEE expects [[lon, lat], ...] (GeoJSON order)
    """
    if polygon and len(polygon) >= 3:
        geojson_coords = [[pt[1], pt[0]] for pt in polygon]
        return ee.Geometry.Polygon([geojson_coords])
    return ee.Geometry.Point(lon, lat).buffer(buffer_m)


# ─── Health zone classification ───────────────────────────────────────────────

NDVI_ZONES = [
    (-1.0,  0.1, "Critical",   "Bare soil or water — no vegetation"),
    (0.1,   0.2, "Poor",       "Very sparse or severely stressed vegetation"),
    (0.2,   0.4, "Moderate",   "Sparse to moderate vegetation, possible stress"),
    (0.4,   0.6, "Good",       "Healthy moderate vegetation"),
    (0.6,   1.0, "Excellent",  "Dense, highly vigorous vegetation"),
]

EVI_ZONES = [
    (-1.0, 0.1, "Critical", "No photosynthetic activity"),
    (0.1,  0.2, "Poor",     "Very low canopy activity"),
    (0.2,  0.35,"Moderate", "Moderate canopy"),
    (0.35, 0.5, "Good",     "Healthy canopy"),
    (0.5,  1.0, "Excellent","Dense, vigorous canopy"),
]

NDWI_ZONES = [
    (-1.0, -0.3, "Critical",   "Severe water stress / drought"),
    (-0.3, 0.0,  "Poor",       "Low water content — monitor irrigation"),
    (0.0,  0.2,  "Moderate",   "Adequate soil moisture"),
    (0.2,  0.4,  "Good",       "Good water content"),
    (0.4,  1.0,  "Excellent",  "High water content"),
]

NDRE_ZONES = [
    (-1.0, 0.1, "Critical",   "Severe chlorophyll deficiency"),
    (0.1,  0.2, "Poor",       "Low chlorophyll — early stress signal"),
    (0.2,  0.35,"Moderate",   "Moderate chlorophyll"),
    (0.35, 0.5, "Good",       "Healthy chlorophyll levels"),
    (0.5,  1.0, "Excellent",  "High chlorophyll — very healthy"),
]

BSI_ZONES = [
    (-1.0, 0.0, "Excellent", "No bare soil — full cover"),
    (0.0,  0.1, "Good",      "Minimal bare soil"),
    (0.1,  0.2, "Moderate",  "Partial soil exposure"),
    (0.2,  0.35,"Poor",      "Significant bare soil — erosion risk"),
    (0.35, 1.0, "Critical",  "Mostly bare soil — severe degradation"),
]

GENERIC_ZONES = NDVI_ZONES  # SAVI, MSAVI, NDMI follow NDVI-like interpretation


def classify(value: Optional[float], zones) -> tuple:
    if value is None:
        return "Unknown", "No data available"
    for lo, hi, label, desc in zones:
        if lo <= value < hi:
            return label, desc
    return "Unknown", "Value out of expected range"


# ─── Main indices computation ─────────────────────────────────────────────────

def compute_indices(lat: float, lon: float, start: str, end: str,
                    buffer_m: int = 1000, cloud_pct: int = 30,
                    polygon: Optional[List[List[float]]] = None) -> dict:
    aoi = _make_aoi(lat, lon, buffer_m, polygon)

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_pct))
    )

    image_count = collection.size().getInfo()

    if image_count == 0:
        return {"image_count": 0, "indices": {}}

    img = collection.median()

    # Scale factor: Sentinel-2 SR bands are stored as integers (0–10000)
    b2  = img.select("B2").divide(10000)   # Blue
    b3  = img.select("B3").divide(10000)   # Green
    b4  = img.select("B4").divide(10000)   # Red
    b5  = img.select("B5").divide(10000)   # Red Edge 1
    b8  = img.select("B8").divide(10000)   # NIR broad
    b8a = img.select("B8A").divide(10000)  # NIR narrow
    b11 = img.select("B11").divide(10000)  # SWIR 1

    # ── Vegetation indices ─────────────────────────────────────────────────────
    ndvi  = b8.subtract(b4).divide(b8.add(b4)).rename("NDVI")

    evi   = (b8.subtract(b4)
               .multiply(2.5)
               .divide(b8.add(b4.multiply(6)).subtract(b2.multiply(7.5)).add(1))
               .rename("EVI"))

    savi  = (b8.subtract(b4)
               .multiply(1.5)
               .divide(b8.add(b4).add(0.5))
               .rename("SAVI"))

    ndwi  = b3.subtract(b8).divide(b3.add(b8)).rename("NDWI")

    ndre  = b8a.subtract(b5).divide(b8a.add(b5)).rename("NDRE")

    msavi = (b8.multiply(2).add(1)
               .subtract(
                   b8.multiply(2).add(1).pow(2)
                   .subtract(b8.subtract(b4).multiply(8))
                   .sqrt()
               )
               .divide(2)
               .rename("MSAVI"))

    # ── Soil indices ───────────────────────────────────────────────────────────
    bsi   = (b11.add(b4).subtract(b8.add(b2))
               .divide(b11.add(b4).add(b8.add(b2)))
               .rename("BSI"))

    ndmi  = b8.subtract(b11).divide(b8.add(b11)).rename("NDMI")

    all_bands = (ndvi.addBands(evi).addBands(savi).addBands(ndwi)
                     .addBands(ndre).addBands(msavi).addBands(bsi).addBands(ndmi))

    means = all_bands.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=aoi,
        scale=10,
        maxPixels=1e9
    ).getInfo()

    def safe(key):
        v = means.get(key)
        return round(v, 4) if v is not None else None

    def build(key, zones):
        val = safe(key)
        zone, desc = classify(val, zones)
        return {"value": val, "health_zone": zone, "description": desc}

    return {
        "image_count": image_count,
        "indices": {
            "NDVI":  build("NDVI",  NDVI_ZONES),
            "EVI":   build("EVI",   EVI_ZONES),
            "SAVI":  build("SAVI",  GENERIC_ZONES),
            "NDWI":  build("NDWI",  NDWI_ZONES),
            "NDRE":  build("NDRE",  NDRE_ZONES),
            "MSAVI": build("MSAVI", GENERIC_ZONES),
            "BSI":   build("BSI",   BSI_ZONES),
            "NDMI":  build("NDMI",  NDWI_ZONES),
        },
    }


# ─── Time series ──────────────────────────────────────────────────────────────

def compute_timeseries(lat: float, lon: float, start: str, end: str,
                       buffer_m: int = 1000,
                       polygon: Optional[List[List[float]]] = None) -> list:
    """
    Returns a list of {date, ndvi, evi, ndwi, ndre} dicts sampled every
    `interval_days` across the date range using Sentinel-2.
    """
    aoi = _make_aoi(lat, lon, buffer_m, polygon)

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        .sort("system:time_start")
    )

    def extract(image):
        img  = image.divide(10000)
        b4   = img.select("B4")
        b5   = img.select("B5")
        b3   = img.select("B3")
        b8   = img.select("B8")
        b8a  = img.select("B8A")
        b2   = img.select("B2")

        ndvi = b8.subtract(b4).divide(b8.add(b4))
        evi  = (b8.subtract(b4).multiply(2.5)
                  .divide(b8.add(b4.multiply(6)).subtract(b2.multiply(7.5)).add(1)))
        ndwi = b3.subtract(b8).divide(b3.add(b8))
        ndre = b8a.subtract(b5).divide(b8a.add(b5))

        bands = ndvi.rename("NDVI").addBands(evi.rename("EVI")) \
                    .addBands(ndwi.rename("NDWI")).addBands(ndre.rename("NDRE"))

        means = bands.reduceRegion(
            reducer=ee.Reducer.mean(), geometry=aoi, scale=10, maxPixels=1e8
        )
        return ee.Feature(None, means.set(
            "date", image.date().format("YYYY-MM-dd")
        ))

    features = collection.map(extract).getInfo()["features"]

    results = []
    for f in features:
        p = f["properties"]
        results.append({
            "date": p.get("date"),
            "ndvi": round(p["NDVI"], 4) if p.get("NDVI") is not None else None,
            "evi":  round(p["EVI"],  4) if p.get("EVI")  is not None else None,
            "ndwi": round(p["NDWI"], 4) if p.get("NDWI") is not None else None,
            "ndre": round(p["NDRE"], 4) if p.get("NDRE") is not None else None,
        })
    return results


# ─── Soil moisture (SMAP) ─────────────────────────────────────────────────────

def compute_soil_moisture(lat: float, lon: float, start: str, end: str) -> dict:
    aoi = ee.Geometry.Point(lon, lat).buffer(5000)   # SMAP is 10 km resolution

    collection = (
        ee.ImageCollection("NASA_USDA/HSL/SMAP10KM_soil_moisture")
        .filterBounds(aoi)
        .filterDate(start, end)
    )

    count = collection.size().getInfo()
    if count == 0:
        return {"surface_sm": None, "subsurface_sm": None, "image_count": 0}

    img = collection.mean()

    means = img.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=aoi,
        scale=10000,
        maxPixels=1e6
    ).getInfo()

    return {
        "surface_sm":     round(means.get("ssm",  0) or 0, 3),
        "subsurface_sm":  round(means.get("susm", 0) or 0, 3),
        "image_count":    count,
        "unit":           "mm"
    }


# ─── CHIRPS Rainfall ──────────────────────────────────────────────────────────

def get_chirps_rainfall(lat: float, lon: float, start: str, end: str,
                        polygon: Optional[List[List[float]]] = None) -> dict:
    """
    Daily rainfall totals from CHIRPS v2.0 (Climate Hazards Group).
    5 km resolution, global coverage including India.
    Returns daily time series + period total and average.
    """
    aoi = _make_aoi(lat, lon, 5000, polygon)

    collection = (
        ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        .filterBounds(aoi)
        .filterDate(start, end)
        .select("precipitation")
    )

    count = collection.size().getInfo()
    if count == 0:
        return {"daily": [], "total_mm": 0, "avg_daily_mm": 0, "image_count": 0}

    def extract(image):
        mean = image.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=5000,
            maxPixels=1e6
        )
        return ee.Feature(None, {
            "date":          image.date().format("YYYY-MM-dd"),
            "precipitation": mean.get("precipitation"),
        })

    features = collection.map(extract).getInfo()["features"]

    daily = []
    total = 0.0
    for f in features:
        p = f["properties"]
        val = p.get("precipitation")
        val = round(val, 2) if val is not None else 0.0
        total += val
        daily.append({"date": p.get("date"), "mm": val})

    return {
        "daily":         daily,
        "total_mm":      round(total, 2),
        "avg_daily_mm":  round(total / len(daily), 2) if daily else 0,
        "image_count":   count,
    }


# ─── MODIS Land Surface Temperature ──────────────────────────────────────────

def get_land_surface_temp(lat: float, lon: float, start: str, end: str,
                          polygon: Optional[List[List[float]]] = None) -> dict:
    """
    Daytime land surface temperature from MODIS Terra MOD11A1 (1 km, daily).
    Also computes a simple CWSI proxy: (LST - T_min) / (T_max - T_min).
    Returns daily LST series + mean for the period.
    """
    aoi = _make_aoi(lat, lon, 1000, polygon)

    collection = (
        ee.ImageCollection("MODIS/061/MOD11A1")
        .filterBounds(aoi)
        .filterDate(start, end)
        .select("LST_Day_1km")
    )

    count = collection.size().getInfo()
    if count == 0:
        return {"daily": [], "mean_celsius": None, "cwsi": None, "image_count": 0}

    def extract(image):
        # MODIS LST is in Kelvin × 0.02 — convert to Celsius
        lst_c = image.multiply(0.02).subtract(273.15)
        mean = lst_c.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=1000,
            maxPixels=1e6
        )
        return ee.Feature(None, {
            "date":    image.date().format("YYYY-MM-dd"),
            "lst_c":   mean.get("LST_Day_1km"),
        })

    features = collection.map(extract).getInfo()["features"]

    daily = []
    temps = []
    for f in features:
        p = f["properties"]
        val = p.get("lst_c")
        val = round(val, 2) if val is not None else None
        daily.append({"date": p.get("date"), "lst_c": val})
        if val is not None:
            temps.append(val)

    mean_c = round(sum(temps) / len(temps), 2) if temps else None

    # Simple CWSI proxy: how far mean LST is above the cool baseline (25°C)
    # Real CWSI needs reference ET — this is an approximation for advisory use
    cwsi = None
    if mean_c is not None:
        t_min, t_max = 25.0, 45.0
        cwsi = round(max(0.0, min(1.0, (mean_c - t_min) / (t_max - t_min))), 3)

    return {
        "daily":        daily,
        "mean_celsius": mean_c,
        "cwsi":         cwsi,
        "cwsi_note":    "Approximate CWSI proxy: 0=no stress, 1=severe heat stress",
        "image_count":  count,
    }


# ─── NASADEM Elevation ────────────────────────────────────────────────────────

def get_elevation(lat: float, lon: float,
                  polygon: Optional[List[List[float]]] = None) -> dict:
    """
    Elevation (m) and terrain metrics from NASADEM (30 m resolution).
    Computes: mean elevation, slope (degrees), aspect (degrees).
    """
    aoi = _make_aoi(lat, lon, 1000, polygon)

    dem = ee.Image("NASA/NASADEM_HGT/001").select("elevation")
    terrain = ee.Algorithms.Terrain(dem)

    bands = dem.addBands(terrain.select("slope")).addBands(terrain.select("aspect"))

    stats = bands.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=aoi,
        scale=30,
        maxPixels=1e8
    ).getInfo()

    elev  = stats.get("elevation")
    slope = stats.get("slope")
    asp   = stats.get("aspect")

    def slope_class(s):
        if s is None:     return "Unknown"
        if s < 1:         return "Flat"
        if s < 5:         return "Gentle"
        if s < 15:        return "Moderate"
        if s < 30:        return "Steep"
        return "Very Steep"

    return {
        "elevation_m":   round(elev,  1) if elev  is not None else None,
        "slope_deg":     round(slope, 2) if slope is not None else None,
        "aspect_deg":    round(asp,   1) if asp   is not None else None,
        "slope_class":   slope_class(slope),
        "drainage_risk": "High" if (slope or 0) > 15 else ("Medium" if (slope or 0) > 5 else "Low"),
    }


# ─── Spatial Zone Map ─────────────────────────────────────────────────────────

def get_zone_map(lat: float, lon: float, start: str, end: str,
                 polygon: Optional[List[List[float]]] = None,
                 buffer_m: int = 500) -> dict:
    """
    Divide the field into a 50 m grid and compute NDVI per cell.
    Returns GeoJSON FeatureCollection with per-cell NDVI + stress flag.
    Cells where NDVI < (field_mean − 0.15) are flagged as stress hotspots.
    """
    aoi = _make_aoi(lat, lon, buffer_m, polygon)

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
    )

    count = collection.size().getInfo()
    if count == 0:
        return {"type": "FeatureCollection", "features": [], "image_count": 0,
                "field_mean_ndvi": None}

    img = collection.median()
    b4  = img.select("B4").divide(10000)
    b8  = img.select("B8").divide(10000)
    ndvi = b8.subtract(b4).divide(b8.add(b4)).rename("NDVI")

    # Field-wide mean for threshold comparison
    field_mean_raw = ndvi.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=aoi,
        scale=50,
        maxPixels=1e8
    ).getInfo()
    field_mean = field_mean_raw.get("NDVI")

    # Reduce to 50 m grid cells
    grid = ndvi.reduceToVectors(
        reducer=ee.Reducer.mean(),
        geometry=aoi,
        scale=50,
        geometryType="centroid",
        maxPixels=1e8,
        bestEffort=True,
    )

    features = grid.getInfo().get("features", [])

    threshold = (field_mean - 0.15) if field_mean is not None else 0.25
    result_features = []
    for f in features:
        props = f.get("properties", {})
        val = props.get("mean")
        coords = f.get("geometry", {}).get("coordinates", [0, 0])
        is_stress = val is not None and val < threshold

        result_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": coords},
            "properties": {
                "ndvi":       round(val, 4) if val is not None else None,
                "stress":     is_stress,
                "zone":       ("Critical" if val is not None and val < 0.2 else
                               "Poor" if val is not None and val < 0.35 else
                               "Moderate" if val is not None and val < 0.5 else "Good"),
            }
        })

    return {
        "type":             "FeatureCollection",
        "features":         result_features,
        "image_count":      count,
        "field_mean_ndvi":  round(field_mean, 4) if field_mean is not None else None,
        "stress_threshold": round(threshold, 4),
        "stress_cell_count": sum(1 for f in result_features if f["properties"]["stress"]),
        "total_cells":      len(result_features),
    }


# ─── True-color RGB Thumbnail ─────────────────────────────────────────────────

def get_rgb_thumbnail(lat: float, lon: float, start: str, end: str,
                      polygon: Optional[List[List[float]]] = None,
                      buffer_m: int = 500) -> dict:
    """
    Returns a URL to a true-color (B4/B3/B2) Sentinel-2 thumbnail for the AOI.
    The URL is a signed GEE getThumbURL — valid for ~24 hours.
    """
    aoi = _make_aoi(lat, lon, buffer_m, polygon)

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    )

    count = collection.size().getInfo()
    if count == 0:
        return {"url": None, "image_count": 0, "message": "No cloud-free images found"}

    img = collection.median().select(["B4", "B3", "B2"])

    url = img.getThumbURL({
        "min":        0,
        "max":        3000,
        "gamma":      1.4,
        "dimensions": 512,
        "region":     aoi,
        "format":     "png",
    })

    return {
        "url":         url,
        "image_count": count,
        "bands":       "B4 (Red), B3 (Green), B2 (Blue) — Natural Color",
    }


# Palettes and value ranges for each spectral index
_INDEX_PALETTES = {
    "NDVI": {
        "palette": ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"],
        "min": -0.1, "max": 0.85,
    },
    "EVI": {
        "palette": ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"],
        "min": -0.1, "max": 0.7,
    },
    "NDWI": {
        "palette": ["#8b4513", "#d2b48c", "#f5f5dc", "#b0e0e6", "#4fc3f7", "#0277bd"],
        "min": -0.5, "max": 0.5,
    },
    "NDRE": {
        "palette": ["#d73027", "#fc8d59", "#fee08b", "#a8ddb5", "#43a047", "#1b5e20"],
        "min": -0.1, "max": 0.55,
    },
    "SAVI": {
        "palette": ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"],
        "min": -0.1, "max": 0.7,
    },
    "BSI": {
        "palette": ["#1a9850", "#91cf60", "#fee08b", "#fc8d59", "#d73027", "#7f0000"],
        "min": -0.5, "max": 0.5,
    },
    "NDMI": {
        "palette": ["#7f0000", "#d73027", "#fc8d59", "#fee08b", "#4fc3f7", "#0277bd"],
        "min": -0.5, "max": 0.5,
    },
}


def get_index_thumbnail(lat: float, lon: float, start: str, end: str,
                        index: str = "NDVI",
                        polygon: Optional[List[List[float]]] = None,
                        buffer_m: int = 500) -> dict:
    """
    Returns a signed GEE thumbnail URL showing a false-colour spectral index
    map for the AOI. Supported indices: NDVI, EVI, NDWI, NDRE, SAVI, BSI, NDMI.
    """
    aoi = _make_aoi(lat, lon, buffer_m, polygon)

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    )

    count = collection.size().getInfo()
    if count == 0:
        return {"url": None, "image_count": 0,
                "message": "No cloud-free images found for this period"}

    img = collection.median()
    b4  = img.select("B4").divide(10000)
    b8  = img.select("B8").divide(10000)
    b3  = img.select("B3").divide(10000)
    b11 = img.select("B11").divide(10000)
    b5  = img.select("B5").divide(10000)
    b2  = img.select("B2").divide(10000)

    index_upper = index.upper()
    if index_upper == "NDVI":
        band = b8.subtract(b4).divide(b8.add(b4)).rename("idx")
    elif index_upper == "EVI":
        band = img.expression(
            "2.5 * (NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1)",
            {"NIR": b8, "RED": b4, "BLUE": b2}
        ).rename("idx")
    elif index_upper == "NDWI":
        band = b3.subtract(b8).divide(b3.add(b8)).rename("idx")
    elif index_upper == "NDRE":
        band = b8.subtract(b5).divide(b8.add(b5)).rename("idx")
    elif index_upper == "SAVI":
        L = 0.5
        band = img.expression(
            "((NIR - RED) / (NIR + RED + L)) * (1 + L)",
            {"NIR": b8, "RED": b4, "L": L}
        ).rename("idx")
    elif index_upper == "BSI":
        band = img.expression(
            "((RED + SWIR) - (NIR + BLUE)) / ((RED + SWIR) + (NIR + BLUE))",
            {"RED": b4, "SWIR": b11, "NIR": b8, "BLUE": b2}
        ).rename("idx")
    elif index_upper == "NDMI":
        band = b8.subtract(b11).divide(b8.add(b11)).rename("idx")
    else:
        raise ValueError(f"Unsupported index: {index}")

    meta = _INDEX_PALETTES.get(index_upper, _INDEX_PALETTES["NDVI"])

    url = band.getThumbURL({
        "min":        meta["min"],
        "max":        meta["max"],
        "palette":    meta["palette"],
        "dimensions": 512,
        "region":     aoi,
        "format":     "png",
    })

    return {
        "url":         url,
        "index":       index_upper,
        "image_count": count,
        "min":         meta["min"],
        "max":         meta["max"],
    }
