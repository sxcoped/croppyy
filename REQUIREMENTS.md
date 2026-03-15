# Croppy — Requirements Document
> AI-powered crop health, soil condition & pest risk monitoring platform
> SIH Problem ID: 25099 | MathWorks India | Theme: Agriculture, FoodTech & Rural Development

---

## 1. Project Overview

Croppy is a unified precision agriculture platform that ingests satellite imagery, hyperspectral/multispectral data, and IoT sensor readings to deliver real-time, field-level insights on crop health, soil conditions, and pest risks. It uses AI/ML models (CNN, LSTM) to detect anomalies, predict stress zones, and generate actionable recommendations — shifting farmers from reactive to proactive crop management.

**Target Users:**
- Farmers (primary) — mobile app, vernacular UI, voice support
- Agronomists & Researchers — web dashboard with maps, trends, exports
- Field Technicians — tablet-friendly inspection tool

---

## 2. Core Modules

### 2.1 Satellite & Remote Sensing Pipeline
### 2.2 IoT Sensor Integration
### 2.3 AI/ML Engine
### 2.4 Farmer Mobile App (React Native)
### 2.5 Agronomist Web Dashboard (React + Leaflet)
### 2.6 Backend API (Flask/FastAPI)
### 2.7 Database Layer
### 2.8 Notification & Alert System

---

## 3. Functional Requirements

---

### Module 1 — Satellite & Remote Sensing Pipeline

#### 1.1 Image Ingestion
- Ingest Sentinel-2 Level-2A multispectral imagery via Google Earth Engine Python API
- Support Landsat 8/9 as fallback for historical data
- Filter by cloud cover threshold (< 30% by default, configurable)
- Support user-defined field polygons (GeoJSON) or point + buffer radius
- Date range selection for temporal analysis (single snapshot or multi-date series)

#### 1.2 Vegetation Indices
Compute the following indices from Sentinel-2 bands:

| Index | Formula | Sentinel-2 Bands | Purpose |
|-------|---------|-----------------|---------|
| NDVI | (B8 - B4) / (B8 + B4) | NIR, Red | Overall vegetation health |
| EVI | 2.5 * (B8 - B4) / (B8 + 6*B4 - 7.5*B2 + 1) | NIR, Red, Blue | Enhanced, reduces soil/atmosphere noise |
| SAVI | 1.5 * (B8 - B4) / (B8 + B4 + 0.5) | NIR, Red | Soil-adjusted (sparse vegetation areas) |
| NDWI | (B3 - B8) / (B3 + B8) | Green, NIR | Water content / irrigation status |
| NDRE | (B8A - B5) / (B8A + B5) | NIR narrow, Red edge | Early stress detection (before NDVI drops) |
| MSAVI | (2*B8 + 1 - sqrt((2*B8+1)^2 - 8*(B8-B4))) / 2 | NIR, Red | Modified soil-adjusted |
| BSI (Bare Soil) | ((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2)) | SWIR, Red, NIR, Blue | Soil exposure / erosion |
| NDMI (Moisture) | (B8 - B11) / (B8 + B11) | NIR, SWIR | Crop water stress |

#### 1.3 Spectral Health Maps
- Generate spatial raster maps for each index over the field polygon
- Classify into 5 health zones: Critical / Poor / Moderate / Good / Excellent
- Overlay on interactive map (Leaflet in dashboard, static image in mobile app)
- Export as GeoTIFF and PNG

#### 1.4 Temporal Trend Analysis
- Collect index time series at key crop growth stages
- Detect anomalies: sudden NDVI drop, sustained low EVI, rising BSI
- LSTM model trained on historical index sequences to predict next-period stress probability
- Output: trend chart (time vs NDVI/EVI), growth stage classification, 7-day forecast

#### 1.5 Soil Moisture
- Use Sentinel-1 SAR (GEE: `COPERNICUS/S1_GRD`) VV/VH polarization for surface soil moisture proxy
- Use NASA SMAP (GEE: `NASA_USDA/HSL/SMAP10KM_soil_moisture`) for root-zone moisture
- Combine with NDMI for corroborated water stress estimate

---

### Module 2 — IoT Sensor Integration

#### 2.1 Supported Sensor Types
- Soil moisture (volumetric water content)
- Soil temperature (5 cm, 15 cm depth)
- Air temperature & relative humidity (DHT22 / SHT31)
- Leaf wetness sensor (LWS)
- Rainfall (tipping bucket gauge)
- Light intensity (PAR sensor, optional)

