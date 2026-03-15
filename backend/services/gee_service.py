"""
Google Earth Engine service — computes all vegetation/soil indices
from Sentinel-2 SR imagery.
"""
import ee
from typing import Optional
from backend.core.config import GEE_PROJECT_ID


def initialize_ee():
    try:
        ee.Initialize(project=GEE_PROJECT_ID)
    except ee.EEException:
        ee.Authenticate()
        ee.Initialize(project=GEE_PROJECT_ID)


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

# Generic zones for indices where higher = more stress (BSI)
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
                    buffer_m: int = 1000, cloud_pct: int = 30) -> dict:
    point = ee.Geometry.Point(lon, lat)
    aoi = point.buffer(buffer_m)

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
    b12 = img.select("B12").divide(10000)  # SWIR 2

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
                       buffer_m: int = 1000, interval_days: int = 10) -> list:
    """
    Returns a list of {date, ndvi, evi, ndwi, ndre} dicts sampled every
    `interval_days` across the date range using Sentinel-2.
    """
    point = ee.Geometry.Point(lon, lat)
    aoi   = point.buffer(buffer_m)

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
        b11  = img.select("B11")
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
    point = ee.Geometry.Point(lon, lat)
    aoi   = point.buffer(5000)   # SMAP is 10 km resolution — need larger buffer

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
