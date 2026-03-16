# Croppy — Full Developer Specification
### Precision Agriculture Platform for Indian Farmers
**Version 2.0 | SIH Problem ID 25099 | MathWorks India**

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [User Roles & Personas](#4-user-roles--personas)
5. [Complete User Flows](#5-complete-user-flows)
6. [Database Schema](#6-database-schema)
7. [Backend API — All Endpoints](#7-backend-api--all-endpoints)
8. [Data Sources & External APIs](#8-data-sources--external-apis)
9. [ML & AI Models](#9-ml--ai-models)
10. [Frontend Pages & Components](#10-frontend-pages--components)
11. [Feature Specifications](#11-feature-specifications)
12. [Alert System](#12-alert-system)
13. [Advisory Engine](#13-advisory-engine)
14. [Planned Enhancements (Roadmap)](#14-planned-enhancements-roadmap)
15. [Environment Variables](#15-environment-variables)
16. [Running the Application](#16-running-the-application)

---

## 1. Vision & Goals

### What is Croppy?

Croppy is an AI-powered precision agriculture platform designed specifically for Indian farmers. It combines satellite remote sensing, machine learning, IoT sensor data, and real-time weather intelligence to help farmers move from reactive to **proactive** crop management.

**Core Problem It Solves:**
- Farmers lose 30–40% of yield annually to pests, diseases, and weather events they could not predict
- Most existing tools are either too expensive, require IoT hardware, or are designed for large-scale western agriculture
- Indian farmers lack easy access to satellite data, soil health insights, and timely crop advisories in their own language

**What Makes Croppy Different:**
- Zero-cost satellite data via Google Earth Engine (Sentinel-2, MODIS, CHIRPS) — no satellite subscription needed
- Works with just a smartphone — no IoT sensors required (sensors optional)
- India-specific: covers Indian crops, Indian languages, ICAR crop calendars, government scheme integration
- Per-field polygon accuracy — farmer draws their exact field boundary, all analytics are computed for that precise plot

### Primary Goals
1. Give any Indian farmer real-time crop health status using free satellite data
2. Predict pest outbreaks 5–7 days before they occur
3. Provide actionable advisories in simple language: "Spray this today. Here's why."
4. Replace expensive agronomist visits with AI-driven guidance
5. Auto-generate farm records for insurance (PM-FASAL) and credit (KCC) applications

---

## 2. Tech Stack

### Backend
| Component | Technology | Version |
|---|---|---|
| Web Framework | FastAPI | 0.111.0 |
| Server | Uvicorn (ASGI) | Latest |
| Database | Supabase (PostgreSQL 15 + PostGIS) | Hosted |
| Remote Sensing | Google Earth Engine Python API | 0.1.409 |
| ML Framework | TensorFlow | 2.16.1 |
| HTTP Client | httpx (async) | Latest |
| Auth | Supabase JWT + PyJWT | Latest |
| Task Queue | Redis + Celery (planned) | Latest |
| Language | Python | 3.11+ |

### Frontend (Web Dashboard)
| Component | Technology | Version |
|---|---|---|
| Framework | React | 19.2.0 |
| Build Tool | Vite | 7.3.1 |
| Routing | React Router | 7.13.1 |
| Styling | Tailwind CSS | 4.2.1 |
| UI Components | Radix UI | Latest |
| Maps | Leaflet + react-leaflet | 1.9.4 / 5.0.0 |
| Charts | Recharts | 3.8.0 |
| Icons | lucide-react | 0.577.0 |
| Notifications | react-hot-toast | 2.6.0 |
| Animations | Motion (Framer Motion) | 12.35.2 |
| HTTP Client | Axios | 1.13.6 |
| DB Client | @supabase/supabase-js | 2.99.1 |

### Infrastructure
| Component | Technology |
|---|---|
| Database & Auth | Supabase (managed PostgreSQL + PostGIS + Auth) |
| Container | Docker + docker-compose |
| Web Server | Nginx (serving React build) |
| Cache | Redis |
| Satellite Data | Google Earth Engine (free tier) |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                  │
│  React Dashboard (Vite)          Future: React Native Mobile App     │
│  - Leaflet maps                  - Offline queue                     │
│  - Recharts analytics            - TFLite on-device inference        │
│  - JWT auth via Supabase         - Voice advisory                    │
└────────────────────┬─────────────────────────────────────────────────┘
                     │  HTTPS / REST API
                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       FASTAPI BACKEND                                 │
│                                                                       │
│  Routes:                    Services:                                 │
│  /api/rs      → Satellite   gee_service.py      (Sentinel-2, MODIS)  │
│  /api/ml      → AI/ML       disease_detection.py (CNN MobileNetV2)   │
│  /api/fields  → Field CRUD  pest_risk.py         (Rule engine)       │
│  /api/weather → Weather     lstm_service.py      (Stress forecast)   │
│  /api/sensors → IoT         weather_service.py   (OWM + NASA POWER)  │
│  /api/alerts  → Alert mgmt  soilgrids_service.py (Soil data)         │
│  /api/market  → Prices      agromonitoring_service.py (Polygon API)  │
│  /api/reports → PDF export                                           │
│  /api/onboarding → Analysis                                          │
└────────────────────┬─────────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────────────────────────┐
        ▼            ▼                                ▼
┌──────────────┐ ┌────────────────────────────┐ ┌─────────────────┐
│  Supabase    │ │  External APIs (Free)       │ │  GEE Platform   │
│  PostgreSQL  │ │  - OpenWeatherMap (key)     │ │  - Sentinel-2   │
│  + PostGIS   │ │  - NASA POWER (no key)      │ │  - MODIS LST    │
│  + Auth/JWT  │ │  - SoilGrids v2 (no key)   │ │  - CHIRPS Rain  │
│  + RLS       │ │  - Nominatim geocoding      │ │  - NASADEM DEM  │
└──────────────┘ └────────────────────────────┘ └─────────────────┘
```

### Data Flow (Field Analysis Request)
```
Farmer selects field
     ↓
Frontend sends field_id (polygon stored in DB)
     ↓
Backend fetches polygon [[lat,lon],...] from Supabase
     ↓
GEE builds exact polygon geometry (not circular buffer)
     ↓
Parallel requests:
  ├── Sentinel-2 → NDVI, EVI, SAVI, NDWI, NDRE, MSAVI, BSI, NDMI
  ├── CHIRPS     → 30-day daily rainfall timeseries
  ├── MODIS LST  → Land surface temperature → CWSI
  ├── NASADEM    → Elevation, slope, aspect
  └── SMAP       → Root-zone soil moisture
     ↓
All results merged into FieldAnalysis response
     ↓
Results cached in index_readings table (Supabase)
     ↓
Frontend renders charts, map overlays, advisory cards
```

---

## 4. User Roles & Personas

### 4.1 Farmer (Primary User)
**Who:** Small to medium landholding farmer (1–20 acres), 25–55 years old, likely using a smartphone

**What they need:**
- Simple health score for their field ("Is my crop OK right now?")
- Early warning before pest or disease hits
- "What should I do today?" advisory
- Photo-based disease identification
- Mandi prices for their crops

**Technical literacy:** Low. Must use simple language, Hindi/regional language support, visual indicators (colors, icons, no technical jargon).

### 4.2 Agronomist
**Who:** Agricultural extension officer, KVK (Krishi Vigyan Kendra) staff, private agronomist managing 50–500 farmers

**What they need:**
- Overview of all assigned farms at once
- Alert inbox sorted by urgency
- Ability to add notes/recommendations to farmer alerts
- Generate reports to share with farmers

**Technical literacy:** Medium-High. Comfortable with charts, tables, technical terminology.

### 4.3 Field Technician
**Who:** On-ground scout who visits farms, collects data, operates sensors

**What they need:**
- Mobile-first interface
- Offline data collection (sensor readings, disease photo upload)
- GPS-tagged field observations

### 4.4 Admin
**Who:** Platform administrator managing users, districts, crop calendars

**What they need:**
- User management
- System health monitoring
- Crop calendar database management

---

## 5. Complete User Flows

### 5.1 Onboarding Flow (New Farmer — First Time)

```
STEP 1: Register
├── Enter: Name, Email, Password
├── Select: Role (Farmer), Language, Phone, State, District
└── Submit → Account created in Supabase Auth
             Profile record created via DB trigger
             → Redirect to /onboard wizard

STEP 2: Onboarding Wizard — Step 1 (Locate Farm)
├── Search bar: type village/town/pin code
├── Nominatim geocoding → map flies to location
├── Click map to add polygon vertices
│   (each click = one corner of field boundary)
├── Drag vertices to adjust position
├── Right-click vertex to delete it
├── Area auto-calculated: e.g. "2.4 ha / 5.9 acres"
└── Continue button enabled when ≥3 vertices drawn

STEP 3: Onboarding Wizard — Step 2 (Field Details)
├── Field Name (e.g. "North Plot")
├── Crop Type (dropdown: 15 crops)
├── Crop Variety (text, optional)
├── Sowing Date (date picker)
├── Irrigation Type (6 options)
├── State + District (pre-filled from profile, editable)
└── "Analyse My Field" button

STEP 4: Onboarding Wizard — Step 3 (Auto-Analysis)
├── Loading state: "Fetching satellite data from Sentinel-2..."
├── Parallel API calls (all free, no cost):
│   ├── NDVI from GEE (last 30 days, uses actual polygon)
│   ├── CHIRPS daily rainfall (last 30 days)
│   ├── MODIS Land Surface Temperature
│   ├── NASADEM elevation + slope
│   ├── Current weather (OpenWeatherMap)
│   └── Soil type + pH (SoilGrids v2)
├── Results displayed as cards:
│   ├── NDVI Health Card: value + zone (Critical/Poor/Moderate/Good/Excellent)
│   ├── Rainfall Card: total 30-day mm + bar chart
│   ├── Temperature Card: current + LST
│   ├── Soil Card: type + pH (labeled "Estimated")
│   └── Elevation: X m above sea level, slope Y°
└── "Save Field & Go to Dashboard" button
    → Field saved to DB with polygon + area + all analysis data

STEP 5: Dashboard (First Login)
├── Welcome banner with farmer name
├── Field health summary card
├── First alert check (pest risk based on weather)
└── Prompt: "Add more fields?" link to /fields
```

### 5.2 Daily Use Flow (Returning Farmer)

```
Open App → /dashboard

Dashboard shows:
├── Top alert strip (most urgent unacknowledged alert)
├── Field health cards (one per registered field)
│   └── Click → /health?field=X (detailed view)
├── Weather widget (current + 3-day)
├── Market prices strip (user's crops)
└── NDVI trend chart (last 90 days)

Common daily actions:
├── Scan a leaf: /scan → upload photo → CNN result in 2s
├── Check pest risk: /pest-risk → see risk per field
├── View weather forecast: /weather
├── Check mandi prices: /market
└── Acknowledge alerts: /alerts
```

### 5.3 Disease Detection Flow

```
Farmer notices yellow spots on leaves
     ↓
Opens /scan page
     ↓
Clicks "Take Photo" or "Upload Image"
     ↓
Image sent to POST /api/ml/detect-disease
     ↓
MobileNetV2 CNN runs inference (38 classes)
     ↓
Result in ~2 seconds:
├── Disease name: "Tomato Late Blight"
├── Confidence: 94.3%
├── Severity: High
├── Treatment: "Apply Metalaxyl + Mancozeb @ 2.5g/L..."
└── Is healthy: false
     ↓
Option to save detection linked to a field
     ↓
If severity = High/Critical → alert created automatically
```

### 5.4 Agronomist Flow

```
Login with agronomist role
     ↓
/agronomist/alerts (triage dashboard)
├── Alert inbox (sorted by: severity × time unacknowledged)
├── Map view: all farmer fields, colored by alert severity
│   └── Heatmap: clusters of alerts in same area = outbreak
├── Click field → view field details + farmer contact
├── Actions:
│   ├── Add recommendation note
│   ├── Acknowledge on behalf of farmer
│   ├── Escalate to KVK
│   └── Generate farm report PDF
└── Weekly summary email auto-generated (planned)
```

---

## 6. Database Schema

### Tables Overview

```
public.profiles           → Extended user data (role, language, state, district)
public.fields             → Field polygons with metadata + satellite IDs
public.index_readings     → Cached satellite vegetation indices (NDVI etc.)
public.sensor_readings    → IoT sensor data (soil moisture, temp, etc.)
public.disease_detections → CNN inference results per image
public.pest_alerts        → Pest/disease alert events
public.stress_forecasts   → LSTM 7-day crop stress forecasts
public.yield_estimates    → Yield prediction per field per season
public.reports            → Generated PDF report metadata
```

### Key Table: `public.fields`

```sql
CREATE TABLE public.fields (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            text NOT NULL,
  lat             double precision NOT NULL,  -- centroid latitude
  lon             double precision NOT NULL,  -- centroid longitude
  buffer_m        int DEFAULT 1000,
  crop_type       text NOT NULL,
  sowing_date     date,
  state           text,
  district        text,
  irrigation_type text DEFAULT 'rainfed',
  geom            geometry(Point, 4326),      -- PostGIS auto-set from lat/lon
  polygon         jsonb,        -- [[lat, lon], ...] vertices drawn by farmer
  area_ha         double precision,           -- calculated area in hectares
  agro_polygon_id text,         -- reserved for external polygon service ID
  created_at      timestamptz DEFAULT now()
);
```

**Important:** When `polygon` is provided, all GEE computations use the actual polygon geometry as AOI instead of a circular buffer around `lat/lon`. This gives accurate per-field results.

### Key Table: `public.index_readings`

```sql
CREATE TABLE public.index_readings (
  id          uuid PRIMARY KEY,
  field_id    uuid REFERENCES public.fields(id) ON DELETE CASCADE,
  recorded_at timestamptz DEFAULT now(),
  source      text DEFAULT 'sentinel2',
  ndvi        double precision,   -- Normalized Difference Vegetation Index
  evi         double precision,   -- Enhanced Vegetation Index
  savi        double precision,   -- Soil-Adjusted Vegetation Index
  ndwi        double precision,   -- Normalized Difference Water Index
  ndre        double precision,   -- Normalized Difference Red Edge
  msavi       double precision,   -- Modified SAVI
  bsi         double precision,   -- Bare Soil Index
  ndmi        double precision,   -- Normalized Difference Moisture Index
  image_count int                 -- Number of Sentinel-2 images used
);
```

### Row Level Security (RLS)

All tables have RLS enabled. Users can only read/write their own data. Agronomists have read access to all fields in their assigned district.

---

## 7. Backend API — All Endpoints

### Base URL: `http://localhost:8000`
### Authentication: Bearer JWT token in `Authorization` header (Supabase session token)

---

### 7.1 Remote Sensing — `/api/rs`

#### `POST /api/rs/indices`
Compute all 8 vegetation indices for a field using Sentinel-2.

**Request:**
```json
{
  "lat": 30.9,
  "lon": 75.85,
  "start": "2026-02-01",
  "end": "2026-03-01",
  "buffer_m": 1000,
  "cloud_pct": 20
}
```

**Response:**
```json
{
  "lat": 30.9, "lon": 75.85, "start": "...", "end": "...",
  "image_count": 4,
  "indices": {
    "NDVI": {"value": 0.62, "health_zone": "Good", "description": "Healthy moderate vegetation"},
    "EVI":  {"value": 0.44, "health_zone": "Good", "description": "Healthy canopy"},
    "NDWI": {"value": 0.15, "health_zone": "Moderate", "description": "Adequate soil moisture"},
    "NDRE": {"value": 0.38, "health_zone": "Good", "description": "Healthy chlorophyll levels"},
    "SAVI": {"value": 0.58, "health_zone": "Good", "description": "..."},
    "MSAVI":{"value": 0.55, "health_zone": "Good", "description": "..."},
    "BSI":  {"value": 0.05, "health_zone": "Good", "description": "Minimal bare soil"},
    "NDMI": {"value": 0.31, "health_zone": "Good", "description": "..."}
  }
}
```

**How it works:** GEE filters Sentinel-2 SR collection by date + cloud cover (<20%), takes median composite, computes all indices using band math (B4=Red, B8=NIR, B8A=RedEdge, B11=SWIR, etc.), reduces to mean over the AOI polygon.

---

#### `POST /api/rs/timeseries`
Get NDVI/EVI/NDWI/NDRE time series (one point per satellite pass).

**Request:** Same as `/indices` but returns array of dates.

**Response:**
```json
{
  "points": [
    {"date": "2026-01-15", "ndvi": 0.45, "evi": 0.32, "ndwi": 0.12, "ndre": 0.28},
    {"date": "2026-01-25", "ndvi": 0.52, "evi": 0.38, "ndwi": 0.15, "ndre": 0.33}
  ]
}
```

---

#### `POST /api/rs/soil-moisture`
Soil moisture from NASA SMAP (10km resolution, root-zone).

**Response:** `{"surface_sm": 0.245, "subsurface_sm": 0.312, "image_count": 8, "unit": "mm"}`

---

#### `GET /api/rs/history/{field_id}`
Fetch cached historical index readings from Supabase (fast, no GEE call).

---

### 7.2 Machine Learning — `/api/ml`

#### `POST /api/ml/detect-disease`
CNN disease detection from leaf image.

**Request:** `multipart/form-data` with `file` (JPEG/PNG/WebP, max 10MB)

**Response:**
```json
{
  "predicted_class": "Tomato___Late_blight",
  "confidence": 0.943,
  "crop": "Tomato",
  "disease": "Late blight",
  "severity": "High",
  "treatment": "Apply Metalaxyl + Mancozeb @ 2.5 g/L. Improve drainage. Destroy infected tubers.",
  "is_healthy": false
}
```

**How it works:** MobileNetV2 fine-tuned on PlantVillage dataset (38 classes covering 14 crop types). Input: 224×224 RGB. Output: softmax over 38 classes. Treatment metadata hardcoded per class.

**38 classes cover:** Apple (4 diseases), Blueberry, Cherry, Corn/Maize (4), Grape (4), Orange, Peach, Pepper (2), Potato (3), Raspberry, Soybean, Squash, Strawberry, Tomato (10).

---

#### `POST /api/ml/pest-risk`
Rule-based pest risk assessment.

**Request:**
```json
{
  "lat": 30.9, "lon": 75.85,
  "crop_type": "rice",
  "air_temp": 28.5,
  "humidity": 92.0,
  "leaf_wetness": 12.0,
  "rainfall_mm": 3.0,
  "ndvi": 0.62,
  "ndvi_delta": -0.08
}
```

**Response:**
```json
{
  "crop_type": "rice",
  "overall_risk": "High",
  "alerts": [
    {
      "pest": "Rice Blast (Magnaporthe oryzae)",
      "risk_level": "High",
      "confidence": 1.0,
      "triggers": [
        "Air temperature ≥22–≤28 (actual: 28.5)",
        "Relative humidity ≥90–≤100 (actual: 92.0)",
        "Leaf wetness duration ≥10 (actual: 12.0)"
      ],
      "recommendation": "Apply Tricyclazole 75 WP @ 0.6 g/L..."
    }
  ]
}
```

**How it works:** 8 PestRule objects, each with threshold ranges for (air_temp, humidity, leaf_wetness, rainfall_mm, ndvi_delta). Rules fire when ≥25% of conditions match. Risk level = High (≥85% match), Medium (≥50%), Low (≥25%).

**Current pest rules cover:**
- Rice Blast (Magnaporthe oryzae)
- Brown Planthopper (Nilaparvata lugens)
- Wheat Rust (Puccinia spp.)
- Fall Armyworm (Spodoptera frugiperda) — Maize/Sorghum
- Cotton Bollworm (Helicoverpa armigera)
- Aphids (wheat, mustard, potato, tomato, cotton)
- Late Blight (Phytophthora infestans) — Potato/Tomato
- Powdery Mildew (wheat, grapes, mango, mustard)

---

#### `POST /api/ml/stress-forecast`
LSTM 7-day crop stress forecast.

**Request:**
```json
{
  "sequence": [
    [0.45, 0.32, 0.12, 35.0, 28.5, 72.0],
    [0.43, 0.31, 0.11, 33.0, 29.0, 74.0],
    ...
  ],
  "field_id": "optional-uuid"
}
```
*(12 time steps × 6 features: [NDVI, EVI, NDWI, soil_moisture, temp_c, humidity_pct])*

**Response:**
```json
{
  "stress_probability": 0.73,
  "severity_score": 0.61,
  "risk_level": "High",
  "forecast_days": 7
}
```

**How it works:** LSTM with 2 layers (64 units each), trained on synthetic sequences with known stress outcomes. Input shape: (12, 6). Output: single sigmoid probability + severity regression.

---

#### `POST /api/ml/yield-estimate`
Rule-based yield estimation from NDVI at flowering stage.

**Request:** `{"crop_type": "rice", "ndvi_flowering": 0.62, "soil_moisture_avg": 42.0}`

**Response:** `{"estimated_min_kg_ha": 4500, "estimated_max_kg_ha": 6500, "estimated_modal_kg_ha": 5500, "confidence": "High"}`

**Current yield tables cover:** Rice, Wheat, Maize, Cotton, Sugarcane (+ generic fallback for all others).

---

### 7.3 Fields — `/api/fields`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/fields` | Create field (with polygon registration) |
| `GET` | `/api/fields` | List all user's fields |
| `GET` | `/api/fields/{id}` | Get single field |
| `PUT` | `/api/fields/{id}` | Update field |
| `DELETE` | `/api/fields/{id}` | Delete field |

**Create field request includes:**
```json
{
  "name": "North Plot",
  "lat": 30.9234,
  "lon": 75.8523,
  "crop_type": "wheat",
  "sowing_date": "2025-11-15",
  "irrigation_type": "canal",
  "state": "Punjab",
  "district": "Ludhiana",
  "polygon": [[30.921, 75.850], [30.923, 75.855], [30.925, 75.851], [30.921, 75.850]],
  "area_ha": 2.4
}
```

---

### 7.4 Weather — `/api/weather`

| Endpoint | Source | Key Required |
|---|---|---|
| `GET /api/weather/current?lat=X&lon=Y` | OpenWeatherMap | Yes (free) |
| `GET /api/weather/forecast?lat=X&lon=Y` | OpenWeatherMap 5-day | Yes (free) |
| `GET /api/weather/historical?lat=X&lon=Y&start=...&end=...` | NASA POWER | **No** |

**Historical weather response (NASA POWER):**
```json
{
  "daily": [
    {"date": "2026-01-01", "temp_max_c": 22.3, "temp_min_c": 8.1, "rainfall_mm": 0.0, "humidity_pct": 65.2, "wind_kph": 12.4}
  ]
}
```

---

### 7.5 Sensors — `/api/sensors`

| Endpoint | Description |
|---|---|
| `POST /api/sensors/ingest` | Ingest IoT sensor reading |
| `GET /api/sensors/{field_id}/latest` | Latest reading for field |
| `GET /api/sensors/{field_id}/history?limit=50` | Historical readings |

**Sensor ingest payload:**
```json
{
  "device_id": "sensor-001",
  "field_id": "uuid",
  "soil_moisture": 38.5,
  "soil_temp": 22.1,
  "air_temp": 29.3,
  "humidity": 68.0,
  "leaf_wetness": 4.2,
  "rainfall": 12.5
}
```

---

### 7.6 Alerts — `/api/alerts`

| Endpoint | Description |
|---|---|
| `GET /api/alerts` | List alerts (filter: `?unacknowledged_only=true`) |
| `GET /api/alerts/summary` | Count by severity |
| `POST /api/alerts` | Create alert |
| `PUT /api/alerts/{id}/acknowledge` | Acknowledge alert |
| `DELETE /api/alerts/{id}` | Delete alert |

---

### 7.7 Market Prices — `/api/market`

`GET /api/market/prices?crop=wheat&state=Punjab`

Source: Agmarknet (government mandi prices). Returns daily price per quintal for the requested crop and state.

---

### 7.8 Reports — `/api/reports`

`POST /api/reports/generate` — Generates PDF field health report.

Returns: `application/pdf` blob containing:
- Field map
- Current vegetation indices
- NDVI trend chart
- Active alerts
- Recommendations

---

### 7.9 Onboarding — `/api/onboarding`

#### `POST /api/onboarding/analyze`
Runs all analysis in parallel for the onboarding wizard Step 3.

**Request:**
```json
{
  "lat": 30.9234,
  "lon": 75.8523,
  "crop_type": "wheat",
  "buffer_m": 500,
  "polygon": [[30.921, 75.850], [30.923, 75.855], ...],
  "field_name": "My Field"
}
```

**Parallel tasks:**
1. `compute_indices()` — GEE Sentinel-2 NDVI (last 30 days, uses polygon AOI)
2. `get_current_weather()` — OpenWeatherMap
3. `get_forecast()` — 5-day forecast
4. `get_soil_data()` — SoilGrids v2 REST API

**Response:**
```json
{
  "period": {"start": "2026-02-13", "end": "2026-03-15"},
  "ndvi": {
    "value": 0.58, "health_zone": "Good", "description": "...",
    "image_count": 4, "all_indices": {...}
  },
  "weather": {"temp_c": 22.4, "humidity_pct": 65, "description": "Clear sky", ...},
  "forecast": {...},
  "soil": {
    "available": true, "estimated": true,
    "ph": 7.2, "ph_desc": "Neutral — excellent for most crops",
    "soil_type": "Sandy Loam", "clay_pct": 18.5, "sand_pct": 62.3,
    "source": "SoilGrids v2 (ISRIC)", "depth": "0–5 cm"
  }
}
```

---

## 8. Data Sources & External APIs

### 8.1 Google Earth Engine (GEE) — Free, No Key for Basic Use

GEE is the backbone of Croppy's satellite analytics. All data is free under the GEE non-commercial/research license.

#### Currently Used

| Dataset | GEE ID | What it provides | Resolution | Revisit |
|---|---|---|---|---|
| Sentinel-2 SR | `COPERNICUS/S2_SR` | 8 vegetation indices | 10m | 5 days |
| SMAP Soil Moisture | `NASA_USDA/HSL/SMAP10KM_soil_moisture` | Root-zone soil moisture | 10km | Daily |

#### Planned to Add (All Free)

| Dataset | GEE ID | What it provides | Resolution | Revisit | Priority |
|---|---|---|---|---|---|
| CHIRPS Daily Rainfall | `UCSB-CHG/CHIRPS/DAILY` | Rainfall timeseries 1981–now | 5km | Daily | **P0** |
| MODIS LST | `MODIS/061/MOD11A1` | Land surface temperature → CWSI | 1km | Daily | **P0** |
| NASADEM | `NASA/NASADEM_HGT/001` | Elevation, slope, aspect | 30m | Static | **P0** |
| Sentinel-1 SAR | `COPERNICUS/S1_GRD` | High-res soil moisture | 10m | 6–12 days | P1 |
| MODIS NDVI | `MODIS/061/MOD13A1` | Daily NDVI (larger area) | 500m | 16 days | P1 |
| Landsat 8/9 | `LANDSAT/LC09/C02/T1_L2` | Long-term history (40yr) | 30m | 16 days | P1 |

#### How Polygon AOI Works in GEE
```python
# Instead of point + buffer (current):
aoi = ee.Geometry.Point(lon, lat).buffer(1000)

# Use actual farmer-drawn polygon (planned upgrade):
aoi = ee.Geometry.Polygon([[
    [pt[1], pt[0]] for pt in polygon_lat_lon  # convert to GEE [lon, lat] format
]])
```

This is critical for small farms — a 500m buffer circle overlaps neighbouring fields and gives inaccurate readings. The polygon-based AOI ensures only the farmer's exact plot is analysed.

---

### 8.2 NASA POWER API — Free, No Key Required

**URL:** `https://power.larc.nasa.gov/api/temporal/daily/point`

Provides historical daily climate data from 1984 to present at 0.5° spatial resolution (~55km). Used for historical weather analysis.

**Parameters available:** T2M (2m temperature), RH2M (relative humidity), PRECTOTCORR (corrected precipitation), WS2M (wind speed), ALLSKY_SFC_SW_DWN (solar radiation), T2MDEW (dew point).

**Typical query:**
```
GET https://power.larc.nasa.gov/api/temporal/daily/point
  ?latitude=30.9&longitude=75.85
  &start=20260101&end=20260315
  &community=AG
  &parameters=T2M,RH2M,PRECTOTCORR,WS2M
  &format=JSON
```

---

### 8.3 OpenWeatherMap — Free Tier (60 calls/min)

Used for: current conditions + 5-day/3-hour forecast.

**Endpoints used:**
- `GET https://api.openweathermap.org/data/2.5/weather` — current
- `GET https://api.openweathermap.org/data/2.5/forecast` — 5-day

**Key required:** Yes. Sign up free at openweathermap.org/api. Free tier: 60 calls/minute, 1M calls/month. Sufficient for all farming use cases.

---

### 8.4 SoilGrids v2 (ISRIC) — Free, No Key

**URL:** `https://rest.isric.org/soilgrids/v2.0/properties/query`

Provides predicted soil properties at any coordinate from 0–200cm depth at 250m resolution.

**Properties used:** `phh2o` (pH), `clay`, `sand`, `silt`, `soc` (soil organic carbon)

**Response values:** pH reported as pH×10 (divide by 10). Clay/sand/silt in cg/kg (divide by 10 for %). SOC in dg/kg (divide by 10 for %).

**Important:** These are model-predicted values, not measured. Always show "Estimated" label in UI. Good enough for fertilizer guidance; farmer should get actual soil test for precise recommendations.

**Soil texture classification used (USDA Triangle):**
- Clay ≥40% → Clay
- Sand ≥70%, Clay <15% → Sandy
- Silt ≥80% → Silty
- Clay ≥27%, Sand <45% → Clay Loam
- Clay ≥20%, Sand ≥45% → Sandy Clay Loam
- Sand ≥50%, Clay <20% → Sandy Loam
- Silt ≥50%, Clay <27% → Silt Loam
- Otherwise → Loam

---

### 8.5 Nominatim (OpenStreetMap Geocoding) — Free, No Key

**URL:** `https://nominatim.openstreetmap.org/search`

Used in PolygonMapPicker for the location search bar.

**Query:** `?q=Ludhiana&format=json&limit=5&countrycodes=in`

Returns lat/lon + display name. Map then flies to that location.

**Rate limit:** Max 1 request/second. Fine for interactive search (user types, debounced search).

---

### 8.6 Agmarknet — Government Mandi Prices

Source for agricultural commodity prices across Indian mandis (wholesale markets). Used in the `/api/market/prices` endpoint. Data includes: commodity, variety, min/max/modal price per quintal, market name, state.

---

## 9. ML & AI Models

### 9.1 Disease Detection CNN (Currently Implemented)

| Property | Value |
|---|---|
| Architecture | MobileNetV2 (fine-tuned) |
| Input | 224×224 RGB image |
| Output | Softmax over 38 classes |
| Dataset | PlantVillage (54,306 images) |
| Training | Transfer learning from ImageNet weights |
| Model size | ~14MB (H5) / ~4MB (TFLite quantized) |
| Classes | 38 (14 crops × multiple diseases + healthy variants) |

**Treatment metadata** hardcoded in `disease_detection.py` for all 38 classes — includes disease name, severity multiplier, and specific treatment recommendation per disease.

**Inference pipeline:**
```
Image bytes → PIL decode → Resize 224×224 → Normalize [0,1]
→ MobileNetV2 → Softmax → argmax
→ Lookup treatment metadata → Return DiseaseDetectionResponse
```

**TFLite fallback:** If full TF model not found, falls back to TFLite quantized model (faster, smaller, suitable for edge deployment).

---

### 9.2 LSTM Stress Forecaster (Currently Implemented)

| Property | Value |
|---|---|
| Architecture | LSTM (2 layers, 64 units each) |
| Input shape | (12, 6) — 12 time steps, 6 features |
| Features | [NDVI, EVI, NDWI, soil_moisture_pct, temp_c, humidity_pct] |
| Output | stress_probability (0–1), severity_score (0–1) |
| Forecast horizon | 7 days |
| Training data | Synthetic sequences (programmatically generated) |

**Stress probability interpretation:**
- 0.0–0.3 → Low risk
- 0.3–0.6 → Medium risk
- 0.6–1.0 → High risk

**How to prepare the 12-step sequence:** Pull last 12 Sentinel-2 observations (roughly 2 months if clear sky) for the field, combined with matched weather data from NASA POWER for the same dates.

---

### 9.3 Rule-Based Pest Engine (Currently Implemented)

8 PestRule objects, each defining:
- Target crops
- Environmental threshold ranges
- Chemical + cultural recommendation

**Scoring:** Each rule checks how many of its conditions are met. Risk level determined by ratio of matched conditions.

**Phase 2 upgrade:** Replace with CatBoost classifier trained on historical outbreak data + environmental features. Expected improvement: from ~70% recall to ~85% recall on known pest outbreaks.

---

### 9.4 Planned ML Models

#### Yield Prediction (XGBoost)
- **Features:** NDVI at V6/VT/R1 stages, accumulated GDD, total seasonal rainfall (CHIRPS), soil moisture adequacy, irrigation type
- **Target:** Actual yield (kg/ha) — collected from user feedback loop
- **Training data:** ICAR/ICRISAT historical yield records + user-reported outcomes
- **Expected accuracy:** R² > 0.75

#### Crop Stage Detection (EfficientNet-B1)
- **Input:** Leaf image + NDVI temporal curve
- **Output:** Growth stage (Germination/V3/V6/VT/R1/R3/R5/Maturity) + days until next stage
- **Why:** Timing is everything in crop management — wrong application timing = wasted input

#### Advanced Pest Forecast (CatBoost)
- **Features:** 14-day rolling weather, NDVI/NDWI, crop stage, variety susceptibility
- **Output:** Per-pest probability for next 7/14 days
- **Training:** Augment rule-based outputs with historical outbreak confirmation from users

#### Irrigation Demand (LSTM-CNN Hybrid)
- **Input:** Weather forecast + CWSI (from MODIS LST) + crop stage + soil type
- **Output:** ET_crop (mm/day) for next 10 days → irrigation schedule
- **Reference:** FAO-56 Penman-Monteith as baseline; ML corrects for local conditions

---

## 10. Frontend Pages & Components

### 10.1 Public Pages

#### `/landing`
Marketing landing page. Shows features, crop health animation (satellite tiles), CTA buttons for register/login.

#### `/login`
Email + password login. Google OAuth via Supabase. Redirects authenticated users to `/`.

#### `/register`
Full registration form:
- Name, email, password (×2 confirm)
- Role selector (Farmer / Agronomist / Admin)
- Language (7 Indian languages)
- Phone, state, district
- Google OAuth option
- On success: redirects to `/onboard`

---

### 10.2 Onboarding Wizard — `/onboard`
(New user, runs once after registration)

**Step 1: Locate Farm**
- Nominatim search bar (search by village/town/pin)
- Map flies to searched location
- Drawing mode toggle: "Draw Boundary" button
- Click on map = adds polygon vertex
- Right-click vertex = delete it
- Green polygon rendered as vertices are added
- Area auto-calculated and shown ("2.4 ha / 5.9 acres")
- Continue button enabled at ≥3 vertices

**Step 2: Field Details**
- Field name (free text)
- Crop type (dropdown, 15 crops)
- Crop variety (optional text)
- Sowing date (date picker)
- Irrigation type (6 options)
- State + district (pre-filled from profile)

**Step 3: Auto-Analysis (blocks until complete)**
- Loading spinner: "Fetching satellite data from Sentinel-2…"
- Sub-text: "Checking weather · Estimating soil type · Running NDVI…"
- Result cards (displayed after all 4 API calls complete):
  - NDVI health card: large number + colored zone badge + description
  - Weather card: temp, humidity, wind, description
  - Soil card: soil type + pH + clay/sand/silt breakdown + "Estimated" label
  - (Future: rainfall chart, LST card, elevation card)
- "Save Field & Go to Dashboard" button

---

### 10.3 Authenticated Pages (Protected, require login)

#### `/` — Dashboard
Main overview page:
- Alert strip at top (most urgent unacknowledged alert)
- Summary cards: total fields, active alerts, average NDVI
- NDVI + EVI trend chart (Recharts, 90-day line chart)
- Field health table (list of fields with NDVI zone badges)
- Recent alerts table
- Weather widget (current conditions)
- Market prices strip

#### `/fields` — My Fields
Field management page:
- Overview map (Leaflet): shows all fields as polygons (or markers if no polygon)
- Add Field button → expands form with PolygonMapPicker
- Field table: name, crop, area (ha), state, sowing date, irrigation, actions
- Actions: View health (→ /health), Delete

#### `/health` — Field Health
Detailed satellite analytics for a selected field:
- Field selector dropdown
- Date range picker (default: last 90 days)
- 8 index cards (NDVI, EVI, SAVI, NDWI, NDRE, MSAVI, BSI, NDMI) with values + color zones
- Recharts line chart: NDVI/EVI/NDWI/NDRE over time
- Satellite info explanation panel

#### `/scan` — Scan Crop (Disease Detection)
- Large upload area (drag + drop or click to upload)
- Field selector (link detection to a field, optional)
- CNN result card: disease name + confidence bar + severity badge + treatment text
- Detection history table
- Camera capture on mobile (file input type=camera)

#### `/pest-risk` — Pest Risk
- Field selector
- Manual weather input form (if no IoT sensor): temp, humidity, leaf wetness, rainfall
- Auto-fill from live weather (button: "Use current weather")
- NDVI auto-filled from latest satellite data
- Risk results: overall risk badge + list of pest alerts with triggers + recommendations

#### `/weather` — Weather
- Current weather card: temp, humidity, wind, description, rainfall
- 5-day forecast cards (Recharts BarChart for rainfall, LineChart for temp)
- Location auto-detected from user's district

#### `/alerts` — Alerts
- Filter bar: All / Unacknowledged / By severity
- Alert cards: field name, alert type, severity badge, message, triggered at
- Acknowledge button on each card
- Bulk acknowledge option

#### `/market` — Market Prices
- Crop selector (15 crops)
- State selector
- Price chart (Recharts): last 30 days price trend
- Current price table: market, variety, min/max/modal price
- Price unit: ₹/quintal

---

### 10.4 Key Reusable Components

#### `PolygonMapPicker.jsx`
Map component with drawing capability. Used in Onboarding and Fields pages.

**Props:**
- `value: [[lat, lon], ...]` — current polygon vertices
- `onChange: (points) => void` — called on every point change
- `center: [lat, lon]` — initial map center

**Features:**
- Nominatim geocoding search bar
- "Draw Boundary" toggle button
- Click-to-add vertices when in drawing mode
- Green polygon rendered between vertices
- Right-click vertex to delete
- Area calculation (Shoelace formula + Haversine conversion)
- Area displayed as "X.XX ha / X.XX acres"
- Green border glow on map when in drawing mode

**Area calculation (no external library):**
```javascript
function polygonAreaHa(coords) {
  const R = 6371000;  // Earth radius
  const centerLat = average(coords.map(c => c[0]));
  const latM = (π × R) / 180;          // meters per degree latitude
  const lonM = latM × cos(centerLat);  // meters per degree longitude at this latitude
  // Convert to meters, apply Shoelace formula, convert m² to ha
}
```

#### `Sidebar.jsx`
Navigation sidebar with links to all authenticated pages. Shows user name, role badge, logout button.

#### `AuthContext.jsx`
React context providing: `user`, `profile`, `isAuthenticated`, `loading`, `signUp()`, `signIn()`, `signOut()`, `updateProfile()`, `getToken()`, `displayName`, `role`.

---

## 11. Feature Specifications

### 11.1 Vegetation Indices — Complete Reference

All computed from Sentinel-2 SR bands. Scale factor: raw values ÷ 10000 = reflectance (0–1).

| Index | Formula | Bands Used | What it measures |
|---|---|---|---|
| NDVI | (B8−B4)/(B8+B4) | NIR, Red | Overall vegetation vigor |
| EVI | 2.5×(B8−B4)/(B8+6×B4−7.5×B2+1) | NIR, Red, Blue | Vegetation vigor (reduced soil/atmosphere noise) |
| SAVI | 1.5×(B8−B4)/(B8+B4+0.5) | NIR, Red | For sparse vegetation (corrects soil brightness) |
| NDWI | (B3−B8)/(B3+B8) | Green, NIR | Water content / irrigation status |
| NDRE | (B8A−B5)/(B8A+B5) | RedEdge, NIR narrow | Chlorophyll content (early stress signal, 2–3 weeks ahead of NDVI) |
| MSAVI | [2×B8+1−√((2×B8+1)²−8×(B8−B4))]/2 | NIR, Red | Enhanced soil adjustment |
| BSI | (B11+B4−B8−B2)/(B11+B4+B8+B2) | SWIR, Red, NIR, Blue | Bare soil exposure / erosion risk |
| NDMI | (B8−B11)/(B8+B11) | NIR, SWIR | Crop water stress indicator |

**Health zones per index (NDVI example):**

| Range | Zone | Description |
|---|---|---|
| −1.0 to 0.1 | Critical | Bare soil or water — no vegetation |
| 0.1 to 0.2 | Poor | Very sparse or severely stressed vegetation |
| 0.2 to 0.4 | Moderate | Sparse to moderate vegetation, possible stress |
| 0.4 to 0.6 | Good | Healthy moderate vegetation |
| 0.6 to 1.0 | Excellent | Dense, highly vigorous vegetation |

**Important interpretation notes:**
- NDRE responds 2–3 weeks earlier than NDVI to nutrient/water stress → use for early warning
- NDWI < −0.3 → severe drought stress → trigger irrigation alert immediately
- BSI > 0.2 → soil erosion risk → alert farmer about cover crop or mulching
- NDMI sudden drop → crop water stress even if NDVI still looks OK

---

### 11.2 Planned: CHIRPS Rainfall Integration

**GEE Dataset:** `UCSB-CHG/CHIRPS/DAILY`
**Coverage:** Global, 1981–present, 5km resolution, India excellent coverage
**Key requirement:** No API key, completely free, runs in GEE

**New endpoint:** `POST /api/rs/rainfall`

**Request:**
```json
{"lat": 30.9, "lon": 75.85, "start": "2026-01-01", "end": "2026-03-15"}
```

**Response:**
```json
{
  "total_mm": 87.4,
  "daily": [
    {"date": "2026-01-01", "rainfall_mm": 0.0},
    {"date": "2026-01-15", "rainfall_mm": 12.3}
  ],
  "monthly_summary": [
    {"month": "2026-01", "total_mm": 24.5},
    {"month": "2026-02", "total_mm": 38.1},
    {"month": "2026-03", "total_mm": 24.8}
  ],
  "source": "CHIRPS Daily (UCSB-CHG)"
}
```

**GEE implementation:**
```python
def get_chirps_rainfall(lat, lon, start, end, polygon=None):
    aoi = polygon_to_gee(polygon) if polygon else ee.Geometry.Point(lon, lat).buffer(5000)
    chirps = (ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
              .filterBounds(aoi)
              .filterDate(start, end)
              .select("precipitation"))
    # Map over collection to extract daily values
    def extract_daily(image):
        val = image.reduceRegion(ee.Reducer.mean(), aoi, 5000).get("precipitation")
        return ee.Feature(None, {"date": image.date().format("YYYY-MM-dd"), "rainfall_mm": val})
    return chirps.map(extract_daily).getInfo()["features"]
```

**UI use:** Rainfall bar chart in FieldHealth page + Onboarding Step 3 card.

---

### 11.3 Planned: MODIS Land Surface Temperature + CWSI

**GEE Dataset:** `MODIS/061/MOD11A1` (Terra daily LST) + `MODIS/061/MYD11A1` (Aqua daily LST)
**Resolution:** 1km, daily revisit
**Key requirement:** Free via GEE

**CWSI (Crop Water Stress Index):**
```
CWSI = (LST_actual − LST_wet) / (LST_dry − LST_wet)
```
- LST_wet = LST of well-watered crop (no stress) ≈ air temperature − 2°C
- LST_dry = LST of water-stressed crop ≈ air temperature + 4°C
- CWSI = 0 → no stress, CWSI = 1 → maximum stress

**Irrigation trigger:** If CWSI > 0.5 and irrigation type ≠ rainfed → trigger "IRRIGATE NOW" alert.

**New endpoint:** `POST /api/rs/land-surface-temp`

**Response:**
```json
{
  "lst_celsius": 34.7,
  "cwsi": 0.62,
  "stress_level": "High",
  "irrigation_recommended": true,
  "source": "MODIS MOD11A1",
  "date": "2026-03-14"
}
```

---

### 11.4 Planned: NASADEM Elevation + Terrain Analysis

**GEE Dataset:** `NASA/NASADEM_HGT/001`
**Resolution:** 30m, global, static (one-time computation per field)
**Key requirement:** Free via GEE

**New endpoint:** `GET /api/rs/topography?lat=X&lon=Y` (or by field_id)

**Response:**
```json
{
  "elevation_m": 247.3,
  "slope_deg": 2.1,
  "aspect_deg": 185.0,
  "aspect_description": "South-facing",
  "topographic_wetness_index": 6.8,
  "source": "NASADEM 30m",
  "agricultural_notes": "Gentle south-facing slope — good for winter crops. Low waterlogging risk."
}
```

**Why this matters:**
- Slope > 5° → erosion risk → alert for cover crop/contour farming
- North-facing slope → less solar radiation → adjust crop variety recommendation
- High TWI zones → naturally wet → reduce irrigation in those zones
- Elevation affects microclimate → adjust frost risk threshold

---

### 11.5 Planned: Advisory Engine

The advisory engine generates actionable recommendations based on current field conditions. No ML training required — pure rule-based with crop calendar data.

**Core concept:** Combine (crop stage) + (current conditions) → specific recommendation

**Example output for a wheat farmer in Punjab on day 45 after sowing:**
```
Crop Stage: Tillering (45 days after sowing, expected)
Current NDVI: 0.41 (Good)
Current weather: 22°C, 68% RH, last rain 5 days ago

Advisory Cards:
🌾 FERTILIZER: Apply 2nd dose of Urea (30 kg/ha) this week.
   Tillering stage is critical for tiller number.
   Do not delay beyond day 50.

💧 IRRIGATION: Irrigate in 2 days (40mm). Last rain was 5 days ago,
   soil moisture declining. Optimal window before jointing stage.

🐛 PEST WATCH: Aphid risk Medium. Temp 22°C + RH 68% creates
   favorable conditions. Scout lower leaves 2×/week.
   No spray needed yet — economic threshold not reached.

⚠️ FORECAST ALERT: Rain expected in 72 hours (18mm).
   Do NOT spray pesticides within 24h of rain — will wash off.
   If planning spray, do it today before 9am.
```

**Crop calendar database (to embed as JSON):**
Covers 15 crops × 28 states × key growth stages × input recommendations.
Source: ICAR publications, state agricultural university recommendations, ICRISAT data.

---

### 11.6 Planned: Spatial Zoning (Hotspot Detection Within Field)

Instead of a single NDVI value for the whole field, divide the field into 50m × 50m grid cells and compute NDVI per cell. Identify zones that are significantly below the field average — these are "problem spots" that need attention.

**How it works:**
1. GEE: `image.reduceToVectors()` on the field polygon at 50m scale
2. Each vector feature has its own NDVI value
3. Flag cells where NDVI < (field_mean − 0.15) as stress hotspots
4. Export as GeoJSON FeatureCollection

**UI:** Leaflet heatmap overlay using cell centroids + values. Color ramp: red (critical) → yellow → green (excellent). Farmer can see exactly which corner of their field is struggling.

**New endpoint:** `GET /api/rs/zone-map?field_id=X&date=YYYY-MM-DD`

---

### 11.7 Planned: Government Scheme Integration

#### PM-FASAL Crop Insurance
When yield estimate is significantly below historical average → flag as "Insurance Claim Eligible":
```
Estimated yield: 3,200 kg/ha
Historical average: 4,500 kg/ha for wheat in Ludhiana
Shortfall: 29% — PM-FASAL claim threshold is 20%
→ Alert: "Eligible for insurance claim"
→ Action: Generate claim document (PDF) with:
   - Field GPS coordinates
   - NDVI at flowering (satellite evidence)
   - Rainfall during growing season (CHIRPS data)
   - Yield estimate
```

#### Soil Health Card
Allow farmer to upload soil test PDF → OCR extracts NPK/pH values → stored in DB → used to improve fertilizer recommendations automatically.

#### Farm Record for KCC
Auto-generate PDF farm record from Croppy data (field area, crop, sowing date, estimated yield, insurance status) → ready to submit to bank for Kisan Credit Card application.

---

## 12. Alert System

### Alert Types

| Type | Trigger | Severity |
|---|---|---|
| `pest_risk_high` | Pest risk engine: High | High |
| `pest_risk_medium` | Pest risk engine: Medium | Medium |
| `disease_detected` | CNN confidence > 80%, severity High/Critical | High |
| `ndvi_drop` | NDVI drops > 0.15 in 7 days | High |
| `drought_stress` | NDWI < −0.3 | High |
| `irrigation_needed` | CWSI > 0.5 (planned) | Medium |
| `frost_risk` | T_min < 2°C during growing season | High |
| `spray_warning` | Rain forecast > 20mm in 48h | Medium |
| `index_reading` | New satellite data available | Info |

### Alert Deduplication
Same alert type for same field within 24 hours → not duplicated.

### Planned: Alert Escalation
```
T+0:   Alert sent to farmer (push notification)
T+24h: If unacknowledged → send SMS + alert assigned agronomist
T+48h: If still unacknowledged → flag as URGENT, notify KVK contact
T+72h: Log as "outcome unknown" for model feedback
```

### Planned: Multi-Channel Delivery
1. Push notification (Firebase FCM) — primary
2. SMS (Twilio / MSG91) — fallback
3. WhatsApp Business API — preferred for India (high penetration)
4. Email — tertiary
5. Quiet hours: 10pm–6am (configurable)

---

## 13. Advisory Engine

### Weather Advisory Cards (Rule-Based, Immediate Value)

| Condition | Advisory | Color |
|---|---|---|
| Rain > 30mm forecast in 48h | "Do NOT spray pesticides — will wash off" | Red |
| Rain > 10mm in 24h | "Good time for sowing/transplanting" | Green |
| T_max > 38°C | "Heat stress: increase irrigation frequency" | Red |
| T_min < 2°C | "Frost risk: cover seedlings, delay harvest" | Red |
| RH_avg > 85% for 3 days | "Fungal disease risk high: inspect leaves" | Yellow |
| Wind > 40 km/h | "Avoid spraying — pesticide drift" | Yellow |
| No rain > 14 days + NDWI < 0 | "Drought stress developing: irrigate now" | Red |

### Crop Stage Calendar (Phase 1 — 15 crops)

For each crop, store the typical days-after-sowing for each growth stage and what action to take:

```
Crop: Wheat (Punjab variety HD 2967)
Sowing: Day 0
├── Day 7–12:    Germination → check establishment, gap filling if <80% germination
├── Day 15–25:   Crown root initiation → 1st irrigation (if rainfed: monitor soil moisture)
├── Day 25–45:   Tillering → Apply 2nd dose N (Urea 30 kg/ha), scout for aphids
├── Day 45–60:   Jointing → Critical irrigation period
├── Day 60–75:   Booting → Apply fungicide if rust signs visible
├── Day 75–90:   Heading/Flowering → Do NOT irrigate during pollen shedding
│               → Critical: 3 days water stress here → 20% yield loss
├── Day 90–120:  Grain filling → Monitor for aphids, keep irrigation light
└── Day 110–130: Maturity → Harvest when grain moisture < 14%
```

---

## 14. Planned Enhancements (Roadmap)

### Phase 1 — Core Data Layer (Immediate, All Free)
- [ ] Remove Agromonitoring dependency completely
- [ ] Use actual farmer polygon as GEE AOI (replace point + buffer)
- [ ] Add CHIRPS daily rainfall endpoint + chart in UI
- [ ] Add MODIS LST + CWSI endpoint + irrigation alert
- [ ] Add NASADEM elevation + slope endpoint
- [ ] GEE RGB true-color thumbnail (satellite preview of field)

### Phase 2 — Advisory Engine (High Impact, Rule-Based)
- [ ] Crop calendar database (15 crops × 28 states as YAML)
- [ ] Weather advisory cards on Dashboard
- [ ] Growth stage timeline (Gantt chart in FieldHealth page)
- [ ] Fertilizer recommendation from soil test
- [ ] IPM pest management strategy (monitor → cultural → biological → chemical)
- [ ] Harvest timing advisor (NDVI decline + weather + mandi price)

### Phase 3 — Dashboard Enhancements
- [ ] Spatial zoning heatmap (hotspot detection within field)
- [ ] Year-over-year NDVI comparison chart
- [ ] Anomaly detection markers on timeseries
- [ ] Sensor map layer on field overview
- [ ] Agronomist triage dashboard (`/agronomist/alerts`)
- [ ] Alert escalation + outcome tracking

### Phase 4 — ML Upgrades
- [ ] XGBoost yield prediction (replace static lookup table)
- [ ] CatBoost pest forecast (replace rule-based engine)
- [ ] Disease detection ensemble (3 models, uncertainty quantification)
- [ ] Crop stage detection from leaf image + NDVI curve (EfficientNet-B1)
- [ ] LSTM-CNN irrigation demand model

### Phase 5 — India-Specific
- [ ] PM-FASAL insurance claim document generation
- [ ] Soil Health Card PDF upload + OCR extraction
- [ ] Farm record PDF for KCC application
- [ ] PWA (Progressive Web App) for offline access
- [ ] SMS + WhatsApp alert delivery (Twilio / MSG91)
- [ ] Hindi + regional language UI translation
- [ ] Alert escalation to agronomist + KVK

### Phase 6 — Advanced (v3.0)
- [ ] Sentinel-1 SAR-based soil moisture (10m resolution)
- [ ] Satellite RGB thumbnail as map overlay (true-color field view)
- [ ] Drone imagery integration (upload orthomosaic)
- [ ] Multi-season comparison (crop rotation planning)
- [ ] Carbon credit tracking (soil organic carbon from GEE)
- [ ] Voice advisory (offline STT/TTS in 5 Indian languages)

---

## 15. Environment Variables

### Backend (`.env`)
```bash
# Google Earth Engine
GEE_PROJECT_ID=croppy-471110

# Weather (required for current weather + forecast)
OPENWEATHER_API_KEY=your_key_here          # free at openweathermap.org/api

# Supabase (PostgreSQL + Auth)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=eyJ...               # service_role key (never expose publicly)
SUPABASE_JWT_SECRET=your_jwt_secret       # from Supabase → Settings → API

# ML Models (paths to trained model files)
MODEL_PATH=./ml_models/disease_model.h5
TFLITE_MODEL_PATH=./ml_models/disease_model.tflite
```

### Frontend (`.env` in `dashboard/`)
```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...             # anon key (safe to expose in frontend)
```

### Keys That Are Completely Free (No Credit Card)
- `GEE_PROJECT_ID` — register at earthengine.google.com (free for research/non-commercial)
- NASA POWER API — no key needed at all
- SoilGrids v2 — no key needed at all
- Nominatim geocoding — no key needed at all
- Agmarknet — government open data

---

## 16. Running the Application

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Earth Engine authenticated (`earthengine authenticate`)
- Supabase project created + schema applied

### Apply Database Schema
In Supabase SQL Editor, run `supabase_schema.sql` in full. This creates all tables, triggers, RLS policies, and indexes.

If tables already exist (re-run), the migration section at the bottom safely adds new columns:
```sql
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS polygon jsonb;
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS area_ha double precision;
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS agro_polygon_id text;
```

### Start Backend
```bash
cd /path/to/croppy
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

API docs available at: `http://localhost:8000/docs` (Swagger UI)

### Start Frontend
```bash
cd dashboard
npm install
npm run dev
# App available at: http://localhost:5173
```

### Docker (Production)
```bash
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

### GEE Authentication
If GEE auth expires:
```bash
earthengine authenticate
# Follow browser prompt to authorize
# Credentials stored at ~/.config/earthengine/credentials
```

---

## Appendix A — Supported Crops

| Crop | Diseases (CNN) | Pests (Rules) | Yield Table | Calendar |
|---|---|---|---|---|
| Rice / Paddy | Bacterial Leaf Blight | Blast, Brown Planthopper | ✓ | ✓ |
| Wheat | Leaf Rust, Powdery Mildew | Rust, Aphids, Mildew | ✓ | ✓ |
| Maize / Corn | Gray Leaf Spot, Northern Blight, Common Rust, Cercospora | Fall Armyworm | ✓ | ✓ |
| Cotton | — | Bollworm, Aphids | ✓ | — |
| Potato | Early Blight, Late Blight | Late Blight, Aphids | — | — |
| Tomato | 9 diseases incl. Yellow Leaf Curl | Late Blight, Aphids | — | — |
| Sugarcane | — | — | ✓ | — |
| Soybean | Frogeye Leaf Spot | — | — | — |
| Groundnut | — | — | — | — |
| Mustard | Powdery Mildew | Aphids | — | — |
| Onion | — | — | — | — |
| Chickpea | — | — | — | — |
| Lentil | — | — | — | — |
| Sunflower | — | — | — | — |
| Barley | — | — | — | — |

---

## Appendix B — GEE Satellite Band Reference (Sentinel-2)

| Band | Name | Wavelength | Resolution | Used For |
|---|---|---|---|---|
| B2 | Blue | 490nm | 10m | EVI (atmosphere correction) |
| B3 | Green | 560nm | 10m | NDWI (water content) |
| B4 | Red | 665nm | 10m | NDVI, EVI, SAVI, BSI |
| B5 | Red Edge 1 | 705nm | 20m | NDRE (chlorophyll) |
| B8 | NIR Broad | 842nm | 10m | NDVI, EVI, NDWI, NDMI, BSI |
| B8A | NIR Narrow | 865nm | 20m | NDRE |
| B11 | SWIR 1 | 1610nm | 20m | BSI, NDMI |
| B12 | SWIR 2 | 2190nm | 20m | future: burn ratio |

All bands raw values are integers 0–10000 representing reflectance × 10000. GEE service divides by 10000 before computing indices.

---

*Document version: 2.0 | Last updated: March 2026 | Croppy | SIH 25099*
