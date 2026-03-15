"""
PDF report generation route.
Uses ReportLab to generate a professional field health report.
Falls back to a JSON summary if ReportLab is not installed.
"""
import io
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter(prefix="/api/reports", tags=["Reports"])


class ReportRequest(BaseModel):
    field_name: str
    lat: float
    lon: float
    crop_type: str
    state: str
    indices: Optional[Dict[str, Any]] = None
    pest_alerts: Optional[list] = None
    weather: Optional[Dict[str, Any]] = None
    generated_by: str = "Croppy AI Platform"


def _build_pdf(req: ReportRequest) -> bytes:
    """Generate PDF report using ReportLab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor, white, black
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    GREEN = HexColor("#2e7d32")
    LIGHT_GREEN = HexColor("#e8f5e9")
    DARK = HexColor("#1b2e1f")
    MUTED = HexColor("#6b8a72")

    title_style = ParagraphStyle("Title", parent=styles["Title"],
                                 fontSize=22, textColor=GREEN, spaceAfter=4)
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"],
                               fontSize=13, textColor=GREEN, spaceBefore=14, spaceAfter=6)
    body_style = ParagraphStyle("Body", parent=styles["Normal"],
                                fontSize=10, textColor=DARK, leading=16)
    muted_style = ParagraphStyle("Muted", parent=styles["Normal"],
                                  fontSize=9, textColor=MUTED)

    story = []

    # ── Header ──────────────────────────────────────────────────────────────
    story.append(Paragraph("🌿 Croppy — Field Health Report", title_style))
    story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%B %d, %Y %H:%M UTC')}", muted_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GREEN, spaceAfter=12))

    # ── Field Info ───────────────────────────────────────────────────────────
    story.append(Paragraph("Field Information", h2_style))
    info_data = [
        ["Field Name", req.field_name],
        ["Crop", req.crop_type.title()],
        ["Location", f"{req.lat:.4f}°N, {req.lon:.4f}°E"],
        ["State", req.state],
        ["Report By", req.generated_by],
    ]
    info_table = Table(info_data, colWidths=[5*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GREEN),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), GREEN),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#c8e6c9")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [white, HexColor("#f1f8f2")]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)

    # ── Vegetation Indices ────────────────────────────────────────────────────
    if req.indices:
        story.append(Paragraph("Vegetation & Soil Indices", h2_style))
        idx_data = [["Index", "Value", "Health Zone", "Interpretation"]]
        for key, val in req.indices.items():
            if isinstance(val, dict):
                v = f"{val.get('value', 'N/A'):.4f}" if isinstance(val.get('value'), float) else "N/A"
                idx_data.append([key, v, val.get("health_zone", "—"), val.get("description", "—")])
        idx_table = Table(idx_data, colWidths=[2.5*cm, 2.5*cm, 3*cm, 9*cm])
        idx_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GREEN),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.4, HexColor("#c8e6c9")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#f1f8f2")]),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(idx_table)

    # ── Pest Alerts ────────────────────────────────────────────────────────────
    if req.pest_alerts:
        story.append(Paragraph("Pest Risk Alerts", h2_style))
        for alert in req.pest_alerts:
            color = {"High": "#ef5350", "Medium": "#ffb300", "Low": "#66bb6a"}.get(alert.get("risk_level", "Low"), "#66bb6a")
            story.append(Paragraph(
                f"<b>{alert.get('pest', 'Unknown')}</b> — Risk: <font color='{color}'>{alert.get('risk_level', '—')}</font>",
                body_style
            ))
            story.append(Paragraph(alert.get("recommendation", ""), body_style))
            story.append(Spacer(1, 6))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#c8e6c9")))
    story.append(Paragraph(
        "This report is generated by Croppy using Sentinel-2 satellite imagery via Google Earth Engine. "
        "For ground verification, consult a certified agronomist.",
        muted_style
    ))

    doc.build(story)
    return buf.getvalue()


def _build_json_summary(req: ReportRequest) -> dict:
    """Fallback JSON report when ReportLab is not available."""
    return {
        "report_type": "Field Health Report",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "field": {
            "name": req.field_name,
            "lat": req.lat,
            "lon": req.lon,
            "crop": req.crop_type,
            "state": req.state,
        },
        "indices": req.indices,
        "pest_alerts": req.pest_alerts,
        "weather": req.weather,
    }


@router.post("/generate", summary="Generate field health PDF report")
async def generate_report(req: ReportRequest):
    try:
        pdf_bytes = _build_pdf(req)
        filename = f"croppy_report_{req.field_name.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ImportError:
        # ReportLab not installed — return JSON summary
        return _build_json_summary(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
