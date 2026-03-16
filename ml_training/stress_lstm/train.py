"""
LSTM Temporal Stress Forecast Training Script
============================================
Trains a 2-layer LSTM on synthetic/historical crop stress data.

Input sequence (12 time steps):
  [NDVI, EVI, NDWI, soil_moisture, temp_c, humidity_pct]

Output:
  Binary stress probability for next 7 days (0 = no stress, 1 = stress)

Usage:
  python ml_training/stress_lstm/train.py --output_dir ./ml_models

Exports:
  ml_models/stress_lstm.pt       — PyTorch model state dict
  ml_models/lstm_scaler.pkl      — MinMaxScaler for input normalisation
  ml_models/lstm_metadata.json   — model metadata
"""
import argparse
import json
import pickle
import warnings
from pathlib import Path

import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")

SEQUENCE_LENGTH = 12
N_FEATURES      = 6
SEED            = 42

np.random.seed(SEED)


# ─── Synthetic Data Generator ─────────────────────────────────────────────────

def generate_healthy_sequence() -> np.ndarray:
    ndvi     = np.random.uniform(0.45, 0.80, SEQUENCE_LENGTH) + np.random.normal(0, 0.03, SEQUENCE_LENGTH)
    evi      = ndvi * np.random.uniform(0.65, 0.80, SEQUENCE_LENGTH)
    ndwi     = np.random.uniform(0.10, 0.40, SEQUENCE_LENGTH)
    soil_m   = np.random.uniform(28, 55, SEQUENCE_LENGTH)
    temp_c   = np.random.uniform(20, 30, SEQUENCE_LENGTH) + np.random.normal(0, 1.5, SEQUENCE_LENGTH)
    humidity = np.random.uniform(55, 78, SEQUENCE_LENGTH)
    return np.column_stack([ndvi, evi, ndwi, soil_m, temp_c, humidity])


def generate_stress_sequence(stress_type: str = "drought") -> np.ndarray:
    if stress_type == "drought":
        ndvi     = np.linspace(0.50, 0.22, SEQUENCE_LENGTH) + np.random.normal(0, 0.025, SEQUENCE_LENGTH)
        evi      = ndvi * np.random.uniform(0.55, 0.70, SEQUENCE_LENGTH)
        ndwi     = np.linspace(0.15, -0.25, SEQUENCE_LENGTH) + np.random.normal(0, 0.02, SEQUENCE_LENGTH)
        soil_m   = np.linspace(30, 14, SEQUENCE_LENGTH) + np.random.normal(0, 2, SEQUENCE_LENGTH)
        temp_c   = np.random.uniform(33, 42, SEQUENCE_LENGTH)
        humidity = np.random.uniform(25, 48, SEQUENCE_LENGTH)
    elif stress_type == "disease":
        ndvi     = np.linspace(0.55, 0.28, SEQUENCE_LENGTH) + np.random.normal(0, 0.03, SEQUENCE_LENGTH)
        evi      = ndvi * np.random.uniform(0.60, 0.72, SEQUENCE_LENGTH)
        ndwi     = np.random.uniform(-0.05, 0.20, SEQUENCE_LENGTH)
        soil_m   = np.random.uniform(30, 50, SEQUENCE_LENGTH)
        temp_c   = np.random.uniform(22, 30, SEQUENCE_LENGTH)
        humidity = np.random.uniform(80, 96, SEQUENCE_LENGTH)
    elif stress_type == "waterlogging":
        ndvi     = np.linspace(0.52, 0.30, SEQUENCE_LENGTH) + np.random.normal(0, 0.025, SEQUENCE_LENGTH)
        evi      = ndvi * np.random.uniform(0.58, 0.72, SEQUENCE_LENGTH)
        ndwi     = np.linspace(0.20, 0.60, SEQUENCE_LENGTH)
        soil_m   = np.random.uniform(65, 95, SEQUENCE_LENGTH)
        temp_c   = np.random.uniform(24, 30, SEQUENCE_LENGTH)
        humidity = np.random.uniform(75, 92, SEQUENCE_LENGTH)
    else:
        ndvi     = np.random.uniform(0.15, 0.38, SEQUENCE_LENGTH) + np.random.normal(0, 0.03, SEQUENCE_LENGTH)
        evi      = ndvi * np.random.uniform(0.55, 0.70, SEQUENCE_LENGTH)
        ndwi     = np.random.uniform(-0.30, 0.10, SEQUENCE_LENGTH)
        soil_m   = np.random.uniform(10, 28, SEQUENCE_LENGTH)
        temp_c   = np.random.uniform(28, 40, SEQUENCE_LENGTH)
        humidity = np.random.uniform(30, 55, SEQUENCE_LENGTH)
    return np.column_stack([ndvi, evi, ndwi, soil_m, temp_c, humidity])