#### 2.2 Data Ingestion
- REST API endpoint: `POST /api/sensors/ingest` — accepts JSON payload from any microcontroller (ESP32, Arduino with WiFi shield)
- MQTT broker support (Mosquitto) for real-time streaming
- Sensor readings stored with timestamp, device ID, field ID, GPS coordinates

#### 2.3 Sensor Fusion
- Combine sensor readings with satellite-derived indices for joint risk scoring
- When satellite data is unavailable (cloud cover), sensor data becomes primary signal
- Interpolate sparse sensor networks using Kriging or IDW spatial interpolation

---

### Module 3 — AI / ML Engine

#### 3.1 Disease Detection — CNN (Leaf Image Classifier)
**Model:** MobileNetV2 or EfficientNet-B0 (transfer learning, fine-tuned on PlantVillage)
**Dataset:** PlantVillage (54,309 images, 38 classes across 14 crops)
**Input:** RGB leaf image (224x224)
**Output:** Disease class + confidence score + recommended treatment
**Supported crops (priority for Indian context):** Rice, Wheat, Maize, Tomato, Potato, Cotton, Sugarcane
**Deployment:** TensorFlow Lite model served via Flask endpoint; `.tflite` embedded in mobile app for offline inference

Training pipeline:
- Data augmentation: rotation, flip, brightness jitter, zoom
- Class balancing: oversampling minority diseases
- Validation: 80/10/10 train/val/test split
- Target accuracy: > 90% top-1 on PlantVillage test set

#### 3.2 Temporal Stress Prediction — LSTM
**Input:** 12-timestep sequence of [NDVI, EVI, NDWI, soil_moisture, temp, humidity] per field
**Output:** Binary stress flag for next 7 days + severity score (0–1)
**Training data:** Simulate from GEE historical Sentinel-2 + NASA POWER weather
**Architecture:** 2-layer LSTM (64, 32 units) → Dense(1, sigmoid)
**Loss:** Binary cross-entropy | **Optimizer:** Adam

#### 3.3 Pest Risk Prediction — Rule-Based + ML Hybrid
**Phase 1 (MVP):** Rule-based threshold system:
- Rice blast: temp 22–28°C + RH > 90% + leaf wetness > 10 hrs → HIGH risk
- Aphids: temp > 25°C + low humidity + rapid NDVI drop → MEDIUM risk
- Armyworm: temp 25–35°C + recent rainfall + NDVI decline → HIGH risk
- Brown planthopper: flooded field conditions + RH > 85%

**Phase 2 (post-MVP):** Random Forest classifier trained on historical outbreak records + environmental features
**Output:** Per-field pest risk map with 3-level alert (Low / Medium / High) + recommended pesticide/action

#### 3.4 Yield Score Estimation
**Method:** Regression model using:
- Current NDVI at flowering/grain-fill stage
- Historical yield data for the region (state-level from data.gov.in)
- Soil moisture adequacy during critical growth stages
- GDD (Growing Degree Days) accumulated
**Output:** Estimated yield range (kg/ha) with confidence interval

#### 3.5 Crop Type Classification
- Use temporal NDVI signature (crop phenology) to identify crop type
- K-means clustering on multi-date NDVI stack from Sentinel-2
- Validated against Kharif/Rabi crop calendars for each Indian state

---

### Module 4 — Farmer Mobile App (React Native)

#### 4.1 Core Screens
1. **Home Dashboard** — Weather widget, latest crop health score, 1 active alert
2. **My Fields** — List/map of registered fields, tap to view health details
3. **Scan Crop** — Camera → upload leaf image → CNN disease detection result
4. **Field Health** — NDVI map of field, index values, health zone color overlay
5. **Alerts** — Push notification inbox with pest/disease/weather warnings
6. **Market Prices** — Mandi prices for user's crop type (Agmarknet API)
7. **Advisory** — Text + voice recommendations (TTS in local language)
8. **Profile / Settings** — Field registration, crop type, language selection

#### 4.2 Accessibility & Inclusivity
- Language support: Hindi + at minimum 4 regional languages (Punjabi, Telugu, Marathi, Tamil) via i18n
- Voice readout for all health scores and recommendations using TTS (React Native TTS / Google Cloud TTS)
- Icon-first UI — 2–3 tap max for any primary action
- Low-bandwidth mode: compressed image upload (< 200 KB), lazy load maps
- Offline mode:
  - Last-known field health scores cached locally (AsyncStorage)
  - CNN disease detection via on-device TFLite model (no internet needed)
  - Queued sensor data sync when back online

