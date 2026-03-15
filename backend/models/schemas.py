from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date


# ─── Remote Sensing ───────────────────────────────────────────────────────────

class IndicesRequest(BaseModel):
    lat: float = Field(..., description="Latitude of field center")
    lon: float = Field(..., description="Longitude of field center")
    start: str = Field(..., description="Start date YYYY-MM-DD")
    end: str = Field(..., description="End date YYYY-MM-DD")
    buffer_m: int = Field(1000, description="Buffer radius in meters around point")
    cloud_pct: int = Field(30, description="Max cloud cover percentage")


class IndexValue(BaseModel):
    value: Optional[float]
    health_zone: str   # Critical / Poor / Moderate / Good / Excellent
    description: str


class IndicesResponse(BaseModel):
    lat: float
    lon: float
    start: str
    end: str
    image_count: int
    indices: Dict[str, IndexValue]


class TimeseriesPoint(BaseModel):
    date: str
    ndvi: Optional[float]
    evi: Optional[float]
    ndwi: Optional[float]
    ndre: Optional[float]


class TimeseriesResponse(BaseModel):
    lat: float
    lon: float
    points: List[TimeseriesPoint]


# ─── Field ────────────────────────────────────────────────────────────────────

class FieldCreate(BaseModel):
    name: str
    lat: float
    lon: float
    buffer_m: int = 1000
    crop_type: str
    sowing_date: str
    state: str
    district: str
    irrigation_type: Optional[str] = "rainfed"


class FieldResponse(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    buffer_m: int
    crop_type: str
    sowing_date: str
    state: str
    district: str
    irrigation_type: str


# ─── Sensor ───────────────────────────────────────────────────────────────────

class SensorReading(BaseModel):
    device_id: str
    field_id: str
    soil_moisture: Optional[float] = None     # % VWC
    soil_temp: Optional[float] = None         # °C
    air_temp: Optional[float] = None          # °C
    humidity: Optional[float] = None          # % RH
    leaf_wetness: Optional[float] = None      # hours
    rainfall: Optional[float] = None          # mm
    lat: Optional[float] = None
    lon: Optional[float] = None


class SensorResponse(BaseModel):
    status: str
    reading_id: str


# ─── Pest Risk ────────────────────────────────────────────────────────────────

class PestRiskRequest(BaseModel):
    lat: float
    lon: float
    crop_type: str
    air_temp: Optional[float] = None
    humidity: Optional[float] = None
    leaf_wetness: Optional[float] = None
    rainfall_mm: Optional[float] = None
    ndvi: Optional[float] = None
    ndvi_delta: Optional[float] = None   # change in NDVI over last 7 days


class PestAlert(BaseModel):
    pest: str
    risk_level: str   # Low / Medium / High
    confidence: float
    triggers: List[str]
    recommendation: str


class PestRiskResponse(BaseModel):
    crop_type: str
    overall_risk: str
    alerts: List[PestAlert]


# ─── Disease Detection ────────────────────────────────────────────────────────

class DiseaseDetectionResponse(BaseModel):
    predicted_class: str
    confidence: float
    crop: str
    disease: str
    severity: str
    treatment: str
    is_healthy: bool


# ─── Weather ─────────────────────────────────────────────────────────────────

class WeatherResponse(BaseModel):
    temp_c: float
    humidity_pct: float
    description: str
    wind_kph: float
    rainfall_mm: float
    forecast: List[Dict[str, Any]]


# ─── Alerts ───────────────────────────────────────────────────────────────────

class AlertResponse(BaseModel):
    id: str
    field_id: str
    alert_type: str
    severity: str
    message: str
    triggered_at: str
    acknowledged: bool
