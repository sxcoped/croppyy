"""
LSTM stress forecast inference service.
Loads trained PyTorch model + scaler and runs inference on a 12-step input sequence.
Returns 7-day stress probability and severity score.
"""
import json
import pickle
import numpy as np
from pathlib import Path

_model    = None
_scaler   = None
_metadata = None

MODEL_PATH  = Path("./ml_models/stress_lstm.pt")
SCALER_PATH = Path("./ml_models/lstm_scaler.pkl")
META_PATH   = Path("./ml_models/lstm_metadata.json")


def _load():
    global _model, _scaler, _metadata
    if _model is not None:
        return

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"LSTM model not found at {MODEL_PATH}. "
            "Run: python ml_training/stress_lstm/train.py"
        )

    import torch
    import torch.nn as nn

    class StressLSTM(nn.Module):
        def __init__(self, input_size=6, hidden1=64, hidden2=32, fc_size=16, dropout=0.2):
            super().__init__()
            self.lstm1   = nn.LSTM(input_size, hidden1, batch_first=True, dropout=dropout)
            self.lstm2   = nn.LSTM(hidden1, hidden2, batch_first=True, dropout=dropout)
            self.dropout = nn.Dropout(0.3)
            self.fc1     = nn.Linear(hidden2, fc_size)
            self.relu    = nn.ReLU()
            self.fc2     = nn.Linear(fc_size, 1)
            self.sigmoid = nn.Sigmoid()

        def forward(self, x):
            out, _ = self.lstm1(x)
            out, _ = self.lstm2(out)
            out = out[:, -1, :]
            out = self.dropout(out)
            out = self.relu(self.fc1(out))
            out = self.sigmoid(self.fc2(out))
            return out.squeeze(1)

    checkpoint = torch.load(str(MODEL_PATH), map_location="cpu", weights_only=True)
    _model = StressLSTM()
    _model.load_state_dict(checkpoint["model_state"])
    _model.eval()

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

    import torch

    arr = np.array(sequence, dtype=np.float32)   # (12, 6)
    if arr.shape != (12, 6):
        raise ValueError(f"Expected shape (12, 6), got {arr.shape}")

    if _scaler is not None:
        arr = _scaler.transform(arr).reshape(1, 12, 6)
    else:
        arr = arr.reshape(1, 12, 6)

    tensor = torch.tensor(arr, dtype=torch.float32)
    with torch.no_grad():
        prob = float(_model(tensor).item())

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