#### 4.3 Field Registration
- Draw polygon on map or drop pin + auto-buffer
- Enter crop type, sowing date, irrigation type
- Optional: attach soil test report (PDF/image)

#### 4.4 Image Capture for Disease Detection
- Guided capture UI: "Hold phone 20 cm from leaf, ensure good lighting"
- Submit to `/api/ml/detect-disease` or run on-device
- Result: disease name, confidence %, treatment card (text + image)
- "Report false detection" feedback button → feeds active learning pipeline

---

### Module 5 — Agronomist Web Dashboard (React + Leaflet)

#### 5.1 Map View
- Full-screen interactive map (Leaflet.js + OpenStreetMap tiles)
- Layer switcher: NDVI / EVI / Pest Risk / Soil Moisture overlays
- Field polygon rendering with color-coded health zones
- Click field → side panel with full analytics

#### 5.2 Temporal Trend Charts
- Line chart: NDVI/EVI over time for selected field (Chart.js / Recharts)
- Annotate key growth stages on timeline
- Compare multiple fields on same chart
- Anomaly markers (red dot) where LSTM flagged stress

#### 5.3 Alert Management
- Table of all active alerts (field, alert type, severity, timestamp)
- Bulk acknowledge / assign to field technician
- Alert history with resolution notes

#### 5.4 Report Generation
- Auto-generate field health PDF report: index map + trend chart + recommendations
- Export data as CSV (index time series, sensor readings)
- Scheduled weekly email reports to registered agronomists

#### 5.5 Validation & Feedback Loop
- Agronomist can confirm/reject AI predictions → feeds model retraining pipeline
- Ground-truth entry form: actual disease observed, yield at harvest

---

### Module 6 — Backend API (Flask / FastAPI)

#### 6.1 API Endpoints

**Auth**
- `POST /api/auth/register` — user registration
- `POST /api/auth/login` — JWT token issue
- `POST /api/auth/refresh` — token refresh

**Fields**
- `POST /api/fields` — register new field (GeoJSON polygon + metadata)
- `GET /api/fields` — list user's fields
- `GET /api/fields/:id` — field detail
- `DELETE /api/fields/:id`

**Remote Sensing**
- `POST /api/rs/ndvi` — compute NDVI for field + date range *(existing)*
- `POST /api/rs/indices` — compute all vegetation indices
- `POST /api/rs/health-map` — return classified health zone raster
- `GET /api/rs/timeseries/:fieldId` — historical index time series
- `GET /api/rs/soil-moisture/:fieldId` — SMAP + SAR soil moisture

**ML**
- `POST /api/ml/detect-disease` — CNN inference on uploaded leaf image
- `POST /api/ml/stress-forecast` — LSTM 7-day stress forecast
- `GET /api/ml/pest-risk/:fieldId` — current pest risk level + triggers
- `GET /api/ml/yield-estimate/:fieldId` — yield score estimate

**Sensors**
- `POST /api/sensors/ingest` — push sensor reading (device → server)
- `GET /api/sensors/:fieldId` — latest readings for a field
- `GET /api/sensors/:fieldId/history` — time series

**Alerts**
- `GET /api/alerts` — list alerts for user
- `PUT /api/alerts/:id/acknowledge`

**Market**
- `GET /api/market/prices?crop=wheat&state=Punjab` — mandi prices via Agmarknet

**Reports**
- `POST /api/reports/generate/:fieldId` — generate PDF report

#### 6.2 Architecture
- Python 3.11 + FastAPI (upgrade from Flask for async support + auto OpenAPI docs)
- Celery + Redis for background tasks (GEE calls, PDF generation, LSTM inference)
- JWT authentication (PyJWT)
- Rate limiting: 60 req/min per user
- CORS configured for mobile app + dashboard domains

---

### Module 7 — Database Layer

