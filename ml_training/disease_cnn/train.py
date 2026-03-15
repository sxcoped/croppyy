"""
Train MobileNetV2 on PlantVillage dataset for leaf disease classification.

Dataset: https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset
         (download the 'color' subset — 54,306 images, 38 classes)

Usage:
    python ml_training/disease_cnn/train.py \
        --data_dir /path/to/PlantVillage/color \
        --output_dir ./ml_models \
        --epochs 20 \
        --batch_size 32

After training, exports:
    ml_models/disease_model.h5       — full Keras model
    ml_models/disease_model.tflite   — quantized TFLite for mobile/edge
    ml_models/class_names.json       — ordered list of class labels
"""
import argparse
import json
import os
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.callbacks import (
    EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
)
from tensorflow.keras.preprocessing.image import ImageDataGenerator

IMG_SIZE = 224
SEED     = 42


def build_model(num_classes: int) -> Model:
    base = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    # Freeze base initially
    base.trainable = False

    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = base(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(256, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    return Model(inputs, outputs)


def export_tflite(model: Model, output_path: str):
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    with open(output_path, "wb") as f:
        f.write(tflite_model)
    print(f"TFLite model saved → {output_path}")


def main(data_dir: str, output_dir: str, epochs: int, batch_size: int):
    data_dir   = Path(data_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Data generators ───────────────────────────────────────────────────────
    train_gen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=30,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        vertical_flip=True,
        brightness_range=[0.7, 1.3],
        zoom_range=0.2,
        validation_split=0.15,
    )

    train_ds = train_gen.flow_from_directory(
        data_dir,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=batch_size,
        class_mode="categorical",
        subset="training",
        seed=SEED,
    )

    val_ds = train_gen.flow_from_directory(
        data_dir,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=batch_size,
        class_mode="categorical",
        subset="validation",
        seed=SEED,
    )

    num_classes = len(train_ds.class_indices)
    print(f"Classes found: {num_classes}")

    # Save class names in consistent order
    class_names = [None] * num_classes
    for name, idx in train_ds.class_indices.items():
        class_names[idx] = name

    with open(output_dir / "class_names.json", "w") as f:
        json.dump(class_names, f, indent=2)
    print(f"Class names saved → {output_dir / 'class_names.json'}")

    # ── Phase 1: Train head only ──────────────────────────────────────────────
    model = build_model(num_classes)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks_phase1 = [
        EarlyStopping(patience=5, restore_best_weights=True, monitor="val_accuracy"),
        ReduceLROnPlateau(factor=0.5, patience=3, monitor="val_loss"),
    ]

    print("\n=== Phase 1: Training head (base frozen) ===")
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=min(epochs, 10),
        callbacks=callbacks_phase1,
    )

    # ── Phase 2: Fine-tune top layers of base ─────────────────────────────────
    base_model = model.layers[1]
    base_model.trainable = True

    # Freeze all layers except last 30
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    ckpt_path = str(output_dir / "disease_model_best.h5")
    callbacks_phase2 = [
        EarlyStopping(patience=5, restore_best_weights=True, monitor="val_accuracy"),
        ModelCheckpoint(ckpt_path, save_best_only=True, monitor="val_accuracy"),
        ReduceLROnPlateau(factor=0.3, patience=3, monitor="val_loss"),
    ]

    print("\n=== Phase 2: Fine-tuning top layers ===")
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=epochs,
        callbacks=callbacks_phase2,
    )

    # ── Save ──────────────────────────────────────────────────────────────────
    h5_path = str(output_dir / "disease_model.h5")
    model.save(h5_path)
    print(f"\nModel saved → {h5_path}")

    tflite_path = str(output_dir / "disease_model.tflite")
    export_tflite(model, tflite_path)

    # Evaluate on validation set
    loss, acc = model.evaluate(val_ds)
    print(f"\nValidation accuracy: {acc:.4f}  |  Loss: {loss:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Croppy disease detection CNN")
    parser.add_argument("--data_dir",   required=True,  help="Path to PlantVillage color/ directory")
    parser.add_argument("--output_dir", default="./ml_models", help="Where to save the model")
    parser.add_argument("--epochs",     type=int, default=20)
    parser.add_argument("--batch_size", type=int, default=32)
    args = parser.parse_args()

    main(args.data_dir, args.output_dir, args.epochs, args.batch_size)
