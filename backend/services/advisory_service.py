"""
Advisory Engine — rule-based crop advisory system.
Combines crop calendar, weather advisories, NDVI stress signals,
soil data, and fertilizer recommendations.
"""
from datetime import date, datetime
from typing import Optional

# ─── Crop Calendar ────────────────────────────────────────────────────────────
# Each stage: name, start/end days-after-sowing, actions, critical (bool)

CROP_CALENDAR = {
    "wheat": {
        "name": "Wheat", "total_days": 130, "harvest_unit": "kg/ha",
        "avg_yield": 4500,
        "stages": [
            {"name": "Germination",       "start": 0,   "end": 12,
             "actions": ["Monitor stand establishment", "Gap-fill if <80% germination rate"],
             "inputs": [], "critical": False},
            {"name": "Crown Root Init.",  "start": 12,  "end": 25,
             "actions": ["First irrigation (50 mm)", "Apply 1/3 N fertiliser (Urea ~40 kg/ha)"],
             "inputs": ["Urea 40 kg/ha"], "critical": False},
            {"name": "Tillering",         "start": 25,  "end": 45,
             "actions": ["Apply 2nd N dose (Urea 30 kg/ha)", "Scout for aphids + rust", "Second irrigation"],
             "inputs": ["Urea 30 kg/ha", "2nd irrigation 50 mm"], "critical": False},
            {"name": "Jointing",          "start": 45,  "end": 60,
             "actions": ["Critical irrigation — do not skip", "Inspect for yellow rust (yellow stripes)"],
             "inputs": ["3rd irrigation 60 mm"], "critical": True},
            {"name": "Booting",           "start": 60,  "end": 75,
             "actions": ["Apply fungicide if rust signs present", "4th irrigation"],
             "inputs": ["Propiconazole 0.1% if rust", "4th irrigation 50 mm"], "critical": False},
            {"name": "Heading/Flowering", "start": 75,  "end": 90,
             "actions": ["Do NOT irrigate during pollen shedding", "Spray only after evening (no wind)"],
             "inputs": [], "critical": True},
            {"name": "Grain Filling",     "start": 90,  "end": 120,
             "actions": ["Light irrigation (30 mm)", "Spray aphicides if colony > 5/tiller"],
             "inputs": ["5th irrigation 30 mm"], "critical": False},
            {"name": "Maturity",          "start": 120, "end": 130,
             "actions": ["Harvest when grain moisture < 14%", "Avoid delay — rain causes shattering"],
             "inputs": [], "critical": False},
        ]
    },
    "rice": {
        "name": "Rice (Paddy)", "total_days": 140, "harvest_unit": "kg/ha",
        "avg_yield": 5500,
        "stages": [
            {"name": "Nursery",           "start": 0,   "end": 25,
             "actions": ["Prepare nursery beds", "Seed treatment with Carbendazim 0.2%"],
             "inputs": ["Carbendazim 2g/kg seed"], "critical": False},
            {"name": "Transplanting",     "start": 25,  "end": 35,
             "actions": ["Transplant 20–25 day seedlings", "Maintain 5 cm flood"],
             "inputs": ["Basal DAP 50 kg/ha", "MOP 25 kg/ha"], "critical": False},
            {"name": "Tillering",         "start": 35,  "end": 60,
             "actions": ["Apply 1/2 N (Urea 65 kg/ha)", "Scout for brown plant hopper"],
             "inputs": ["Urea 65 kg/ha"], "critical": False},
            {"name": "Panicle Initiation","start": 60,  "end": 80,
             "actions": ["Apply remaining N (Urea 65 kg/ha)", "Drain field for 1 week"],
             "inputs": ["Urea 65 kg/ha"], "critical": True},
            {"name": "Booting/Heading",   "start": 80,  "end": 100,
             "actions": ["Maintain flood", "Apply fungicide for blast if needed"],
             "inputs": ["Tricyclazole 0.06% for blast"], "critical": True},
            {"name": "Grain Filling",     "start": 100, "end": 130,
             "actions": ["Maintain irrigation", "Drain 2 weeks before harvest"],
             "inputs": [], "critical": False},
            {"name": "Maturity",          "start": 130, "end": 140,
             "actions": ["Harvest when 80% grain turns golden-yellow", "Combine or manual harvest"],
             "inputs": [], "critical": False},
        ]
    },
    "maize": {
        "name": "Maize (Corn)", "total_days": 100, "harvest_unit": "kg/ha",
        "avg_yield": 6000,
        "stages": [
            {"name": "Germination",       "start": 0,  "end": 8,
             "actions": ["Check stand: 90% germination minimum"],
             "inputs": [], "critical": False},
            {"name": "Seedling",          "start": 8,  "end": 20,
             "actions": ["Thin to 75,000 plants/ha", "Apply pre-emergence herbicide"],
             "inputs": ["Atrazine 2 kg/ha"], "critical": False},
            {"name": "Vegetative (V6)",   "start": 20, "end": 40,
             "actions": ["Apply 1/2 N (Urea 65 kg/ha)", "Irrigate (25 mm every 7 days)"],
             "inputs": ["Urea 65 kg/ha"], "critical": False},
            {"name": "Tasseling",         "start": 40, "end": 60,
             "actions": ["Critical irrigation — 40 mm every 5 days", "Scout for Fall Armyworm"],
             "inputs": ["2nd Urea 65 kg/ha", "Chlorpyrifos 0.2% for FAW"], "critical": True},
            {"name": "Silking/Pollination","start": 60, "end": 75,
             "actions": ["Most critical water period — do NOT stress", "Avoid spraying"],
             "inputs": [], "critical": True},
            {"name": "Grain Filling",     "start": 75, "end": 90,
             "actions": ["Reduce irrigation as cobs mature", "Check for stalk rots"],
             "inputs": [], "critical": False},
            {"name": "Maturity",          "start": 90, "end": 100,
             "actions": ["Harvest when husk turns brown and grain dents", "Dry to <14% moisture"],
             "inputs": [], "critical": False},
        ]
    },
    "cotton": {
        "name": "Cotton", "total_days": 180, "harvest_unit": "kg/ha",
        "avg_yield": 500,
        "stages": [
            {"name": "Germination",       "start": 0,  "end": 10,
             "actions": ["Ensure soil temperature >18°C for germination"],
             "inputs": [], "critical": False},
            {"name": "Seedling",          "start": 10, "end": 30,
             "actions": ["Thin to final spacing (60×30 cm)", "Pre-emergent weeding"],
             "inputs": ["Pendimethalin 1 kg/ha"], "critical": False},
            {"name": "Squaring",          "start": 30, "end": 60,
             "actions": ["Begin monitoring for bollworm", "Apply 1/2 N (100 kg/ha urea)"],
             "inputs": ["Urea 100 kg/ha"], "critical": False},
            {"name": "Flowering",         "start": 60, "end": 90,
             "actions": ["Scout for Pink Bollworm, Whitefly daily", "Apply pheromone traps"],
             "inputs": ["Pheromone traps (5/ha)", "2nd Urea 100 kg/ha"], "critical": True},
            {"name": "Boll Development",  "start": 90, "end": 140,
             "actions": ["Maintain irrigation (40 mm every 10 days)", "Spray only in evening"],
             "inputs": ["Emamectin Benzoate 0.002% if bollworm > threshold"], "critical": True},
            {"name": "Boll Opening",      "start": 140,"end": 170,
             "actions": ["Ethephon spray to hasten opening if needed", "Begin picking open bolls"],
             "inputs": ["Ethephon 500 ppm if needed"], "critical": False},
            {"name": "Harvest",           "start": 170,"end": 180,
             "actions": ["3–4 manual picking rounds", "Avoid rain during picking"],
             "inputs": [], "critical": False},
        ]
    },
    "soybean": {
        "name": "Soybean", "total_days": 100, "harvest_unit": "kg/ha",
        "avg_yield": 2200,
        "stages": [
            {"name": "Germination",  "start": 0,  "end": 7,
             "actions": ["Ensure 90% emergence"], "inputs": [], "critical": False},
            {"name": "Vegetative",   "start": 7,  "end": 35,
             "actions": ["Rhizobium inoculation at sowing", "Weed control"],
             "inputs": ["Rhizobium inoculant", "Imazethapyr 100 ml/ha for weeds"], "critical": False},
            {"name": "Flowering",    "start": 35, "end": 55,
             "actions": ["Critical irrigation (25 mm)", "Scout for Girdle Beetle"],
             "inputs": [], "critical": True},
            {"name": "Pod Setting",  "start": 55, "end": 75,
             "actions": ["Maintain soil moisture", "Apply fungicide if Rhizoctonia seen"],
             "inputs": [], "critical": True},
            {"name": "Grain Filling","start": 75, "end": 90,
             "actions": ["Reduce irrigation", "Check pod borers"],
             "inputs": [], "critical": False},
            {"name": "Maturity",     "start": 90, "end": 100,
             "actions": ["Harvest when 95% pods turn yellow-brown", "Avoid shattering"],
             "inputs": [], "critical": False},
        ]
    },
    "sugarcane": {
        "name": "Sugarcane", "total_days": 365, "harvest_unit": "t/ha",
        "avg_yield": 75,
        "stages": [
            {"name": "Germination",  "start": 0,   "end": 30,
             "actions": ["Ensure soil moisture for bud sprouting", "Pre-emergent herbicide"],
             "inputs": ["Atrazine 2 kg/ha"], "critical": False},
            {"name": "Tillering",    "start": 30,  "end": 90,
             "actions": ["Apply 1/3 N (150 kg/ha urea)", "Scout for early shoot borer"],
             "inputs": ["Urea 150 kg/ha"], "critical": False},
            {"name": "Grand Growth", "start": 90,  "end": 270,
             "actions": ["Most critical growth phase", "Apply 2nd + 3rd N doses", "Earth up around canes"],
             "inputs": ["Urea 150 kg/ha × 2 doses"], "critical": True},
            {"name": "Maturity",     "start": 270, "end": 330,
             "actions": ["Stop irrigation 6 weeks before harvest", "No N fertiliser"],
             "inputs": [], "critical": False},
            {"name": "Harvest",      "start": 330, "end": 365,
             "actions": ["Harvest at 18-20° Brix", "Crush within 24h of cutting"],
             "inputs": [], "critical": False},
        ]
    },
    "tomato": {
        "name": "Tomato", "total_days": 120, "harvest_unit": "t/ha",
        "avg_yield": 25,
        "stages": [
            {"name": "Nursery",      "start": 0,  "end": 25,
             "actions": ["Treat seed with Thiram 3g/kg", "Transplant at 4-leaf stage"],
             "inputs": ["Thiram 3g/kg seed"], "critical": False},
            {"name": "Establishment","start": 25, "end": 40,
             "actions": ["Apply DAP 50 kg/ha", "Install stakes or cages"],
             "inputs": ["DAP 50 kg/ha", "MOP 30 kg/ha"], "critical": False},
            {"name": "Vegetative",   "start": 40, "end": 60,
             "actions": ["Fertigation: N 5 kg/ha/week", "Scout for whitefly (tomato leaf curl virus vector)"],
             "inputs": ["Drip fertigation N+K"], "critical": False},
            {"name": "Flowering",    "start": 60, "end": 80,
             "actions": ["Apply boron (0.1%) for fruit set", "Scout for fruit borer"],
             "inputs": ["Borax 0.1% spray", "Spinosad 0.01% for fruit borer"], "critical": True},
            {"name": "Fruiting",     "start": 80, "end": 110,
             "actions": ["Maintain drip irrigation", "Scout for late blight (brown patches)"],
             "inputs": ["Mancozeb 0.2% for blight"], "critical": True},
            {"name": "Harvest",      "start": 110,"end": 120,
             "actions": ["Pick at breaker/turning stage", "Multiple harvests every 5–7 days"],
             "inputs": [], "critical": False},
        ]
    },
}

