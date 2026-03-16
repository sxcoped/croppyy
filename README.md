# 🌾 Croppy — AI-Powered Precision Agriculture Platform

> **SIH Problem ID: 25099 · MathWorks India**
> Satellite intelligence + AI inference for Indian farmers. Detect crop disease, track vegetation health from space, forecast stress, and never miss a pest outbreak.

---

## Table of Contents

1. [Overview](#overview)
2. [Feature Matrix](#feature-matrix)
3. [System Architecture](#system-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Directory Structure](#directory-structure)
6. [Tech Stack](#tech-stack)
7. [Prerequisites](#prerequisites)
8. [Installation & Setup](#installation--setup)
9. [Environment Variables](#environment-variables)
10. [Running the App](#running-the-app)
11. [Docker Deployment](#docker-deployment)
12. [API Reference](#api-reference)
13. [ML Models](#ml-models)
14. [Database Schema](#database-schema)
15. [Frontend Architecture](#frontend-architecture)
16. [Authentication Flow](#authentication-flow)
17. [Satellite Data Pipeline](#satellite-data-pipeline)

---

## Overview

Croppy is a full-stack precision agriculture platform that combines **Sentinel-2 satellite imagery**, **AI disease detection**, **IoT sensor ingestion**, and **market price data** into a single dashboard for Indian farmers.

```
┌─────────────────────────────────────────────────────────────────┐
│                         CROPPY PLATFORM                         │
│                                                                 │
│   🛰️ Sentinel-2    🤖 CNN Disease    🌦️ OpenWeather             │
│   NASA SMAP        Detection         NASA POWER                 │
│   CHIRPS Rainfall  LSTM Forecast     Agmarknet Prices           │
│         │                │                │                     │
│         └────────────────┴────────────────┘                     │
│                          │                                      │
│              ┌───────────▼────────────┐                        │
│              │   FastAPI Backend      │                        │
│              │   (Python 3.11)        │                        │
│              └───────────┬────────────┘                        │
│                          │                                      │
│              ┌───────────▼────────────┐                        │
│              │  React 19 Dashboard    │                        │
│              │  (Vite + Tailwind)     │                        │
│              └────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature Matrix

| Feature | Status | Data Source |
|---------|--------|-------------|
| Sentinel-2 NDVI / EVI / NDWI / NDRE / SAVI / BSI / NDMI maps | ✅ | Google Earth Engine |
| True Color satellite imagery | ✅ | GEE — Sentinel-2 SR |
| 90-day vegetation trend timeseries | ✅ | GEE compositing |
| CNN crop disease detection (38 classes) | ✅ | HuggingFace MobileNetV2 |
| LSTM 7-day stress forecast | ✅ | Custom LSTM model |
| Rule-based pest risk engine | ✅ | Weather + NDVI rules |
| Current weather + 7-day forecast | ✅ | OpenWeatherMap API |
| NASA SMAP soil moisture (satellite) | ✅ | GEE — SMAP L4 |
| CHIRPS rainfall (30-day) | ✅ | GEE — CHIRPS |
| Agmarknet mandi price feed | ✅ | Agmarknet scrape |
| IoT sensor ingestion (JSON) | ✅ | REST endpoint |
| Automated alert system | ✅ | Rule engine |
| PDF report generation | ✅ | ReportLab |
| Crop growth stage tracker | ✅ | Calendar-based |
| Multi-language UI (EN/HI/TE/KN) | ✅ | i18next |
| Google OAuth + email auth | ✅ | Supabase Auth |
| Field polygon drawing | ✅ | Leaflet draw |

---

## System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER DEVICES                                │
│           Browser (React SPA)  ·  Mobile Browser                    │
└─────────────────────────┬────────────────────────────────────────────┘
                          │  HTTPS
┌─────────────────────────▼────────────────────────────────────────────┐
│                     REACT DASHBOARD  (Vite / React 19)               │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │Dashboard │  │ ScanCrop │  │FieldHlth │  │ Advisory │  ...       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                      │
│  AuthContext (Supabase)  ·  i18n (4 langs)  ·  React Router v7     │
└─────────────────────────┬────────────────────────────────────────────┘
                          │  REST API calls (Axios)
┌─────────────────────────▼────────────────────────────────────────────┐
│                  FASTAPI BACKEND  (:8000)                            │
│                                                                      │
│  /api/rs/*       Remote Sensing (GEE)                               │
│  /api/ml/*       ML Inference (Disease + LSTM)                      │
│  /api/fields/*   Field CRUD (Supabase)                              │
│  /api/weather/*  Weather (OWM + NASA POWER)                         │
│  /api/alerts/*   Alert engine + ACK                                 │
│  /api/market/*   Agmarknet mandi prices                             │
│  /api/advisory/* Advisory engine                                    │
│  /api/reports/*  PDF generation (ReportLab)                         │
│  /api/sensors/*  IoT data ingestion                                 │
│  /api/auth/*     Auth helpers                                       │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────┘
       │              │              │              │
┌──────▼──┐    ┌──────▼──┐   ┌──────▼──┐   ┌──────▼──────────────┐
│  GEE    │    │HuggingFace│  │ OWM API │   │  Supabase           │
│Sentinel-2│   │MobileNetV2│  │ NASA    │   │  (PostgreSQL)       │
│SMAP/CHIRPS│  │ LSTM model│  │ POWER   │   │  Auth + Storage     │
└─────────┘    └─────────┘   └─────────┘   └─────────────────────┘
```

### Backend Module Architecture

```
backend/
├── main.py                   ← FastAPI app, CORS, router registration
│
├── core/
│   ├── config.py             ← Environment variable loading
│   ├── auth.py               ← JWT verification via Supabase
│   └── supabase_client.py    ← Supabase service-role client
│
├── routes/                   ← HTTP layer (thin controllers)
│   ├── rs.py                 ← Remote sensing endpoints
│   ├── ml.py                 ← Disease detection + LSTM
│   ├── fields.py             ← Field CRUD
│   ├── weather.py            ← Weather + forecast
│   ├── alerts.py             ← Alert list + acknowledge
│   ├── advisory.py           ← Advisory card generation
│   ├── market.py             ← Mandi price feed
│   ├── sensors.py            ← IoT sensor ingestion
│   ├── reports.py            ← PDF report generation
│   ├── onboarding.py         ← First-field setup flow
│   ├── insurance.py          ← Insurance helpers
│   └── auth.py               ← Email confirm (dev helper)
│
├── services/                 ← Business logic layer
│   ├── gee_service.py        ← All Google Earth Engine calls
│   ├── disease_detection.py  ← CNN inference pipeline
│   ├── lstm_service.py       ← LSTM forecast service
│   ├── advisory_service.py   ← Rule engine for advisories
│   ├── auto_alerts.py        ← Alert trigger rules
│   ├── pest_risk.py          ← Pest risk scoring
│   ├── weather_service.py    ← OWM + NASA POWER calls
│   └── soilgrids_service.py  ← SoilGrids API calls
│
└── models/
    └── schemas.py            ← Pydantic request/response models
```

---

## Data Flow Diagrams

### 1. Dashboard Load Flow

```
User opens Dashboard
        │
        ▼
Load fields from Supabase
        │
        ├── No fields? ──────────────────► Show "Register your first field"
        │
        ▼
Select first field (lat/lon/polygon/crop_type)
        │
        ▼
Fire 11 parallel API calls:
        │
        ├── GET /api/rs/indices        ── GEE Sentinel-2 ──► NDVI/EVI/NDWI/NDRE/SAVI/BSI/NDMI
        ├── GET /api/weather/current   ── OpenWeatherMap ──► Temp, humidity, wind, rain
        ├── GET /api/weather/forecast  ── OWM 7-day     ──► Daily temp/rain forecast
        ├── GET /api/rs/timeseries     ── GEE 90-day    ──► Vegetation trend chart
        ├── GET /api/alerts            ── Supabase      ──► Active alerts list
        ├── GET /api/alerts/summary    ── Supabase      ──► High/medium counts
        ├── GET /api/advisory          ── Rule engine   ──► Advisory cards
        ├── GET /api/rs/rainfall       ── GEE CHIRPS    ──► 30-day daily rainfall
        ├── GET /api/rs/soil-moisture  ── GEE SMAP      ──► Surface + root zone %
        ├── GET /api/market/prices     ── Agmarknet     ──► Mandi price feed
        └── GET /api/rs/thumbnail      ── GEE           ──► True color satellite image
                │
                ▼
        Render all 9 dashboard cards
```

### 2. Disease Detection Flow

```
User uploads leaf photo (JPEG/PNG/WebP)
        │
        ▼
Frontend validates file (<10 MB)
        │
        ▼
POST /api/ml/detect-disease  (multipart/form-data)
        │
        ▼
backend/services/disease_detection.py
        │
        ├── Lazy-load MobileNetV2 from HuggingFace
        │   (cached in ./ml_models/disease_hf/)
        │
        ├── PIL.Image.open → resize to 224×224
        │
        ├── MobileNetV2ImageProcessor → tensor
        │
        ├── model.forward() → logits (38 classes)
        │
        ├── softmax → confidence score
        │
        └── id2label lookup → CLASS_INFO lookup
                │
                ▼
        Return JSON:
        {
          predicted_class, confidence,
          crop, disease, severity,
          treatment, details, is_healthy
        }
                │
                ▼
        Frontend renders result card
                │
        [Not Healthy?]
                │
                ▼
        "View Full Treatment Plan" button
                │
                ▼
        TreatmentModal: What's Wrong / Symptoms /
        Step-by-Step Treatment / Prevention
```

### 3. Satellite Index Pipeline (GEE)

```
API Request: lat, lon, start_date, end_date, [polygon]
        │
        ▼
gee_service.py
        │
        ├── Build AOI
        │   ├── polygon provided? → ee.Geometry.Polygon
        │   └── point only?       → ee.Geometry.Point.buffer(500m)
        │
        ├── Filter Sentinel-2 SR collection
        │   ├── Date range filter
        │   ├── Cloud cover < 20%
        │   └── Spatial filter (AOI)
        │
        ├── Compute per-image indices:
        │   ├── NDVI  = (NIR - RED) / (NIR + RED)
        │   ├── EVI   = 2.5 * (NIR-RED) / (NIR + 6*RED - 7.5*BLUE + 1)
        │   ├── NDWI  = (GREEN - NIR) / (GREEN + NIR)
        │   ├── NDRE  = (NIR - RE) / (NIR + RE)   [red-edge band]
        │   ├── SAVI  = 1.5 * (NIR-RED) / (NIR+RED+0.5)
        │   ├── BSI   = ((SWIR+RED) - (NIR+BLUE)) / ...
        │   └── NDMI  = (NIR - SWIR) / (NIR + SWIR)
        │
        ├── Median composite → single best-quality image
        │
        ├── reduceRegion → mean value per index per AOI
        │
        ├── Classify each value into health zone:
        │   Critical / Poor / Moderate / Good / Excellent
        │
        └── Return all indices + zones as JSON
```

### 4. Authentication Flow

```
┌─────────┐         ┌──────────────┐        ┌────────────┐
│  User   │         │  React App   │        │  Supabase  │
└────┬────┘         └──────┬───────┘        └─────┬──────┘
     │                     │                      │
     │  Visit /login        │                      │
     │─────────────────────►│                      │
     │                     │                      │
     │  Enter email+pass    │                      │
     │─────────────────────►│                      │
     │                     │ signInWithPassword()  │
     │                     │──────────────────────►│
     │                     │                      │
     │                     │  JWT access_token     │
     │                     │◄──────────────────────│
     │                     │                      │
     │                     │ onAuthStateChange()   │
     │                     │ fires with session    │
     │                     │                      │
     │                     │ fetch profile row     │
     │                     │──────────────────────►│
     │                     │◄──────────────────────│
     │                     │                      │
     │                     │ Check field count     │
     │                     │──────────────────────►│
     │                     │◄──────────────────────│
     │                     │                      │
     │  0 fields?          │                      │
     │◄────────── /onboard  │                      │
     │                     │                      │
     │  Has fields?         │                      │
     │◄────────── /         │                      │
     │            (Dashboard)                      │
```

---

## Directory Structure

```
croppy/
│
├── backend/                    # Python FastAPI backend
│   ├── core/                   # Config, auth middleware, Supabase client
│   ├── routes/                 # HTTP route handlers (one file per domain)
│   ├── services/               # Business logic, ML inference, GEE calls
│   └── models/                 # Pydantic schemas
│
├── dashboard/                  # React 19 frontend
│   ├── src/
│   │   ├── components/         # Shared UI (Sidebar, Gallery, etc.)
│   │   ├── contexts/           # AuthContext (Supabase auth state)
│   │   ├── pages/              # One component per route
│   │   │   ├── Dashboard.jsx   # Main analytics dashboard
│   │   │   ├── ScanCrop.jsx    # Disease detection + treatment modal
│   │   │   ├── Landing.jsx     # Public marketing page
│   │   │   ├── Login.jsx       # Auth page
│   │   │   ├── FieldHealth.jsx # Per-field index deep dive
│   │   │   ├── Fields.jsx      # Field CRUD + polygon drawing
│   │   │   ├── Weather.jsx     # Detailed weather view
│   │   │   ├── Advisory.jsx    # Full advisory + stage calendar
│   │   │   ├── Alerts.jsx      # Alert management
│   │   │   ├── MarketPrices.jsx# Mandi price feed
│   │   │   ├── PestRisk.jsx    # Pest risk scoring
│   │   │   ├── Reports.jsx     # PDF report download
│   │   │   ├── Sensors.jsx     # IoT sensor data view
│   │   │   └── Analysis.jsx    # Historical analysis
│   │   ├── utils/
│   │   │   ├── api.js          # Axios wrappers for all API calls
│   │   │   └── supabase.js     # Supabase client init
│   │   ├── i18n.js             # i18next config (EN/HI/TE/KN)
│   │   └── main.jsx            # React entry point
│   └── package.json
│
├── ml_models/                  # Model weights (gitignored)
│   └── disease_hf/             # MobileNetV2 cached from HuggingFace
│
├── ml_training/                # Training scripts & notebooks
│
├── tests/                      # pytest test suite
│
├── requirements.txt            # Python dependencies
├── docker-compose.yml          # Full stack Docker setup
├── Dockerfile.backend          # Backend container
├── supabase_schema.sql         # DB schema definition
└── .env                        # Environment variables (never commit)
```

---

## Tech Stack

### Backend

| Layer | Technology | Version |
|-------|-----------|---------|
| Web framework | FastAPI | 0.111.0 |
| ASGI server | Uvicorn | 0.29.0 |
| Satellite data | Google Earth Engine API | 0.1.409 |
| CNN inference | PyTorch + HuggingFace Transformers | latest |
| LSTM forecasting | PyTorch | latest |
| Image processing | Pillow | latest |
| ML utilities | scikit-learn | latest |
| HTTP client | httpx | 0.27.0 |
| Database / Auth | Supabase (PostgreSQL) | 2.5.0 |
| PDF generation | ReportLab | 4.4.10 |
| Validation | Pydantic | 2.7.1 |
| Config | python-dotenv | 1.0.1 |

### Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2.0 |
| Build tool | Vite | 7.3.1 |
| Routing | React Router | 7.13.1 |
| Auth | Supabase JS | 2.99.1 |
| HTTP | Axios | 1.13.6 |
| Maps | Leaflet + React-Leaflet | 1.9.4 / 5.0.0 |
| Charts | Recharts | 3.8.0 |
| Styling | Tailwind CSS | 4.2.1 |
| Icons | Lucide React | 0.577.0 |
| i18n | i18next + react-i18next | 25.8.18 / 16.5.8 |
| Animations | Motion | 12.35.2 |
| Notifications | React Hot Toast | 2.6.0 |

### Infrastructure

| Service | Role |
|---------|------|
| Supabase | PostgreSQL database + Auth + Row Level Security |
| Google Earth Engine | Satellite imagery computation |
| OpenWeatherMap | Current weather + 7-day forecast |
| NASA POWER / SMAP | Soil moisture satellite data |
| CHIRPS | Rainfall satellite data |
| Agmarknet | Indian commodity market prices |
| HuggingFace Hub | MobileNetV2 model weights |
| Redis | Cache + future Celery task queue |
| Docker | Containerised deployment |

---

## Prerequisites

Before you begin, make sure you have the following installed and configured:

| Requirement | Minimum Version | Notes |
|------------|-----------------|-------|
| Python | 3.11+ | Used for backend |
| Node.js | 18+ | Used for frontend build |
| npm | 9+ | Package manager |
| Git | any | Version control |
| Google Earth Engine account | — | Free at earthengine.google.com |
| Supabase project | — | Free tier at supabase.com |
| OpenWeatherMap API key | — | Free tier at openweathermap.org |

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/croppy.git
cd croppy
```

### 2. Backend setup

```bash
# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install all Python dependencies
pip install -r requirements.txt

# Install PyTorch CPU build (Windows/Linux)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

### 3. Frontend setup

```bash
cd dashboard
npm install
cd ..
```

### 4. Authenticate with Google Earth Engine

```bash
# Run once to authenticate your GEE account
python -c "import ee; ee.Authenticate()"

# Follow the browser prompt, paste the token back into the terminal
# Your credentials are saved to ~/.config/earthengine/
```

### 5. Database setup

Run the schema SQL in your Supabase SQL editor:

```bash
# Copy the contents of supabase_schema.sql into:
# Supabase Dashboard → SQL Editor → New Query → Paste → Run
```

The schema creates these tables:
- `profiles` — user profile (name, role, language, state, district)
- `fields` — registered farm fields with polygon, crop type, sowing date
- `sensor_readings` — IoT sensor data ingestion
- `alerts` — auto-generated and manually created alerts
- `reports` — generated PDF report metadata

---

## Environment Variables

Create a `.env` file in the project root (copy from `.env.example` if it exists):

```env
# ── Google Earth Engine ───────────────────────────────────────────
GEE_PROJECT_ID=your-gee-project-id

# ── OpenWeatherMap ────────────────────────────────────────────────
OPENWEATHER_API_KEY=your-openweathermap-api-key

# ── Supabase (server-side, never expose to frontend) ─────────────
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# ── ML Model paths ────────────────────────────────────────────────
MODEL_PATH=./ml_models/disease_model.h5
TFLITE_MODEL_PATH=./ml_models/disease_model.tflite
```

Create a `dashboard/.env` file for the frontend:

```env
# ── Supabase (public keys, safe for browser) ─────────────────────
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# ── Backend API URL ───────────────────────────────────────────────
VITE_API_URL=http://localhost:8000
```

> ⚠️ **Never commit `.env` files.** The `.gitignore` already excludes them.

---

## Running the App

### Development mode (two terminals)

**Terminal 1 — Backend:**

```bash
# From project root, with venv activated
uvicorn backend.main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`
Swagger docs: `http://localhost:8000/docs`
ReDoc: `http://localhost:8000/redoc`

**Terminal 2 — Frontend:**

```bash
cd dashboard
npm run dev
```

The dashboard will be live at `http://localhost:5173`

### Production build

```bash
# Build the frontend
cd dashboard
npm run build
# Output is in dashboard/dist/

# Run backend in production mode
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Docker Deployment

The `docker-compose.yml` starts the full stack (backend + frontend + Redis) in containers.

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d --build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f dashboard
```

### Docker service ports

| Service | Container port | Host port |
|---------|---------------|-----------|
| FastAPI backend | 8000 | 8000 |
| React dashboard (nginx) | 80 | 3000 |
| Redis | 6379 | 6379 |

### Docker health check

The backend container has a built-in health check:
```
GET http://localhost:8000/health → { "status": "ok" }
```
The container restarts automatically if it becomes unhealthy.

---

## API Reference

All endpoints are documented at `http://localhost:8000/docs` (Swagger UI).

### Remote Sensing — `/api/rs/`

```
GET  /api/rs/indices           Compute all vegetation indices for a field
GET  /api/rs/timeseries        90-day NDVI/EVI/NDWI/NDRE time series
GET  /api/rs/thumbnail         True color Sentinel-2 image URL
GET  /api/rs/index-thumbnail   False-color spectral index image URL
GET  /api/rs/rainfall          30-day CHIRPS daily rainfall
GET  /api/rs/soil-moisture     NASA SMAP surface + root zone moisture
```

### Machine Learning — `/api/ml/`

```
POST /api/ml/detect-disease    CNN inference on uploaded leaf image
POST /api/ml/forecast          LSTM 7-day stress forecast
GET  /api/ml/yield-estimate    Yield estimation from indices
```

### Fields — `/api/fields/`

```
GET    /api/fields/             List user's fields
POST   /api/fields/             Create a new field
GET    /api/fields/{id}         Get single field
PUT    /api/fields/{id}         Update field
DELETE /api/fields/{id}         Delete field
```

### Weather — `/api/weather/`

```
GET /api/weather/current        Current conditions (OWM)
GET /api/weather/forecast       7-day daily forecast (OWM)
GET /api/weather/nasa-power     Historical climate (NASA POWER)
```

### Alerts — `/api/alerts/`

```
GET  /api/alerts/               List active alerts
POST /api/alerts/               Create manual alert
GET  /api/alerts/summary        Count by severity
POST /api/alerts/{id}/ack       Acknowledge an alert
```

### Market — `/api/market/`

```
GET /api/market/prices          Mandi prices for a crop type
```

### Advisory — `/api/advisory/`

```
GET /api/advisory/              Generate advisory cards for a field
GET /api/advisory/growth-stage  Crop growth stage for given sowing date
```

### Reports — `/api/reports/`

```
POST /api/reports/generate      Generate PDF farm report
GET  /api/reports/              List generated reports
GET  /api/reports/{id}/download Download PDF
```

### Sensors — `/api/sensors/`

```
POST /api/sensors/ingest        Ingest IoT sensor reading
GET  /api/sensors/              List sensor readings
```

---

## ML Models

### 1. CNN Disease Detection — MobileNetV2

```
Model:     linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification
Source:    HuggingFace Hub
Dataset:   PlantVillage (54,305 images, 38 classes)
Input:     224×224 RGB image
Output:    38-class probability distribution
Inference: CPU, ~300ms per image
Cache:     ./ml_models/disease_hf/
```

**Supported classes (38):**

| Crop | Diseases |
|------|----------|
| Apple | Scab, Black Rot, Cedar Rust, Healthy |
| Blueberry | Healthy |
| Cherry | Powdery Mildew, Healthy |
| Corn | Cercospora Leaf Spot, Common Rust, Northern Leaf Blight, Healthy |
| Grape | Black Rot, Esca (Black Measles), Isariopsis Leaf Spot, Healthy |
| Orange | Citrus Greening (HLB) |
| Peach | Bacterial Spot, Healthy |
| Pepper | Bacterial Spot, Healthy |
| Potato | Early Blight, Late Blight, Healthy |
| Raspberry | Healthy |
| Soybean | Healthy |
| Squash | Powdery Mildew |
| Strawberry | Leaf Scorch, Healthy |
| Tomato | Bacterial Spot, Early Blight, Late Blight, Leaf Mold, Septoria, Spider Mites, Target Spot, TYLCV, Mosaic Virus, Healthy |

### 2. LSTM Stress Forecast

```
Architecture: LSTM (sequence-to-one)
Input:        7-day NDVI + weather window
Output:       7-day stress probability forecast
Training:     ml_training/ scripts
```

### Inference Pipeline

```
User uploads image
      │
      ▼
PIL.Image.open() → convert("RGB")
      │
      ▼
MobileNetV2ImageProcessor
(resize 224×224, normalize)
      │
      ▼
MobileNetV2ForImageClassification.forward()
      │
      ▼
torch.softmax() → confidence vector
      │
      ▼
argmax → top class index
      │
      ▼
model.config.id2label[index] → class name
      │
      ▼
CLASS_INFO lookup → crop, disease, severity, treatment, details
      │
      ▼
Return JSON response
```

---

## Database Schema

```sql
-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  name        TEXT,
  role        TEXT DEFAULT 'farmer',   -- farmer | agronomist | admin
  language    TEXT DEFAULT 'en',       -- en | hi | te | kn
  phone       TEXT,
  state       TEXT,
  district    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Farm fields
CREATE TABLE fields (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  crop_type   TEXT NOT NULL,
  lat         FLOAT NOT NULL,
  lon         FLOAT NOT NULL,
  area_ha     FLOAT,
  state       TEXT,
  district    TEXT,
  polygon     JSONB,           -- [[lat, lon], ...] boundary points
  sowing_date DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- IoT sensor readings
CREATE TABLE sensor_readings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id        UUID REFERENCES fields(id) ON DELETE CASCADE,
  temperature_c   FLOAT,
  humidity_pct    FLOAT,
  soil_moisture   FLOAT,
  rainfall_mm     FLOAT,
  recorded_at     TIMESTAMPTZ DEFAULT now()
);

-- Auto-generated and manual alerts
CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  field_id      UUID REFERENCES fields(id),
  alert_type    TEXT,          -- ndvi_drop | water_stress | heat_stress | fungal_risk
  severity      TEXT,          -- high | medium | low
  message       TEXT,
  acknowledged  BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

Row Level Security (RLS) is enabled — users can only read/write their own rows.

---

## Frontend Architecture

### Component Tree

```
App
├── BrowserRouter
│   └── AuthProvider
│       ├── AppRoutes
│       │   ├── /landing        → Landing.jsx
│       │   ├── /login          → LoginRoute → Login.jsx
│       │   ├── /register       → RegisterRoute → Register.jsx
│       │   ├── /onboard        → Onboarding.jsx
│       │   └── /*              → AppShell (authenticated only)
│       │       ├── Sidebar
│       │       │   ├── NavItem (×12 routes)
│       │       │   ├── LanguageSwitcher
│       │       │   └── UserCard
│       │       └── <main>
│       │           ├── /            → Dashboard.jsx
│       │           ├── /fields      → Fields.jsx
│       │           ├── /health      → FieldHealth.jsx
│       │           ├── /scan        → ScanCrop.jsx
│       │           ├── /pest-risk   → PestRisk.jsx
│       │           ├── /weather     → Weather.jsx
│       │           ├── /alerts      → Alerts.jsx
│       │           ├── /market      → MarketPrices.jsx
│       │           ├── /advisory    → Advisory.jsx
│       │           ├── /reports     → Reports.jsx
│       │           ├── /sensors     → Sensors.jsx
│       │           └── /analysis    → Analysis.jsx
│       └── Toaster
```

### State Management

```
┌─────────────────────────────────────────────────┐
│  Global State (React Context)                   │
│                                                 │
│  AuthContext                                    │
│  ├── user          (Supabase user object)       │
│  ├── profile       (profiles table row)         │
│  ├── isAuthenticated                            │
│  ├── isDemo        (demo mode flag)             │
│  ├── loading                                    │
│  ├── signIn / signUp / signOut                  │
│  └── getToken      (JWT for API calls)          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Page-local State (useState)                    │
│  Each page manages its own data fetching        │
│  and loading states independently               │
└─────────────────────────────────────────────────┘
```

### i18n (Internationalisation)

The app supports 4 languages selectable from the sidebar:

| Code | Language | Script |
|------|----------|--------|
| `en` | English  | Latin  |
| `hi` | हिंदी (Hindi) | Devanagari |
| `te` | తెలుగు (Telugu) | Telugu |
| `kn` | ಕನ್ನಡ (Kannada) | Kannada |

All translations live in `dashboard/src/i18n.js`. Change language using the dropdown in the sidebar — it updates instantly across all translated components without a page reload.

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Auth State Machine                        │
│                                                             │
│   App starts                                                │
│       │                                                     │
│       ▼                                                     │
│   loading = true                                            │
│       │                                                     │
│       ├── sessionStorage has 'croppy_demo'?                 │
│       │         │ YES                                       │
│       │         ▼                                           │
│       │   Demo mode — set fake user, skip Supabase         │
│       │                                                     │
│       │ NO                                                  │
│       ▼                                                     │
│   supabase.auth.onAuthStateChange()                         │
│       │                                                     │
│       ├── session exists? ─── YES ──► fetchProfile()        │
│       │                              loading = false        │
│       │                              redirect to /          │
│       │                                                     │
│       └── no session? ──────────────► loading = false       │
│                                       show /login           │
│                                                             │
│   Supported login methods:                                  │
│   • Email + password                                        │
│   • Google OAuth (redirect flow)                            │
│   • Demo mode (no account needed)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Satellite Data Pipeline

### Sentinel-2 Index Computation (GEE)

```
Input: lat, lon, date_range, [polygon]
          │
          ▼
┌─────────────────────────────────────────────┐
│         Google Earth Engine                  │
│                                             │
│  1. Filter Sentinel-2 SR collection         │
│     ├── Date: start_date → end_date         │
│     ├── Bounds: AOI polygon/point           │
│     └── Cloud cover filter < 20%           │
│                                             │
│  2. Apply scale factors (÷10000)            │
│                                             │
│  3. Compute 7 spectral indices per image    │
│     NDVI, EVI, NDWI, NDRE, SAVI, BSI, NDMI  │
│                                             │
│  4. Median composite (best-of-period)       │
│                                             │
│  5. reduceRegion(mean, AOI, 10m scale)      │
│                                             │
│  6. Classify into health zones              │
│                                             │
│  7. Generate false-color PNG thumbnail URL  │
│     (for map overlay at 10m resolution)     │
└─────────────────────────────────────────────┘
          │
          ▼
    JSON Response
```

### SMAP Soil Moisture

```
NASA SMAP L4 Global Daily 9km
    │
    GEE: NASA/SMAP/SPL4SMGP/007
    │
    ├── surface_sm    (0–5 cm)  → volumetric water content
    └── subsurface_sm (5–50cm) → root zone moisture
```

### CHIRPS Rainfall

```
Climate Hazards Group InfraRed Precipitation with Station data
    │
    GEE: UCSB-CHG/CHIRPS/DAILY
    │
    └── precipitation (mm/day) → 30-day daily time series
```

---

## Running Tests

```bash
# Backend tests
pytest tests/ -v

# Test a specific module
pytest tests/test_api.py -v
pytest tests/test_ml.py -v

# Frontend lint
cd dashboard
npm run lint
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ee.EEException: Please authorize access` | Run `python -c "import ee; ee.Authenticate()"` |
| `OPENWEATHER_API_KEY not set` | Add key to `.env` and restart backend |
| Disease model downloads on first run | This is expected — ~14 MB cached to `./ml_models/disease_hf/` |
| Supabase 401 on API calls | Check `SUPABASE_SERVICE_KEY` in `.env` |
| `CORS error` in browser | Ensure backend is running on port 8000 |
| Map tiles not loading | Check internet connection; Esri satellite tiles require no API key |
| `vite: command not found` | Run `npm install` inside `dashboard/` first |

---

## License

MathWorks India · SIH Problem ID 25099

---

*Built with ❤️ for Indian farmers.*
