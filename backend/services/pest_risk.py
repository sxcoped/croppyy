"""
Rule-based pest risk engine.
Each rule maps environmental thresholds → pest alert.
Phase 2 will replace/augment with a trained Random Forest.
"""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class PestRule:
    pest: str
    crops: List[str]           # which crops this pest targets
    conditions: dict           # threshold checks
    recommendation: str


# ─── Rule definitions ─────────────────────────────────────────────────────────
# Each condition key maps to (min, max) inclusive range. None = no bound.

RULES: List[PestRule] = [
    PestRule(
        pest="Rice Blast (Magnaporthe oryzae)",
        crops=["rice", "paddy"],
        conditions={
            "air_temp":     (22, 28),
            "humidity":     (90, 100),
            "leaf_wetness": (10, None),   # hours of wetness
        },
        recommendation=(
            "Apply Tricyclazole 75 WP @ 0.6 g/L or Propiconazole 25 EC @ 1 mL/L. "
            "Drain field for 2–3 days to reduce humidity. Avoid excess nitrogen."
        ),
    ),
    PestRule(
        pest="Brown Planthopper (Nilaparvata lugens)",
        crops=["rice", "paddy"],
        conditions={
            "air_temp":  (25, 35),
            "humidity":  (80, 100),
            "rainfall_mm": (0, 5),   # dry spell after rain
        },
        recommendation=(
            "Apply Imidacloprid 17.8 SL @ 0.25 mL/L or Buprofezin 25 SC @ 1.25 mL/L. "
            "Avoid broad-spectrum insecticides that kill natural enemies."
        ),
    ),
    PestRule(
        pest="Wheat Rust (Puccinia spp.)",
        crops=["wheat"],
        conditions={
            "air_temp":     (15, 22),
            "humidity":     (85, 100),
            "leaf_wetness": (6, None),
        },
        recommendation=(
            "Apply Propiconazole 25 EC @ 0.1% or Tebuconazole 250 EW @ 1 mL/L. "
            "Use resistant varieties in next sowing. Remove volunteer plants."
        ),
    ),
    PestRule(
        pest="Fall Armyworm (Spodoptera frugiperda)",
        crops=["maize", "corn", "sorghum"],
        conditions={
            "air_temp":    (25, 35),
            "humidity":    (50, 80),
            "rainfall_mm": (10, None),   # post-rain conditions
        },
        recommendation=(
            "Apply Emamectin Benzoate 5 SG @ 0.4 g/L or Spinetoram 11.7 SC @ 0.5 mL/L. "
            "Spray in early morning/evening. Check for egg masses on lower leaves."
        ),
    ),
    PestRule(
        pest="Cotton Bollworm (Helicoverpa armigera)",
        crops=["cotton"],
        conditions={
            "air_temp":  (25, 38),
            "humidity":  (40, 75),
        },
        recommendation=(
            "Apply Indoxacarb 14.5 SC @ 1 mL/L or Chlorantraniliprole 18.5 SC @ 0.3 mL/L. "
            "Use pheromone traps (5/ha) for monitoring. Avoid continuous spraying of same molecule."
        ),
    ),
    PestRule(
        pest="Aphids (multiple species)",
        crops=["wheat", "mustard", "potato", "tomato", "cotton"],
        conditions={
            "air_temp":    (15, 30),
            "humidity":    (20, 60),   # low humidity favours aphids
            "ndvi_delta":  (-0.15, -0.05),   # sudden NDVI drop
        },
        recommendation=(
            "Apply Dimethoate 30 EC @ 1.5 mL/L or Thiamethoxam 25 WG @ 0.5 g/L. "
            "Use yellow sticky traps. Preserve aphid parasitoids (Aphidius spp.)."
        ),
    ),
    PestRule(
        pest="Late Blight (Phytophthora infestans)",
        crops=["potato", "tomato"],
        conditions={
            "air_temp":     (10, 20),
            "humidity":     (90, 100),
            "leaf_wetness": (8, None),
        },
        recommendation=(
            "Apply Metalaxyl + Mancozeb @ 2.5 g/L or Cymoxanil + Mancozeb @ 3 g/L. "
            "Improve field drainage. Avoid overhead irrigation. Destroy infected tubers."
        ),
    ),
    PestRule(
        pest="Powdery Mildew",
        crops=["wheat", "grapes", "mango", "mustard"],
        conditions={
            "air_temp":  (20, 28),
            "humidity":  (50, 80),
        },
        recommendation=(
            "Apply Sulphur 80 WP @ 3 g/L or Hexaconazole 5 EC @ 1 mL/L. "
            "Maintain plant spacing for air circulation. Remove infected leaves."
        ),
    ),
]