# Normalize all crop_type inputs
_ALIASES = {
    "paddy": "rice", "corn": "maize", "bajra": "maize",
    "bt cotton": "cotton", "g cotton": "cotton",
}


def _normalize(crop: str) -> str:
    c = crop.lower().strip()
    return _ALIASES.get(c, c)


# ─── Growth Stage ─────────────────────────────────────────────────────────────

def get_growth_stage(crop_type: str, sowing_date: str) -> Optional[dict]:
    """
    Given crop type and sowing date (YYYY-MM-DD), return the current
    growth stage and upcoming actions.
    """
    key = _normalize(crop_type)
    cal = CROP_CALENDAR.get(key)
    if not cal or not sowing_date:
        return None

    try:
        sow = datetime.strptime(sowing_date, "%Y-%m-%d").date()
    except ValueError:
        return None

    das = (date.today() - sow).days   # Days After Sowing
    if das < 0:
        return {"status": "future", "message": f"Sowing date is {abs(das)} days away"}

    current_stage = None
    next_stage = None
    for i, stage in enumerate(cal["stages"]):
        if stage["start"] <= das < stage["end"]:
            current_stage = stage
            if i + 1 < len(cal["stages"]):
                next_stage = cal["stages"][i + 1]
            break

    if das >= cal["total_days"]:
        return {
            "status": "complete",
            "message": f"Crop should be harvested (Day {das} of ~{cal['total_days']})",
            "das": das,
            "crop": cal["name"],
        }

    if not current_stage:
        # Between stages or post-last
        return {
            "status": "complete",
            "message": "Crop likely at or past harvest stage",
            "das": das,
            "crop": cal["name"],
        }

    days_in_stage = das - current_stage["start"]
    stage_duration = current_stage["end"] - current_stage["start"]
    stage_pct = min(100, round(days_in_stage / stage_duration * 100))

    return {
        "status": "active",
        "das": das,
        "crop": cal["name"],
        "total_days": cal["total_days"],
        "current_stage": {
            "name": current_stage["name"],
            "day_range": f"Day {current_stage['start']}–{current_stage['end']}",
            "progress_pct": stage_pct,
            "days_remaining": current_stage["end"] - das,
            "actions": current_stage["actions"],
            "inputs": current_stage["inputs"],
            "critical": current_stage["critical"],
        },
        "next_stage": {
            "name": next_stage["name"],
            "starts_in_days": next_stage["start"] - das,
            "day_range": f"Day {next_stage['start']}–{next_stage['end']}",
        } if next_stage else None,
        "all_stages": [
            {
                "name": s["name"],
                "start": s["start"],
                "end": s["end"],
                "status": "done" if das >= s["end"] else ("active" if s["start"] <= das < s["end"] else "upcoming"),
                "critical": s["critical"],
            }
            for s in cal["stages"]
        ],
    }


