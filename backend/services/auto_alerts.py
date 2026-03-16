"""
Auto-alert generation service.
Called after satellite indices are computed for a field.
Checks thresholds and creates alerts in the pest_alerts table via debounced inserts.
"""
from datetime import datetime, timedelta
from typing import Optional
from backend.core.supabase_client import get_supabase


def _upsert_alert(field_id: str, user_id: str, alert_type: str,
                  severity: str, message: str) -> None:
    """Insert alert with 24-hour deduplication."""
    supabase = get_supabase()
    cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()

    existing = (
        supabase.table("pest_alerts")
        .select("id")
        .eq("field_id", field_id)
        .eq("alert_type", alert_type)
        .eq("acknowledged", False)
        .gte("triggered_at", cutoff)
        .maybe_single()
        .execute()
    )
    if existing.data:
        return  # Already exists — skip

    supabase.table("pest_alerts").insert({
        "field_id":     field_id,
        "user_id":      user_id,
        "alert_type":   alert_type,
        "severity":     severity,
        "message":      message,
        "triggered_by": "satellite",
        "triggered_at": datetime.utcnow().isoformat(),
        "acknowledged": False,
    }).execute()


def _get_prev_ndvi(field_id: str) -> Optional[float]:
    """Get the most recent NDVI reading before today for delta calculation."""
    supabase = get_supabase()
    cutoff = (datetime.utcnow() - timedelta(days=14)).isoformat()
    res = (
        supabase.table("index_readings")
        .select("ndvi, recorded_at")
        .eq("field_id", field_id)
        .gte("recorded_at", cutoff)
        .order("recorded_at", desc=True)
        .limit(5)
        .execute()
    )
    rows = res.data or []
    # Return second-most-recent so we can compare with latest
    if len(rows) >= 2:
        return rows[1].get("ndvi")
    return None


def generate_index_alerts(field_id: str, user_id: str,
                          field_name: str, crop_type: str,
                          indices: dict) -> list:
    """
    Evaluate satellite indices against thresholds and create alerts.
    Returns list of alert types that were triggered.
    """
    triggered = []
    idx = indices  # e.g. {"NDVI": {"value": 0.32, ...}, ...}

    ndvi = (idx.get("NDVI") or {}).get("value")
    ndwi = (idx.get("NDWI") or {}).get("value")
    ndre = (idx.get("NDRE") or {}).get("value")
    bsi  = (idx.get("BSI")  or {}).get("value")

    # ── NDVI drop check ────────────────────────────────────────────────────
    prev_ndvi = _get_prev_ndvi(field_id)
    if ndvi is not None and prev_ndvi is not None:
        drop = prev_ndvi - ndvi
        if drop >= 0.15:
            msg = (
                f"NDVI dropped by {drop:.3f} in the last 7–14 days for {field_name} ({crop_type}). "
                f"Current: {ndvi:.3f} — Previous: {prev_ndvi:.3f}. "
                "Possible causes: pest attack, disease, drought stress, or waterlogging."
            )
            _upsert_alert(field_id, user_id, "ndvi_drop", "High", msg)
            triggered.append("ndvi_drop")

    # ── Drought stress (NDWI) ──────────────────────────────────────────────
    if ndwi is not None and ndwi < -0.3:
        sev = "High" if ndwi < -0.5 else "Medium"
        msg = (
            f"Drought stress detected for {field_name} ({crop_type}). "
            f"NDWI = {ndwi:.3f} — severe water deficit. "
            "Irrigate immediately and check soil moisture at root zone."
        )
        _upsert_alert(field_id, user_id, "drought_stress", sev, msg)
        triggered.append("drought_stress")

    # ── Low vegetation (NDVI critical) ────────────────────────────────────
    if ndvi is not None and ndvi < 0.15:
        msg = (
            f"Very low NDVI ({ndvi:.3f}) detected for {field_name} ({crop_type}). "
            "Possible bare soil, crop failure, or severe disease/pest damage. "
            "Conduct field inspection immediately."
        )
        _upsert_alert(field_id, user_id, "low_vegetation", "High", msg)
        triggered.append("low_vegetation")

    # ── Chlorophyll deficiency (NDRE) ─────────────────────────────────────
    if ndre is not None and ndre < 0.12:
        msg = (
            f"Low chlorophyll detected for {field_name} ({crop_type}). "
            f"NDRE = {ndre:.3f} — early indicator of nitrogen deficiency or foliar disease. "
            "Apply foliar urea (2%) or inspect for rust/blight."
        )
        _upsert_alert(field_id, user_id, "chlorophyll_low", "Medium", msg)
        triggered.append("chlorophyll_low")

    # ── Bare soil / erosion risk (BSI) ────────────────────────────────────
    if bsi is not None and bsi > 0.35:
        msg = (
            f"High bare soil exposure (BSI = {bsi:.3f}) for {field_name}. "
            "Significant topsoil erosion risk. Consider cover cropping or mulching."
        )
        _upsert_alert(field_id, user_id, "bare_soil_risk", "Medium", msg)
        triggered.append("bare_soil_risk")

    return triggered
