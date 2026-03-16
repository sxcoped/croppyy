"""
PM-FASAL crop insurance eligibility check + document generation.
Phase 5 — India-specific compliance features.
"""
import io
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from backend.core.auth import get_current_user
from backend.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/insurance", tags=["Insurance & Documents"])

# ── PM-FASAL district-level historical yield averages (kg/ha)
# Source: Ministry of Agriculture crop statistics — simplified for MVP
HISTORICAL_YIELDS = {
    "wheat":     {"Punjab": 4800, "Haryana": 4600, "Uttar Pradesh": 3800, "Madhya Pradesh": 3200, "default": 4200},
    "rice":      {"Punjab": 5800, "Haryana": 4900, "West Bengal": 3200, "Odisha": 2800, "default": 4000},
    "maize":     {"Karnataka": 5000, "Madhya Pradesh": 4200, "Bihar": 3500, "default": 4000},
    "cotton":    {"Gujarat": 550, "Maharashtra": 450, "Telangana": 480, "default": 500},
    "soybean":   {"Madhya Pradesh": 2400, "Maharashtra": 2100, "Rajasthan": 1800, "default": 2000},
    "sugarcane": {"Uttar Pradesh": 80, "Maharashtra": 70, "Karnataka": 90, "default": 75},
    "tomato":    {"Maharashtra": 28, "Karnataka": 22, "Andhra Pradesh": 25, "default": 20},
}

# PM-FASAL threshold: claim eligible when yield shortfall > 20%
FASAL_THRESHOLD_PCT = 20.0


class FasalCheckRequest(BaseModel):
    field_id: Optional[str] = None
    field_name: str
    crop_type: str
    state: str
    estimated_yield: float     # kg/ha (or t/ha for sugarcane/tomato)
    area_ha: float
    sowing_date: Optional[str] = None
    ndvi_at_flowering: Optional[float] = None
    total_rainfall_mm: Optional[float] = None


class FarmRecordRequest(BaseModel):
    field_id: Optional[str] = None
    field_name: str
    farmer_name: str
    village: str
    district: str
    state: str
    area_ha: float
    crop_type: str
    sowing_date: Optional[str] = None
    expected_harvest: Optional[str] = None
    irrigation_type: str = "rainfed"
    estimated_yield: Optional[float] = None
    bank_branch: Optional[str] = None   # For KCC application


@router.post("/fasal-check", summary="PM-FASAL crop insurance eligibility check")
async def fasal_check(body: FasalCheckRequest, _user: dict = Depends(get_current_user)):
    """
    Checks if the field qualifies for a PM-FASAL (PM Fasal Bima Yojana)
    insurance claim based on estimated yield vs. district historical average.
    Threshold: shortfall > 20% = eligible.
    """
    crop_key = body.crop_type.lower()
    crop_yields = HISTORICAL_YIELDS.get(crop_key, {})
    historical = crop_yields.get(body.state) or crop_yields.get("default", 3500)

    shortfall_pct = max(0.0, (historical - body.estimated_yield) / historical * 100)
    eligible = shortfall_pct >= FASAL_THRESHOLD_PCT

    # Build evidence list
    evidence = []
    if body.ndvi_at_flowering is not None:
        if body.ndvi_at_flowering < 0.35:
            evidence.append(f"Low NDVI at flowering stage: {body.ndvi_at_flowering:.3f} (expected >0.45 for healthy crop)")
        else:
            evidence.append(f"NDVI at flowering: {body.ndvi_at_flowering:.3f}")

    if body.total_rainfall_mm is not None:
        if body.total_rainfall_mm < 300:
            evidence.append(f"Insufficient rainfall: {body.total_rainfall_mm:.0f}mm (drought conditions)")
        else:
            evidence.append(f"Seasonal rainfall: {body.total_rainfall_mm:.0f}mm")

    return {
        "eligible":          eligible,
        "crop_type":         body.crop_type,
        "state":             body.state,
        "estimated_yield":   body.estimated_yield,
        "historical_avg":    historical,
        "shortfall_pct":     round(shortfall_pct, 1),
        "threshold_pct":     FASAL_THRESHOLD_PCT,
        "area_ha":           body.area_ha,
        "potential_claim_ha": round(body.area_ha * historical * 0.35, 0) if eligible else 0,
        "status_message":    (
            f"Eligible for PM-FASAL claim — {shortfall_pct:.1f}% shortfall exceeds {FASAL_THRESHOLD_PCT}% threshold."
            if eligible else
            f"Not eligible — {shortfall_pct:.1f}% shortfall is below the {FASAL_THRESHOLD_PCT}% claim threshold."
        ),
        "evidence":          evidence,
        "next_steps": [
            "Contact your district Krishi Vibhag office with this report",
            "Submit claim at pmfby.gov.in within 72 hours of crop loss",
            "Attach GPS field photographs and this Croppy field health report",
            "Claim deadline: 2 weeks from date of loss",
        ] if eligible else [],
        "scheme_name":       "PM Fasal Bima Yojana (PMFBY)",
        "helpline":          "1800-180-1551 (toll-free)",
    }