# ─── Weather Advisories ───────────────────────────────────────────────────────

def get_weather_advisories(weather: Optional[dict], forecast: Optional[list]) -> list:
    """
    Rule-based advisory cards from current weather + 5-day forecast.
    Returns a list of advisory dicts with type, title, message, severity, icon.
    """
    cards = []
    if not weather:
        return cards

    temp  = weather.get("temp_c", 25)
    rh    = weather.get("humidity_pct", 60)
    wind  = weather.get("wind_kph", 10)

    # ── Current conditions ────────────────────────────────────────────────
    if temp > 38:
        cards.append({
            "type": "heat_stress",
            "title": "Heat Stress Alert",
            "message": f"Temperature {temp}°C — increase irrigation frequency, apply mulch to conserve moisture.",
            "severity": "danger",
            "icon": "thermometer",
        })

    if temp < 5:
        cards.append({
            "type": "frost_risk",
            "title": "Frost Risk",
            "message": f"Temperature {temp}°C — cover seedlings, delay harvest, protect nursery beds tonight.",
            "severity": "danger",
            "icon": "snowflake",
        })

    if wind > 40:
        cards.append({
            "type": "spray_wind",
            "title": "High Wind — Avoid Spraying",
            "message": f"Wind {wind} km/h — pesticide drift risk. Wait for wind < 20 km/h before spraying.",
            "severity": "warning",
            "icon": "wind",
        })

    # ── Forecast analysis ─────────────────────────────────────────────────
    if forecast and len(forecast) > 0:
        # Sum rain in next 24h (first 8 × 3-hour periods if OpenWeatherMap 3h forecast)
        items = forecast[:8]
        rain_24h = sum(p.get("rain_mm", 0) or 0 for p in items)

        if rain_24h >= 30:
            cards.append({
                "type": "spray_warning",
                "title": "Do NOT Spray Today",
                "message": f"{rain_24h:.0f}mm rain forecast in next 24h — pesticides and fertilisers will wash off.",
                "severity": "danger",
                "icon": "cloud-rain",
            })
        elif rain_24h >= 10:
            cards.append({
                "type": "good_rain",
                "title": "Good Rain Coming",
                "message": f"{rain_24h:.0f}mm expected in 24h — ideal for transplanting or sowing.",
                "severity": "success",
                "icon": "droplet",
            })

        # Check max temp in next 5 days
        max_temps = [p.get("temp_max_c", 0) or p.get("temp_c", 0) or 0 for p in forecast[:40]]
        if max_temps:
            forecast_peak = max(max_temps)
            if forecast_peak > 42:
                cards.append({
                    "type": "heat_wave",
                    "title": "Heat Wave Forecast",
                    "message": f"Peak {forecast_peak:.0f}°C expected this week — irrigate early morning (5–7am), not midday.",
                    "severity": "danger",
                    "icon": "sun",
                })

    # ── Fungal disease risk (high humidity) ───────────────────────────────
    if rh > 85:
        cards.append({
            "type": "fungal_risk",
            "title": "Fungal Disease Risk",
            "message": f"Humidity {rh}% — conditions favour blast, blight, and powdery mildew. Inspect leaves daily.",
            "severity": "warning",
            "icon": "bug",
        })

    return cards


