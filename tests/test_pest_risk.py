"""
Tests for the pest risk rule engine — no GEE or ML needed.
Run with: pytest tests/test_pest_risk.py -v
"""
import sys
sys.path.insert(0, ".")

from backend.services.pest_risk import evaluate_pest_risk


def test_rice_blast_high_risk():
    result = evaluate_pest_risk(
        crop_type="rice",
        air_temp=25,
        humidity=92,
        leaf_wetness=12,
    )
    assert result["overall_risk"] == "High"
    pests = [a["pest"] for a in result["alerts"]]
    assert any("Rice Blast" in p for p in pests)


def test_no_risk_when_no_conditions():
    result = evaluate_pest_risk(crop_type="rice")
    assert result["overall_risk"] == "Low"
    assert len(result["alerts"]) == 0


def test_wheat_rust():
    result = evaluate_pest_risk(
        crop_type="wheat",
        air_temp=18,
        humidity=90,
        leaf_wetness=8,
    )
    pests = [a["pest"] for a in result["alerts"]]
    assert any("Rust" in p for p in pests)


def test_cotton_bollworm():
    result = evaluate_pest_risk(
        crop_type="cotton",
        air_temp=32,
        humidity=55,
    )
    pests = [a["pest"] for a in result["alerts"]]
    assert any("Bollworm" in p for p in pests)


def test_potato_late_blight():
    result = evaluate_pest_risk(
        crop_type="potato",
        air_temp=15,
        humidity=95,
        leaf_wetness=10,
    )
    pests = [a["pest"] for a in result["alerts"]]
    assert any("Late Blight" in p for p in pests)
    high = [a for a in result["alerts"] if a["risk_level"] == "High"]
    assert len(high) > 0


def test_wrong_crop_no_alerts():
    # Rice blast rule should NOT trigger for wheat
    result = evaluate_pest_risk(
        crop_type="wheat",
        air_temp=25,
        humidity=92,
        leaf_wetness=12,
    )
    pests = [a["pest"] for a in result["alerts"]]
    assert not any("Rice Blast" in p for p in pests)


def test_alerts_sorted_by_severity():
    result = evaluate_pest_risk(
        crop_type="tomato",
        air_temp=15,
        humidity=95,
        leaf_wetness=10,
    )
    levels = [a["risk_level"] for a in result["alerts"]]
    order = {"High": 0, "Medium": 1, "Low": 2}
    for i in range(len(levels) - 1):
        assert order[levels[i]] <= order[levels[i + 1]]