def _build_farm_record_pdf(req: FarmRecordRequest) -> bytes:
    """Generate KCC / bank farm record PDF using ReportLab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.enums import TA_CENTER

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2.5*cm, rightMargin=2.5*cm,
                            topMargin=2.5*cm, bottomMargin=2.5*cm)

    GREEN   = HexColor("#2e7d32")
    LGGREEN = HexColor("#e8f5e9")
    DARK    = HexColor("#1b2e1f")
    MUTED   = HexColor("#6b8a72")

    styles = getSampleStyleSheet()
    title_s = ParagraphStyle("T", fontSize=20, textColor=GREEN, alignment=TA_CENTER, spaceAfter=4)
    sub_s   = ParagraphStyle("S", fontSize=11, textColor=MUTED, alignment=TA_CENTER, spaceAfter=2)
    h2_s    = ParagraphStyle("H2", fontSize=13, textColor=GREEN, spaceBefore=16, spaceAfter=8,
                              fontName="Helvetica-Bold")
    body_s  = ParagraphStyle("B", fontSize=10, textColor=DARK, leading=16)
    muted_s = ParagraphStyle("M", fontSize=9, textColor=MUTED)

    story = []

    story.append(Paragraph("FARM RECORD", title_s))
    story.append(Paragraph("For Kisan Credit Card (KCC) / Crop Loan Application", sub_s))
    story.append(Paragraph(f"Generated by Croppy Precision Agriculture Platform — {datetime.utcnow().strftime('%d %B %Y')}", muted_s))
    story.append(HRFlowable(width="100%", thickness=1.5, color=GREEN, spaceAfter=14))

    story.append(Paragraph("Farmer & Field Details", h2_s))
    rows = [
        ["Farmer Name",    req.farmer_name],
        ["Village",        req.village],
        ["District",       req.district],
        ["State",          req.state],
        ["Field Name",     req.field_name],
        ["Crop",           req.crop_type.title()],
        ["Area",           f"{req.area_ha} hectares ({req.area_ha * 2.471:.2f} acres)"],
        ["Irrigation",     req.irrigation_type.title()],
        ["Sowing Date",    req.sowing_date or "Not specified"],
        ["Expected Harvest", req.expected_harvest or "Not specified"],
    ]
    if req.estimated_yield:
        rows.append(["Estimated Yield", f"{req.estimated_yield} kg/ha"])
    if req.bank_branch:
        rows.append(["Bank Branch",    req.bank_branch])

    tbl = Table(rows, colWidths=[6*cm, 11*cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LGGREEN),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), GREEN),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#c8e6c9")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [white, HexColor("#f1f8f2")]),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(tbl)

    story.append(Paragraph("Declaration", h2_s))
    story.append(Paragraph(
        f"I, <b>{req.farmer_name}</b>, hereby declare that the information furnished above is true and correct "
        f"to the best of my knowledge. The above mentioned land with {req.area_ha} ha is under my cultivation "
        f"for <b>{req.crop_type.title()}</b> crop during the current season.",
        body_s
    ))

    story.append(Spacer(1, 40))
    sig_data = [
        ["Farmer Signature / Thumb Impression", "Verified by (Village Accountant / Patwari)"],
        ["", ""],
        ["________________________", "________________________"],
        [req.farmer_name, "Name & Seal"],
    ]
    sig_tbl = Table(sig_data, colWidths=[9*cm, 9*cm])
    sig_tbl.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, 0), GREEN),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ]))
    story.append(sig_tbl)

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#c8e6c9")))
    story.append(Paragraph(
        "This record is system-generated by Croppy using satellite field boundary data. "
        "For official KCC applications, this document must be co-signed by a revenue official.",
        muted_s
    ))

    doc.build(story)
    return buf.getvalue()


@router.post("/farm-record", summary="Generate farm record PDF for KCC / crop loan application")
async def generate_farm_record(body: FarmRecordRequest, _user: dict = Depends(get_current_user)):
    """
    Generates a farmer land record PDF that can be submitted to a bank for
    Kisan Credit Card (KCC) or crop loan application.
    Pulls field data if field_id provided.
    """
    try:
        pdf_bytes = _build_farm_record_pdf(body)
        fname = f"farm_record_{body.farmer_name.replace(' ','_')}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )
    except ImportError:
        # ReportLab not installed — return JSON
        return {
            "status": "ok",
            "message": "Install reportlab for PDF generation (pip install reportlab)",
            "farm_data": body.model_dump(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/field-record/{field_id}", summary="Get field data for pre-filling farm record")
async def get_field_for_record(field_id: str, user: dict = Depends(get_current_user)):
    """Returns field data formatted for the farm record PDF form."""
    supabase = get_supabase()
    res = supabase.table("fields").select("*").eq("id", field_id).eq("user_id", user["id"]).maybe_single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Field not found")
    f = res.data
    return {
        "field_name":    f.get("name"),
        "crop_type":     f.get("crop_type"),
        "area_ha":       f.get("area_ha"),
        "sowing_date":   f.get("sowing_date"),
        "state":         f.get("state"),
        "district":      f.get("district"),
        "irrigation_type": f.get("irrigation_type"),
        "lat":           f.get("lat"),
        "lon":           f.get("lon"),
    }