# ─── NDVI / Index Advisories ──────────────────────────────────────────────────

def get_index_advisories(indices: Optional[dict]) -> list:
    """
    Generate advisory cards based on satellite index values.
    """
    cards = []
    if not indices:
        return cards

    ndvi = (indices.get("NDVI") or {}).get("value")
    ndwi = (indices.get("NDWI") or {}).get("value")
    ndre = (indices.get("NDRE") or {}).get("value")
    bsi  = (indices.get("BSI")  or {}).get("value")

    if ndvi is not None and ndvi < 0.2:
        cards.append({
            "type": "ndvi_critical",
            "title": "Very Low Crop Vigour (NDVI)",
            "message": f"NDVI {ndvi:.3f} — severe vegetation stress. Check for waterlogging, disease, or nutrient deficiency.",
            "severity": "danger",
            "icon": "leaf",
        })
    elif ndvi is not None and ndvi < 0.35:
        cards.append({
            "type": "ndvi_low",
            "title": "Low Crop Vigour",
            "message": f"NDVI {ndvi:.3f} — vegetation below expected. Consider foliar urea spray or increased irrigation.",
            "severity": "warning",
            "icon": "leaf",
        })

    if ndwi is not None and ndwi < -0.3:
        cards.append({
            "type": "drought_stress",
            "title": "Drought Stress Detected",
            "message": f"NDWI {ndwi:.3f} — severe water deficit. Irrigate immediately and check soil moisture.",
            "severity": "danger",
            "icon": "droplets",
        })

    if ndre is not None and ndre < 0.15:
        cards.append({
            "type": "chlorophyll_low",
            "title": "Low Chlorophyll (NDRE)",
            "message": f"NDRE {ndre:.3f} — early sign of N deficiency or disease. Apply foliar N or inspect for rust/blight.",
            "severity": "warning",
            "icon": "leaf",
        })

    if bsi is not None and bsi > 0.3:
        cards.append({
            "type": "bare_soil",
            "title": "High Bare Soil Exposure",
            "message": f"BSI {bsi:.3f} — significant soil exposure. Consider mulching or cover crops to reduce erosion.",
            "severity": "warning",
            "icon": "layers",
        })

    return cards


