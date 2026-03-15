from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from backend.models.schemas import DiseaseDetectionResponse, PestRiskRequest, PestRiskResponse
from backend.services import pest_risk as pest_risk_service

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


# ─── Disease Detection ────────────────────────────────────────────────────────

@router.post(
    "/detect-disease",
    response_model=DiseaseDetectionResponse,
    summary="CNN leaf disease detection (PlantVillage, 38 classes)",
)
async def detect_disease(
    file: UploadFile = File(..., description="Leaf image — JPEG/PNG, max 10 MB"),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG/PNG/WebP images are accepted.")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 10 MB limit.")

    try:
        from backend.services.disease_detection import detect_disease as run_inference
        result = run_inference(image_bytes)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

    return DiseaseDetectionResponse(**result)


# ─── Pest Risk ────────────────────────────────────────────────────────────────

@router.post(
    "/pest-risk",
    response_model=PestRiskResponse,
    summary="Rule-based pest risk assessment from environmental parameters",
)
def get_pest_risk(req: PestRiskRequest):
    """
    Evaluates pest risk based on crop type + environmental sensor readings.
    Returns a ranked list of potential pest threats with recommendations.
    """
    result = pest_risk_service.evaluate_pest_risk(
        crop_type=req.crop_type,
        air_temp=req.air_temp,
        humidity=req.humidity,
        leaf_wetness=req.leaf_wetness,
        rainfall_mm=req.rainfall_mm,
        ndvi=req.ndvi,
        ndvi_delta=req.ndvi_delta,
    )
    return PestRiskResponse(**result)


# ─── LSTM Stress Forecast ─────────────────────────────────────────────────────

class StressForecastRequest(BaseModel):
    sequence: List[List[float]]  # 12 x 6: [ndvi, evi, ndwi, soil_moisture, temp_c, humidity]
    field_id: Optional[str] = None


class StressForecastResponse(BaseModel):
    stress_probability: float
    severity_score: float
    risk_level: str
    forecast_days: int
    field_id: Optional[str] = None


@router.post(
    "/stress-forecast",
    response_model=StressForecastResponse,
    summary="LSTM 7-day crop stress forecast from vegetation + weather time series",
)
def stress_forecast(req: StressForecastRequest):
    """
    Input: 12-step sequence of [NDVI, EVI, NDWI, soil_moisture, temp_c, humidity_pct]
    Output: 7-day stress probability (0–1) + severity score + risk level
    """
    if len(req.sequence) != 12:
        raise HTTPException(status_code=400, detail="Sequence must have exactly 12 time steps.")
    for step in req.sequence:
        if len(step) != 6:
            raise HTTPException(status_code=400, detail="Each step must have 6 features: [ndvi, evi, ndwi, soil_moisture, temp_c, humidity]")

    try:
        from backend.services.lstm_service import predict_stress
        result = predict_stress(req.sequence)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LSTM inference error: {str(e)}")

    return StressForecastResponse(**result, field_id=req.field_id)


# ─── Yield Estimation (rule-based) ────────────────────────────────────────────

class YieldEstimateRequest(BaseModel):
    crop_type: str
    ndvi_flowering: float    # NDVI at flowering / grain-fill stage
    soil_moisture_avg: Optional[float] = None  # average % VWC during growing season
    gdd_accumulated: Optional[float] = None    # Growing Degree Days
    state: Optional[str] = None


class YieldEstimateResponse(BaseModel):
    crop_type: str
    estimated_min_kg_ha: int
    estimated_max_kg_ha: int
    estimated_modal_kg_ha: int
    confidence: str
    notes: str


# Base yield tables (kg/ha) by NDVI range and crop
YIELD_TABLE = {
    "rice":      [(0.0, 0.2, 800,  1500, 1150),  (0.2, 0.4, 1500, 2800, 2150),
                  (0.4, 0.6, 2800, 4500, 3650),  (0.6, 1.0, 4500, 6500, 5500)],
    "wheat":     [(0.0, 0.2, 700,  1200, 950),   (0.2, 0.4, 1200, 2500, 1850),
                  (0.4, 0.6, 2500, 4000, 3250),  (0.6, 1.0, 4000, 5500, 4750)],
    "maize":     [(0.0, 0.2, 800,  1500, 1150),  (0.2, 0.4, 1500, 3000, 2250),
                  (0.4, 0.6, 3000, 5000, 4000),  (0.6, 1.0, 5000, 7500, 6250)],
    "cotton":    [(0.0, 0.2, 300,  600,  450),   (0.2, 0.4, 600,  1200, 900),
                  (0.4, 0.6, 1200, 2000, 1600),  (0.6, 1.0, 2000, 2800, 2400)],
    "sugarcane": [(0.0, 0.2, 20000,40000,30000), (0.2, 0.4, 40000,60000,50000),
                  (0.4, 0.6, 60000,80000,70000), (0.6, 1.0, 80000,100000,90000)],
}

DEFAULT_TABLE = [(0.0, 0.2, 500, 1000, 750),  (0.2, 0.4, 1000, 2000, 1500),
                 (0.4, 0.6, 2000, 3500, 2750), (0.6, 1.0, 3500, 5000, 4250)]


@router.post(
    "/yield-estimate",
    response_model=YieldEstimateResponse,
    summary="Estimate yield range based on NDVI at key growth stage",
)
def yield_estimate(req: YieldEstimateRequest):
    table = YIELD_TABLE.get(req.crop_type.lower(), DEFAULT_TABLE)
    ndvi = max(0.0, min(req.ndvi_flowering, 0.99))

    min_kg, max_kg, modal_kg = table[-1][2], table[-1][3], table[-1][4]
    for lo, hi, mn, mx, mod in table:
        if lo <= ndvi < hi:
            min_kg, max_kg, modal_kg = mn, mx, mod
            break

    # Adjust for soil moisture
    if req.soil_moisture_avg is not None:
        if req.soil_moisture_avg < 20:
            factor = 0.75   # severe water stress → 25% reduction
        elif req.soil_moisture_avg > 60:
            factor = 0.90   # waterlogging → 10% reduction
        else:
            factor = 1.0
        min_kg   = int(min_kg * factor)
        max_kg   = int(max_kg * factor)
        modal_kg = int(modal_kg * factor)

    confidence = "High" if ndvi >= 0.45 else ("Medium" if ndvi >= 0.25 else "Low")

    notes = (
        f"Based on NDVI={ndvi:.3f} at flowering/grain-fill stage for {req.crop_type.title()}. "
        f"{'Soil moisture adjustment applied. ' if req.soil_moisture_avg else ''}"
        f"For improved accuracy, validate with ground harvest data."
    )

    return YieldEstimateResponse(
        crop_type=req.crop_type,
        estimated_min_kg_ha=min_kg,
        estimated_max_kg_ha=max_kg,
        estimated_modal_kg_ha=modal_kg,
        confidence=confidence,
        notes=notes,
    )
