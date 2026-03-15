"""
LSTM stress forecast inference service.
Loads trained model + scaler and runs inference on a 12-step input sequence.
Returns 7-day stress probability and severity score.
"""
import json
import pickle
import numpy as np
from pathlib import Path
from typing import Optional

_model = None
_scaler = None
_metadata = None

MODEL_PATH   = Path("./ml_models/stress_lstm.h5")
SCALER_PATH  = Path("./ml_models/lstm_scaler.pkl")
META_PATH    = Path("./ml_models/lstm_metadata.json")


def _load():
    global _model, _scaler, _metadata
    if _model is not None:
        return

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"LSTM model not found at {MODEL_PATH}. "
            "Run: python ml_training/stress_lstm/train.py"
        )

    import tensorflow as tf
    _model = tf.keras.models.load_model(str(MODEL_PATH))

    if SCALER_PATH.exists():
        with open(SCALER_PATH, "rb") as f:
            _scaler = pickle.load(f)

    if META_PATH.exists():
        with open(META_PATH) as f:
            _metadata = json.load(f)


def predict_stress(sequence: list[list[float]]) -> dict:
    """
    sequence: list of 12 items, each [ndvi, evi, ndwi, soil_moisture, temp_c, humidity_pct]
    Returns dict with stress_probability, severity_score, risk_level, forecast_days
    """
    _load()

    arr = np.array(sequence, dtype=np.float32)   # (12, 6)
    if arr.shape != (12, 6):
        raise ValueError(f"Expected shape (12, 6), got {arr.shape}")

    # Normalise using fitted scaler
    if _scaler is not None:
        arr_flat = arr.reshape(12 * 6).reshape(-1, 6)  # (12, 6)
        arr = _scaler.transform(arr_flat).reshape(1, 12, 6)
    else:
        arr = arr.reshape(1, 12, 6)

    prob = float(_model.predict(arr, verbose=0)[0][0])

    # Severity score: amplify to 0–1 range
    severity = round(min(prob * 1.2, 1.0), 3)

    if prob >= 0.7:
        risk_level = "High"
    elif prob >= 0.4:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return {
        "stress_probability": round(prob, 4),
        "severity_score":     severity,
        "risk_level":         risk_level,
        "forecast_days":      7,
        "model_version":      _metadata.get("test_auc", "unknown") if _metadata else "unknown",
    }