# ─── CWSI Advisory ────────────────────────────────────────────────────────────

def get_irrigation_advisory(cwsi: Optional[float], surface_sm: Optional[float]) -> Optional[dict]:
    """
    Return an irrigation advisory card based on CWSI and/or soil moisture.
    """
    if cwsi is None and surface_sm is None:
        return None

    if cwsi is not None and cwsi > 0.5:
        level = "Critical" if cwsi > 0.75 else "Moderate"
        return {
            "type": "irrigation_needed",
            "title": f"{level} Irrigation Needed",
            "message": f"CWSI {cwsi:.2f} — crop experiencing heat/water stress. Irrigate within 24–48h.",
            "severity": "danger" if cwsi > 0.75 else "warning",
            "icon": "droplet",
            "cwsi": cwsi,
        }

    if surface_sm is not None and surface_sm < 10:
        return {
            "type": "irrigation_needed",
            "title": "Low Soil Moisture",
            "message": f"Surface soil moisture {surface_sm} mm — below critical threshold. Schedule irrigation.",
            "severity": "warning",
            "icon": "droplet",
        }

    return None


# ─── Fertiliser Recommendations ───────────────────────────────────────────────

FERTILIZER_RECS = {
    "wheat": [
        {"nutrient": "Nitrogen (N)", "dose": "120 kg/ha", "split": "40:40:40 at basal:tillering:jointing", "product": "Urea"},
        {"nutrient": "Phosphorus (P)", "dose": "60 kg P₂O₅/ha", "split": "Full at sowing", "product": "DAP"},
        {"nutrient": "Potassium (K)", "dose": "40 kg K₂O/ha", "split": "Full at sowing", "product": "MOP"},
        {"nutrient": "Zinc", "dose": "25 kg ZnSO₄/ha", "split": "Every 3rd year or if deficient", "product": "Zinc Sulfate 21%"},
    ],
    "rice": [
        {"nutrient": "Nitrogen (N)", "dose": "120 kg/ha", "split": "1/2 basal + 1/4 tillering + 1/4 PI", "product": "Urea"},
        {"nutrient": "Phosphorus (P)", "dose": "60 kg P₂O₅/ha", "split": "Full at transplanting", "product": "SSP or DAP"},
        {"nutrient": "Potassium (K)", "dose": "40 kg K₂O/ha", "split": "Half basal, half PI", "product": "MOP"},
        {"nutrient": "Zinc", "dose": "25 kg ZnSO₄/ha", "split": "Apply if yellowing on new leaves", "product": "Zinc Sulfate"},
    ],
    "maize": [
        {"nutrient": "Nitrogen (N)", "dose": "150 kg/ha", "split": "Half at sowing, half at V6", "product": "Urea"},
        {"nutrient": "Phosphorus (P)", "dose": "75 kg P₂O₅/ha", "split": "Full at sowing", "product": "DAP"},
        {"nutrient": "Potassium (K)", "dose": "50 kg K₂O/ha", "split": "Full at sowing", "product": "MOP"},
    ],
    "cotton": [
        {"nutrient": "Nitrogen (N)", "dose": "180 kg/ha", "split": "60:60:60 basal:squaring:boll", "product": "Urea"},
        {"nutrient": "Phosphorus (P)", "dose": "80 kg P₂O₅/ha", "split": "Full at sowing", "product": "DAP"},
        {"nutrient": "Potassium (K)", "dose": "60 kg K₂O/ha", "split": "Split in 2 doses", "product": "MOP"},
        {"nutrient": "Boron", "dose": "1 kg/ha foliar", "split": "At bud stage", "product": "Borax spray 0.2%"},
    ],
    "soybean": [
        {"nutrient": "Nitrogen (N)", "dose": "20 kg/ha starter only", "split": "At sowing (rest from Rhizobium)", "product": "Urea"},
        {"nutrient": "Phosphorus (P)", "dose": "60 kg P₂O₅/ha", "split": "Full at sowing", "product": "DAP"},
        {"nutrient": "Potassium (K)", "dose": "40 kg K₂O/ha", "split": "Full at sowing", "product": "MOP"},
        {"nutrient": "Rhizobium", "dose": "200 g/10 kg seed", "split": "Seed treatment at sowing", "product": "Rhizobium japonicum"},
    ],
    "tomato": [
        {"nutrient": "Nitrogen (N)", "dose": "100 kg/ha", "split": "Via fertigation weekly from Day 25", "product": "19:19:19 + Urea"},
        {"nutrient": "Phosphorus (P)", "dose": "60 kg P₂O₅/ha", "split": "Full at transplanting", "product": "DAP"},
        {"nutrient": "Potassium (K)", "dose": "80 kg K₂O/ha", "split": "Increased at fruiting stage", "product": "SOP (sulphate of potash)"},
        {"nutrient": "Calcium", "dose": "0.5% foliar", "split": "Every 2 weeks from flowering", "product": "Calcium chloride spray"},
    ],
}


