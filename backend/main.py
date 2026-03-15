"""
Croppy — FastAPI backend entry point
Run with: uvicorn backend.main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.services.gee_service import initialize_ee
from backend.routes import rs, ml, fields, sensors, weather, auth, alerts, market, reports

# ─── GEE init ────────────────────────────────────────────────────────────────
initialize_ee()

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Croppy API",
    description=(
        "AI-powered crop health, soil condition & pest risk monitoring platform. "
        "Integrates Sentinel-2 satellite imagery, IoT sensors, CNN disease detection, "
        "LSTM temporal forecasting, and rule-based pest risk engine. "
        "SIH Problem ID: 25099 | MathWorks India."
    ),
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(rs.router)
app.include_router(ml.router)
app.include_router(fields.router)
app.include_router(sensors.router)
app.include_router(weather.router)
app.include_router(alerts.router)
app.include_router(market.router)
app.include_router(reports.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "service":  "Croppy API",
        "version":  "0.2.0",
        "docs":     "/docs",
        "status":   "ok",
        "modules": [
            "Remote Sensing (GEE — Sentinel-2, SMAP)",
            "CNN Disease Detection (PlantVillage 38-class)",
            "LSTM Stress Forecast (7-day)",
            "Rule-based Pest Risk Engine",
            "Yield Estimation",
            "IoT Sensor Ingestion",
            "Weather (OpenWeatherMap + NASA POWER)",
            "Alerts System",
            "Market Prices (Agmarknet)",
            "PDF Report Generation",
        ],
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