# ─── Risk scoring ─────────────────────────────────────────────────────────────

def _check_condition(value: Optional[float], lo, hi) -> bool:
    if value is None:
        return False
    if lo is not None and value < lo:
        return False
    if hi is not None and value > hi:
        return False
    return True


def _score_rule(rule: PestRule, params: dict) -> tuple:
    """Returns (matched_count, total_conditions, list_of_trigger_descriptions)"""
    total = len(rule.conditions)
    matched = 0
    triggers = []

    param_map = {
        "air_temp":     params.get("air_temp"),
        "humidity":     params.get("humidity"),
        "leaf_wetness": params.get("leaf_wetness"),
        "rainfall_mm":  params.get("rainfall_mm"),
        "ndvi_delta":   params.get("ndvi_delta"),
    }

    condition_labels = {
        "air_temp":     "Air temperature",
        "humidity":     "Relative humidity",
        "leaf_wetness": "Leaf wetness duration",
        "rainfall_mm":  "Recent rainfall",
        "ndvi_delta":   "NDVI decline",
    }

    for key, (lo, hi) in rule.conditions.items():
        val = param_map.get(key)
        if _check_condition(val, lo, hi):
            matched += 1
            lo_str = f"≥{lo}" if lo is not None else ""
            hi_str = f"≤{hi}" if hi is not None else ""
            bound  = f"{lo_str}–{hi_str}".strip("–")
            triggers.append(f"{condition_labels.get(key, key)} {bound} (actual: {val})")

    return matched, total, triggers


def _risk_level(matched: int, total: int) -> tuple:
    ratio = matched / total if total > 0 else 0
    if ratio >= 0.85:
        return "High", round(ratio, 2)
    elif ratio >= 0.5:
        return "Medium", round(ratio, 2)
    elif ratio >= 0.25:
        return "Low", round(ratio, 2)
    return None, 0.0


def evaluate_pest_risk(
    crop_type: str,
    air_temp: Optional[float] = None,
    humidity: Optional[float] = None,
    leaf_wetness: Optional[float] = None,
    rainfall_mm: Optional[float] = None,
    ndvi: Optional[float] = None,
    ndvi_delta: Optional[float] = None,
) -> dict:
    crop_lower = crop_type.lower().strip()
    params = {
        "air_temp":    air_temp,
        "humidity":    humidity,
        "leaf_wetness": leaf_wetness,
        "rainfall_mm": rainfall_mm,
        "ndvi":        ndvi,
        "ndvi_delta":  ndvi_delta,
    }

    alerts = []

    for rule in RULES:
        # Only evaluate rules for this crop
        if not any(c in crop_lower for c in rule.crops):
            continue

        matched, total, triggers = _score_rule(rule, params)
        if matched == 0:
            continue

        level, confidence = _risk_level(matched, total)
        if level is None:
            continue

        alerts.append({
            "pest":           rule.pest,
            "risk_level":     level,
            "confidence":     confidence,
            "triggers":       triggers,
            "recommendation": rule.recommendation,
        })

    # Sort by risk severity
    order = {"High": 0, "Medium": 1, "Low": 2}
    alerts.sort(key=lambda a: order.get(a["risk_level"], 3))

    overall = alerts[0]["risk_level"] if alerts else "Low"

    return {
        "crop_type":    crop_type,
        "overall_risk": overall,
        "alerts":       alerts,
    }