def get_fertilizer_recommendations(crop_type: str, soil_ph: Optional[float] = None) -> list:
    key = _normalize(crop_type)
    recs = FERTILIZER_RECS.get(key, [])

    # pH correction note
    ph_note = None
    if soil_ph is not None:
        if soil_ph < 5.5:
            ph_note = {
                "nutrient": "Lime (pH correction)",
                "dose": "2–4 t/ha calcitic lime",
                "split": "Apply 6 weeks before sowing",
                "product": "Agricultural lime",
                "note": f"Soil pH {soil_ph:.1f} is acidic — nutrients locked out below pH 5.5",
            }
        elif soil_ph > 8.0:
            ph_note = {
                "nutrient": "Gypsum (pH correction)",
                "dose": "2 t/ha gypsum",
                "split": "Apply before sowing",
                "product": "Agricultural gypsum (CaSO₄)",
                "note": f"Soil pH {soil_ph:.1f} is alkaline — apply gypsum to reduce pH",
            }

    result = list(recs)
    if ph_note:
        result.insert(0, ph_note)
    return result


# ─── Combined Advisory ────────────────────────────────────────────────────────

def build_advisory(
    crop_type: str,
    sowing_date: Optional[str],
    weather: Optional[dict],
    forecast: Optional[list],
    indices: Optional[dict],
    cwsi: Optional[float] = None,
    surface_sm: Optional[float] = None,
    soil_ph: Optional[float] = None,
) -> dict:
    """
    Build a complete advisory response for a field.
    """
    growth  = get_growth_stage(crop_type, sowing_date) if sowing_date else None
    w_cards = get_weather_advisories(weather, forecast)
    i_cards = get_index_advisories(indices)
    irr     = get_irrigation_advisory(cwsi, surface_sm)
    fert    = get_fertilizer_recommendations(crop_type, soil_ph)

    all_cards = []
    if irr:
        all_cards.append(irr)
    all_cards.extend(w_cards)
    all_cards.extend(i_cards)

    # Priority order: danger > warning > success > info
    priority = {"danger": 0, "warning": 1, "success": 2, "info": 3}
    all_cards.sort(key=lambda c: priority.get(c.get("severity", "info"), 3))

    return {
        "crop": crop_type,
        "generated_at": date.today().isoformat(),
        "growth_stage": growth,
        "advisory_cards": all_cards,
        "total_advisories": len(all_cards),
        "has_critical": any(c.get("severity") == "danger" for c in all_cards),
        "fertilizer_schedule": fert,
    }
