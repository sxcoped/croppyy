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
  ml_models/stress_lstm.h5       — Keras model
  ml_models/stress_lstm.tflite   — Quantized TFLite
  ml_models/lstm_scaler.pkl      — MinMaxScaler for input normalisation
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

SEQUENCE_LENGTH = 12    # 12 x ~5-day Sentinel-2 revisit = ~60-day lookback
N_FEATURES      = 6     # NDVI, EVI, NDWI, soil_moisture, temp_c, humidity
SEED            = 42

np.random.seed(SEED)


# ─── Synthetic Data Generator ──────────────────────────────────────────────────

def generate_healthy_sequence() -> np.ndarray:
    """Simulate healthy crop conditions."""
    ndvi         = np.random.uniform(0.45, 0.80, SEQUENCE_LENGTH) + np.random.normal(0, 0.03, SEQUENCE_LENGTH)
    evi          = ndvi * np.random.uniform(0.65, 0.80, SEQUENCE_LENGTH)
    ndwi         = np.random.uniform(0.10, 0.40, SEQUENCE_LENGTH)
    soil_m       = np.random.uniform(28, 55, SEQUENCE_LENGTH)
    temp_c       = np.random.uniform(20, 30, SEQUENCE_LENGTH) + np.random.normal(0, 1.5, SEQUENCE_LENGTH)
    humidity     = np.random.uniform(55, 78, SEQUENCE_LENGTH)
    return np.column_stack([ndvi, evi, ndwi, soil_m, temp_c, humidity])


def generate_stress_sequence(stress_type: str = "drought") -> np.ndarray:
    """Simulate stressed crop conditions."""
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
    else:  # mixed / random stress
        ndvi     = np.random.uniform(0.15, 0.38, SEQUENCE_LENGTH) + np.random.normal(0, 0.03, SEQUENCE_LENGTH)
        evi      = ndvi * np.random.uniform(0.55, 0.70, SEQUENCE_LENGTH)
        ndwi     = np.random.uniform(-0.30, 0.10, SEQUENCE_LENGTH)
        soil_m   = np.random.uniform(10, 28, SEQUENCE_LENGTH)
        temp_c   = np.random.uniform(28, 40, SEQUENCE_LENGTH)
        humidity = np.random.uniform(30, 55, SEQUENCE_LENGTH)

    return np.column_stack([ndvi, evi, ndwi, soil_m, temp_c, humidity])


def generate_dataset(n_samples: int = 8000):
    """Generate balanced synthetic dataset."""
    X, y = [], []

    n_healthy = n_samples // 2
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

    # Fill remainder with drought
    remainder = n_stressed - per_type * len(stress_types)
    for _ in range(remainder):
        X.append(generate_stress_sequence("drought"))
        y.append(1)

    X = np.array(X)   # (N, 12, 6)
    y = np.array(y)   # (N,)

    # Shuffle
    idx = np.random.permutation(len(X))
    return X[idx], y[idx]


# ─── Model Building ────────────────────────────────────────────────────────────

def build_model(input_shape: tuple):
    import tensorflow as tf
    from tensorflow.keras import layers, Model

    inputs = tf.keras.Input(shape=input_shape)
    x = layers.LSTM(64, return_sequences=True, dropout=0.2, recurrent_dropout=0.1)(inputs)
    x = layers.LSTM(32, dropout=0.2)(x)
    x = layers.Dense(16, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(1, activation="sigmoid")(x)

    model = Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="binary_crossentropy",
        metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
    )
    return model


def export_tflite(model, output_path: str):
    import tensorflow as tf
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    with open(output_path, "wb") as f:
        f.write(tflite_model)
    print(f"TFLite model → {output_path}")


# ─── Main ──────────────────────────────────────────────────────────────────────

def main(n_samples: int, epochs: int, output_dir: str):
    import tensorflow as tf
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    print(f"\n🌱 Generating {n_samples} synthetic crop stress sequences…")
    X_raw, y = generate_dataset(n_samples)
    print(f"   Class distribution: healthy={int(y.sum() == 0)} | stressed={int(y.sum())}")

    # Normalise each feature independently (fit on train only)
    N, T, F = X_raw.shape
    X_flat = X_raw.reshape(N * T, F)

    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X_flat).reshape(N, T, F)

    # Save scaler
    scaler_path = output / "lstm_scaler.pkl"
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)
    print(f"   Scaler saved → {scaler_path}")

    # Train/val/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.15, random_state=SEED, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.15, random_state=SEED, stratify=y_train
    )

    print(f"   Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")

    print("\n🧠 Training LSTM model…")
    model = build_model(input_shape=(T, F))
    model.summary()

    callbacks = [
        EarlyStopping(patience=8, restore_best_weights=True, monitor="val_auc", mode="max"),
        ReduceLROnPlateau(factor=0.5, patience=4, monitor="val_loss"),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=64,
        callbacks=callbacks,
        verbose=1,
    )

    # ── Evaluate ─────────────────────────────────────────────────────────────
    print("\n📊 Test evaluation:")
    loss, acc, auc = model.evaluate(X_test, y_test, verbose=0)
    print(f"   Loss: {loss:.4f} | Accuracy: {acc:.4f} | AUC: {auc:.4f}")

    y_pred = (model.predict(X_test, verbose=0) > 0.5).astype(int).flatten()
    print(classification_report(y_test, y_pred, target_names=["Healthy", "Stressed"]))

    # ── Save ─────────────────────────────────────────────────────────────────
    h5_path = str(output / "stress_lstm.h5")
    model.save(h5_path)
    print(f"\n✅ Keras model → {h5_path}")

    export_tflite(model, str(output / "stress_lstm.tflite"))

    # Save metadata
    meta = {
        "features": ["NDVI", "EVI", "NDWI", "soil_moisture", "temp_c", "humidity_pct"],
        "sequence_length": SEQUENCE_LENGTH,
        "n_features": N_FEATURES,
        "test_accuracy": round(float(acc), 4),
        "test_auc": round(float(auc), 4),
        "n_training_samples": n_samples,
    }
    with open(output / "lstm_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)
    print(f"   Metadata → {output / 'lstm_metadata.json'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--n_samples",  type=int, default=8000)
    parser.add_argument("--epochs",     type=int, default=40)
    parser.add_argument("--output_dir", default="./ml_models")
    args = parser.parse_args()
    main(args.n_samples, args.epochs, args.output_dir)
