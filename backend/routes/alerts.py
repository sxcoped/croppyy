"""
Alerts routes — Supabase-backed, JWT-protected.
Seed demo alerts appear only when the table is empty for this user.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from backend.core.auth import get_current_user, require_role
from backend.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


class AlertCreate(BaseModel):
    field_id: str
    alert_type: str
    severity: str   # Low / Medium / High
    message: str
    triggered_by: Optional[str] = "system"


class AlertResponse(BaseModel):
    id: str
    field_id: str
    alert_type: str
    severity: str
    message: str
    triggered_by: Optional[str]
    triggered_at: str
    acknowledged: bool
    acknowledged_at: Optional[str] = None


def _create_alert_db(field_id: str, user_id: str, alert_type: str,
                     severity: str, message: str, triggered_by: str = "system") -> dict:
    """Internal utility to create an alert — used by other services."""
    supabase = get_supabase()

    # Debounce: skip if same type for same field in last 24 hrs
    cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    existing = (supabase.table("pest_alerts")
                .select("id")
                .eq("field_id", field_id)
                .eq("alert_type", alert_type)
                .eq("acknowledged", False)
                .gte("triggered_at", cutoff)
                .maybe_single()
                .execute())
    if existing.data:
        return existing.data

    res = supabase.table("pest_alerts").insert({
        "field_id":    field_id,
        "user_id":     user_id,
        "alert_type":  alert_type,
        "severity":    severity,
        "message":     message,
        "triggered_by": triggered_by,
        "triggered_at": datetime.utcnow().isoformat(),
        "acknowledged": False,
    }).execute()
    return res.data[0] if res.data else {}


@router.get("", response_model=List[AlertResponse], summary="List all alerts for user")
def list_alerts(
    field_id: Optional[str] = None,
    unacknowledged_only: bool = False,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    query = supabase.table("pest_alerts").select("*").eq("user_id", user["id"])

    if field_id:
        query = query.eq("field_id", field_id)
    if unacknowledged_only:
        query = query.eq("acknowledged", False)

    res = query.order("triggered_at", desc=True).limit(100).execute()
    return [AlertResponse(**a) for a in (res.data or [])]


@router.post("", response_model=AlertResponse, status_code=201, summary="Create an alert")
def create_alert_endpoint(body: AlertCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    # Verify field ownership
    field_res = supabase.table("fields").select("id").eq("id", body.field_id).eq("user_id", user["id"]).maybe_single().execute()
    if not field_res.data:
        raise HTTPException(status_code=404, detail="Field not found")

    alert = _create_alert_db(
        field_id=body.field_id, user_id=user["id"],
        alert_type=body.alert_type, severity=body.severity,
        message=body.message, triggered_by=body.triggered_by or "manual",
    )
    if not alert:
        raise HTTPException(status_code=500, detail="Failed to create alert")
    return AlertResponse(**alert)


@router.put("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(alert_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("pest_alerts").update({
        "acknowledged": True,
        "acknowledged_at": datetime.utcnow().isoformat(),
    }).eq("id", alert_id).eq("user_id", user["id"]).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertResponse(**res.data[0])


@router.delete("/{alert_id}", status_code=204, summary="Delete an alert")
def delete_alert(alert_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("pest_alerts").delete().eq("id", alert_id).eq("user_id", user["id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Alert not found")


@router.get("/summary", summary="Alert counts by severity")
def alert_summary(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    all_alerts = supabase.table("pest_alerts").select("severity, acknowledged").eq("user_id", user["id"]).execute().data or []
    active = [a for a in all_alerts if not a["acknowledged"]]
    return {
        "total":    len(all_alerts),
        "active":   len(active),
        "high":     sum(1 for a in active if a["severity"] == "High"),
        "medium":   sum(1 for a in active if a["severity"] == "Medium"),
        "low":      sum(1 for a in active if a["severity"] == "Low"),
        "resolved": len([a for a in all_alerts if a["acknowledged"]]),
    }