#### 7.1 PostgreSQL + PostGIS
- `users` — id, email, phone, role (farmer/agronomist/admin), language preference
- `fields` — id, user_id, name, geom (PostGIS polygon), crop_type, sowing_date, state, district
- `index_readings` — id, field_id, timestamp, ndvi, evi, savi, ndwi, ndre, ndmi, bsi, source (sentinel2/landsat)
- `sensor_readings` — id, field_id, device_id, timestamp, soil_moisture, soil_temp, air_temp, humidity, leaf_wetness, rainfall
- `disease_detections` — id, field_id, user_id, timestamp, image_url, predicted_class, confidence, is_confirmed
- `pest_alerts` — id, field_id, pest_type, risk_level, triggered_by, timestamp, acknowledged_at
- `stress_forecasts` — id, field_id, forecast_date, stress_probability, severity_score
- `yield_estimates` — id, field_id, crop_season, estimated_min, estimated_max, unit
- `reports` — id, field_id, generated_at, pdf_url

#### 7.2 Redis
- Cache GEE computation results (TTL: 6 hours — satellite doesn't change faster)
- Cache mandi price responses (TTL: 1 hour)
- Celery task queue

#### 7.3 Object Storage
- AWS S3 / Cloudflare R2 for: leaf images, generated PDFs, exported GeoTIFFs
- Mobile app uploads compressed JPEG; server stores original + thumbnail

---

### Module 8 — Notification & Alert System

#### 8.1 Alert Triggers
| Trigger | Condition | Severity |
|---------|-----------|----------|
| NDVI crash | NDVI drops > 0.15 in 7 days | High |
| Drought stress | NDWI < -0.3 for > 5 days | Medium |
| Pest risk | Environmental thresholds met (see 3.3) | Variable |
| Disease detected | CNN confidence > 75% | High |
| Soil moisture critical | < 20% VWC for > 3 days | High |
| Yield risk | Stress during critical growth stage | High |

#### 8.2 Delivery Channels
- Push notifications (Firebase Cloud Messaging — Android + iOS)
- SMS fallback via Twilio / MSG91 for users without smartphones
- In-app notification inbox
- Email digest for agronomists (daily/weekly)
- WhatsApp Business API (optional, high-impact for Indian farmers)

#### 8.3 Alert Logic
- Debounce: same alert type per field max once per 24 hours
- Severity escalation: if unacknowledged for 48 hrs → escalate to assigned agronomist
- Localized alert messages (translate to user's preferred language)

---

## 4. Non-Functional Requirements

### 4.1 Performance
- NDVI computation (GEE call): < 5s for 10 km² field
- Disease detection inference: < 2s server-side, < 1s on-device TFLite
- Dashboard initial load: < 3s on 4G
- API response time: < 500ms for cached endpoints, < 3s for GEE endpoints

### 4.2 Scalability
- Containerized via Docker; orchestrated with Docker Compose (dev) / Kubernetes (prod)
- Celery workers horizontally scalable for GEE jobs
- PostGIS spatial indices on `fields.geom` for fast bounding box queries

### 4.3 Security
- All endpoints require JWT auth except `/auth/*`
- HTTPS enforced (TLS 1.2+)
- File upload: validate MIME type + max 10 MB, store in isolated S3 bucket
- SQL queries via ORM (SQLAlchemy) — no raw SQL with user input
- Rate limiting on all endpoints

### 4.4 Offline / Connectivity
- Mobile app caches last index values and advisory text in AsyncStorage
- On-device TFLite model for disease detection (no network needed)
- Sensor readings queued locally if offline, batch-synced on reconnect

### 4.5 Accessibility
- WCAG 2.1 AA compliance on web dashboard
- Mobile app: minimum 16sp body text, 4.5:1 contrast ratio
- All critical actions keyboard/screen-reader accessible

---

## 5. Data Sources

| Data | Source | Access |
|------|--------|--------|
| Sentinel-2 imagery | Google Earth Engine (`COPERNICUS/S2_SR`) | Free (GEE account) |
| Landsat 8/9 | GEE (`LANDSAT/LC09/C02/T1_L2`) | Free |
| Soil moisture (SMAP) | GEE (`NASA_USDA/HSL/SMAP10KM_soil_moisture`) | Free |
| SAR soil moisture | GEE (`COPERNICUS/S1_GRD`) | Free |
| Weather history | NASA POWER API (`power.larc.nasa.gov/api`) | Free |
| Weather forecast | OpenWeatherMap API (free tier) | Free (60 calls/min) |
| Leaf disease images | PlantVillage dataset | Free (academic) |
| Hyperspectral reference | Indian Pines Dataset (Purdue) | Free |
| Mandi prices | Agmarknet / data.gov.in API | Free |
| Crop calendars | ICAR / FAO GIEWS | Public |
| Soil maps | NBSS&LUP (India) / ISRIC SoilGrids | Free |

---

## 6. Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native (Expo) |
| Web Dashboard | React + Leaflet.js + Recharts |
| Backend | Python FastAPI |
| ML Training | TensorFlow / Keras, scikit-learn |
| On-device ML | TensorFlow Lite (.tflite) |
| Remote Sensing | Google Earth Engine Python API |
| Task Queue | Celery + Redis |
| Primary DB | PostgreSQL 15 + PostGIS |
| Cache | Redis |
| Object Storage | AWS S3 / Cloudflare R2 |
| Notifications | Firebase Cloud Messaging |
| Containerization | Docker + Docker Compose |
| Auth | JWT (PyJWT) |
| API Docs | FastAPI auto OpenAPI / Swagger |

---

## 7. MVP Scope (Hackathon Build)

Given hackathon timeline, the following constitutes the **minimum viable demo**:

### Must Have (P0)
- [x] GEE NDVI endpoint (already built)
- [ ] All 8 vegetation indices endpoint (`/api/rs/indices`)
- [ ] Field registration (polygon + crop type)
- [ ] CNN disease detection (`/api/ml/detect-disease`) — MobileNetV2 on PlantVillage
- [ ] NDVI time series chart on dashboard
- [ ] Basic pest risk rule engine (`/api/ml/pest-risk`)
- [ ] React dashboard with Leaflet map + NDVI overlay
- [ ] Mobile app: Scan Crop screen (camera → disease result)
- [ ] Push notification for 1 alert type (NDVI crash)

### Should Have (P1)
- [ ] Soil moisture from SMAP via GEE
- [ ] LSTM stress forecast (trained on synthetic/historical data)
- [ ] Mandi price widget
- [ ] PDF report generation
- [ ] SMS alert fallback
- [ ] Hindi language support in mobile app

### Nice to Have (P2)
- [ ] On-device TFLite inference (offline disease detection)
- [ ] Agronomist validation workflow
- [ ] Yield score estimation
- [ ] WhatsApp notification
- [ ] Multi-language (4 regional languages)

---

## 8. Hackathon Evaluation Alignment

| Criteria | How Croppy addresses it |
|----------|------------------------|
| Problem Relevance & Theme Alignment (20) | Directly addresses SIH 25099 + "AI-Driven Crop Health & Pest Management" theme |
| Innovation & Uniqueness (20) | NDRE early-stress detection, LSTM temporal forecasting, sensor fusion — not in any competitor |
| Technical Feasibility (15) | All components use production APIs (GEE, Firebase, OpenWeatherMap) with working prototype |
| Impact on Farmers & Rural Livelihood (15) | Offline mode, voice TTS, vernacular UI, SMS fallback, mandi prices |
| Accessibility, Language & Inclusivity (30) | Hindi + regional languages, icon-first UI, 2-tap navigation, low-bandwidth mode |

---

## 9. Repository Structure (Proposed)

```
croppy/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # Route handlers
│   │   ├── ml/                # Model inference code
│   │   ├── rs/                # Remote sensing (GEE) modules
│   │   ├── models/            # SQLAlchemy models
│   │   ├── services/          # Business logic
│   │   └── core/              # Config, auth, middleware
│   ├── ml_training/           # Jupyter notebooks + training scripts
│   │   ├── disease_cnn/
│   │   ├── stress_lstm/
│   │   └── pest_risk_rf/
│   ├── app.py                 # Entry point (existing, to be refactored)
│   └── requirements.txt
├── dashboard/                  # React web dashboard
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── utils/
│   └── package.json
├── mobile/                     # React Native app
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── i18n/              # Translation files
│   │   └── assets/models/     # TFLite model
│   └── package.json
├── docker-compose.yml
└── REQUIREMENTS.md             # This file
```

---

## 10. Open Questions / Assumptions

1. **Sensor hardware**: Assuming ESP32-based sensors — need to decide if we simulate sensor data for demo or procure actual hardware
2. **GEE quota**: Free GEE tier should be sufficient for demo; production would need commercial license
3. **PlantVillage training**: Pre-trained MobileNetV2 from Kaggle can be used directly to save training time
4. **Indian hyperspectral data**: Indian Pines dataset is from USA (Indiana) — for demo purposes acceptable, but production needs India-specific data
5. **Agmarknet API**: Rate limits and data freshness need validation — may need scraping fallback
6. **MATLAB**: Problem statement mentions MATLAB but we use Python ecosystem — acceptable since problem statement says "built using" not "must use"