def generate_dataset(n_samples: int = 8000):
    X, y = [], []
    n_healthy  = n_samples // 2
    n_stressed = n_samples - n_healthy
    stress_types = ["drought", "disease", "waterlogging", "mixed"]

    for _ in range(n_healthy):
        X.append(generate_healthy_sequence())
        y.append(0)

    per_type = n_stressed // len(stress_types)
    for stress_type in stress_types:
        for _ in range(per_type):
            X.append(generate_stress_sequence(stress_type))
            y.append(1)

    remainder = n_stressed - per_type * len(stress_types)
    for _ in range(remainder):
        X.append(generate_stress_sequence("drought"))
        y.append(1)

    X = np.array(X)
    y = np.array(y)
    idx = np.random.permutation(len(X))
    return X[idx], y[idx]


# ─── Model ────────────────────────────────────────────────────────────────────

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
        out = out[:, -1, :]          # last time step
        out = self.dropout(out)
        out = self.relu(self.fc1(out))
        out = self.sigmoid(self.fc2(out))
        return out.squeeze(1)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main(n_samples: int, epochs: int, output_dir: str):
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    torch.manual_seed(SEED)

    print(f"\nGenerating {n_samples} synthetic crop stress sequences...")
    X_raw, y = generate_dataset(n_samples)

    N, T, F = X_raw.shape
    X_flat  = X_raw.reshape(N * T, F)

    scaler   = MinMaxScaler()
    X_scaled = scaler.fit_transform(X_flat).reshape(N, T, F)

    scaler_path = output / "lstm_scaler.pkl"
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)
    print(f"  Scaler saved -> {scaler_path}")

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.15, random_state=SEED, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.15, random_state=SEED, stratify=y_train
    )
    print(f"  Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")

    # Convert to tensors
    def to_tensor(X, y):
        return (torch.tensor(X, dtype=torch.float32),
                torch.tensor(y, dtype=torch.float32))

    Xt, yt       = to_tensor(X_train, y_train)
    Xv, yv       = to_tensor(X_val,   y_val)
    Xte, yte     = to_tensor(X_test,  y_test)

    model     = StressLSTM()
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=4, factor=0.5)

    best_val_loss = float("inf")
    best_state    = None
    patience_cnt  = 0
    PATIENCE      = 8
    BATCH         = 64

    print("\nTraining LSTM model...")
    for epoch in range(epochs):
        model.train()
        idx = torch.randperm(len(Xt))
        train_loss = 0.0
        for i in range(0, len(Xt), BATCH):
            b = idx[i:i+BATCH]
            optimizer.zero_grad()
            loss = criterion(model(Xt[b]), yt[b])
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(b)
        train_loss /= len(Xt)

        model.eval()
        with torch.no_grad():
            val_loss = criterion(model(Xv), yv).item()
        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state    = {k: v.clone() for k, v in model.state_dict().items()}
            patience_cnt  = 0
        else:
            patience_cnt += 1

        if (epoch + 1) % 5 == 0:
            print(f"  Epoch {epoch+1:3d}/{epochs} | train_loss={train_loss:.4f} | val_loss={val_loss:.4f}")

        if patience_cnt >= PATIENCE:
            print(f"  Early stopping at epoch {epoch+1}")
            break

    model.load_state_dict(best_state)

    # Evaluate
    model.eval()
    with torch.no_grad():
        probs = model(Xte).numpy()
        preds = (probs > 0.5).astype(int)
    acc = (preds == yte.numpy().astype(int)).mean()
    auc = roc_auc_score(yte.numpy(), probs)
    print(f"\nTest  Accuracy: {acc:.4f} | AUC: {auc:.4f}")
    print(classification_report(yte.numpy().astype(int), preds, target_names=["Healthy", "Stressed"]))

    # Save
    pt_path = output / "stress_lstm.pt"
    torch.save({"model_state": best_state, "architecture": "StressLSTM"}, str(pt_path))
    print(f"Model saved -> {pt_path}")

    meta = {
        "features":          ["NDVI", "EVI", "NDWI", "soil_moisture", "temp_c", "humidity_pct"],
        "sequence_length":   SEQUENCE_LENGTH,
        "n_features":        N_FEATURES,
        "test_accuracy":     round(float(acc), 4),
        "test_auc":          round(float(auc), 4),
        "n_training_samples": n_samples,
        "framework":         "pytorch",
    }
    with open(output / "lstm_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Metadata saved -> {output / 'lstm_metadata.json'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--n_samples",  type=int, default=8000)
    parser.add_argument("--epochs",     type=int, default=40)
    parser.add_argument("--output_dir", default="./ml_models")
    args = parser.parse_args()
    main(args.n_samples, args.epochs, args.output_dir)
