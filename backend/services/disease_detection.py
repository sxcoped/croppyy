"""
CNN disease detection service.
Uses MobileNetV2 fine-tuned on PlantVillage dataset.

PlantVillage classes (38):
  Apple___Apple_scab, Apple___Black_rot, Apple___Cedar_apple_rust, Apple___healthy,
  Blueberry___healthy, Cherry___Powdery_mildew, Cherry___healthy,
  Corn___Cercospora_leaf_spot, Corn___Common_rust, Corn___Northern_Leaf_Blight, Corn___healthy,
  Grape___Black_rot, Grape___Esca, Grape___Leaf_blight, Grape___healthy,
  Orange___Haunglongbing,
  Peach___Bacterial_spot, Peach___healthy,
  Pepper___Bacterial_spot, Pepper___healthy,
  Potato___Early_blight, Potato___Late_blight, Potato___healthy,
  Raspberry___healthy,
  Soybean___healthy,
  Squash___Powdery_mildew,
  Strawberry___Leaf_scorch, Strawberry___healthy,
  Tomato___Bacterial_spot, Tomato___Early_blight, Tomato___Late_blight,
  Tomato___Leaf_Mold, Tomato___Septoria_leaf_spot,
  Tomato___Spider_mites, Tomato___Target_Spot,
  Tomato___Tomato_Yellow_Leaf_Curl_Virus, Tomato___Tomato_mosaic_virus, Tomato___healthy
"""
import io
import os
import numpy as np
from pathlib import Path
from typing import Optional
from PIL import Image

# ─── Class metadata ───────────────────────────────────────────────────────────

CLASS_INFO = {
    "Apple___Apple_scab":                   ("Apple",   "Apple Scab",                      "Moderate",  "Apply Captan or Myclobutanil fungicide. Remove fallen leaves."),
    "Apple___Black_rot":                    ("Apple",   "Black Rot",                       "High",      "Prune infected branches. Apply Thiophanate-methyl fungicide."),
    "Apple___Cedar_apple_rust":             ("Apple",   "Cedar Apple Rust",                "Medium",    "Apply Mancozeb or Myclobutanil. Remove nearby cedar trees if possible."),
    "Apple___healthy":                      ("Apple",   "Healthy",                         "None",      "No action needed. Continue regular monitoring."),
    "Blueberry___healthy":                  ("Blueberry","Healthy",                        "None",      "No action needed."),
    "Cherry___Powdery_mildew":              ("Cherry",  "Powdery Mildew",                  "Medium",    "Apply Sulphur-based fungicide or Myclobutanil. Improve air circulation."),
    "Cherry___healthy":                     ("Cherry",  "Healthy",                         "None",      "No action needed."),
    "Corn___Cercospora_leaf_spot":          ("Corn",    "Cercospora Leaf Spot (Gray Leaf Spot)", "High", "Apply Azoxystrobin or Pyraclostrobin. Use resistant hybrids."),
    "Corn___Common_rust":                   ("Corn",    "Common Rust",                     "Medium",    "Apply Propiconazole or Tebuconazole fungicide at early stages."),
    "Corn___Northern_Leaf_Blight":          ("Corn",    "Northern Leaf Blight",            "High",      "Apply Trifloxystrobin fungicide. Use resistant varieties next season."),
    "Corn___healthy":                       ("Corn",    "Healthy",                         "None",      "No action needed."),
    "Grape___Black_rot":                    ("Grape",   "Black Rot",                       "High",      "Apply Myclobutanil or Mancozeb before bloom. Remove mummified berries."),
    "Grape___Esca":                         ("Grape",   "Esca (Black Measles)",            "High",      "Remove affected canes. Apply Tebuconazole. No complete cure available."),
    "Grape___Leaf_blight":                  ("Grape",   "Leaf Blight (Isariopsis)",        "Medium",    "Apply Carbendazim or Mancozeb. Ensure proper vine spacing."),
    "Grape___healthy":                      ("Grape",   "Healthy",                         "None",      "No action needed."),
    "Orange___Haunglongbing":               ("Orange",  "Citrus Greening (HLB)",           "Critical",  "No cure. Remove infected trees immediately. Control psyllid vectors with Imidacloprid."),
    "Peach___Bacterial_spot":               ("Peach",   "Bacterial Spot",                  "High",      "Apply fixed copper bactericide. Use resistant cultivars. Avoid overhead irrigation."),
    "Peach___healthy":                      ("Peach",   "Healthy",                         "None",      "No action needed."),
    "Pepper___Bacterial_spot":              ("Pepper",  "Bacterial Spot",                  "High",      "Apply copper hydroxide spray. Remove infected plants. Avoid wet conditions."),
    "Pepper___healthy":                     ("Pepper",  "Healthy",                         "None",      "No action needed."),
    "Potato___Early_blight":               ("Potato",  "Early Blight (Alternaria solani)","Medium",    "Apply Chlorothalonil or Mancozeb. Ensure balanced fertilization."),
    "Potato___Late_blight":                ("Potato",  "Late Blight (P. infestans)",      "Critical",  "Apply Metalaxyl + Mancozeb immediately. Destroy infected plants. Improve drainage."),
    "Potato___healthy":                     ("Potato",  "Healthy",                         "None",      "No action needed."),
    "Raspberry___healthy":                  ("Raspberry","Healthy",                        "None",      "No action needed."),
    "Soybean___healthy":                    ("Soybean", "Healthy",                         "None",      "No action needed."),
    "Squash___Powdery_mildew":              ("Squash",  "Powdery Mildew",                  "Medium",    "Apply potassium bicarbonate or Myclobutanil. Improve air circulation."),
    "Strawberry___Leaf_scorch":             ("Strawberry","Leaf Scorch",                   "Medium",    "Apply Captan fungicide. Remove infected leaves. Avoid overhead irrigation."),
    "Strawberry___healthy":                 ("Strawberry","Healthy",                       "None",      "No action needed."),
    "Tomato___Bacterial_spot":              ("Tomato",  "Bacterial Spot",                  "High",      "Apply copper-based bactericide. Use certified disease-free seeds."),
    "Tomato___Early_blight":               ("Tomato",  "Early Blight",                    "Medium",    "Apply Chlorothalonil or Mancozeb. Remove lower infected leaves."),
    "Tomato___Late_blight":                ("Tomato",  "Late Blight",                     "Critical",  "Apply Metalaxyl + Mancozeb immediately. Destroy infected plants."),
    "Tomato___Leaf_Mold":                   ("Tomato",  "Leaf Mold",                       "Medium",    "Apply Chlorothalonil. Reduce humidity. Improve greenhouse ventilation."),
    "Tomato___Septoria_leaf_spot":          ("Tomato",  "Septoria Leaf Spot",              "Medium",    "Apply Mancozeb or Chlorothalonil. Mulch to reduce soil splash."),
    "Tomato___Spider_mites":               ("Tomato",  "Spider Mites (Two-spotted)",      "Medium",    "Apply Abamectin or Spiromesifen. Maintain adequate moisture."),
    "Tomato___Target_Spot":                ("Tomato",  "Target Spot",                     "Medium",    "Apply Azoxystrobin or Fluxapyroxad fungicide."),
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus":("Tomato","Tomato Yellow Leaf Curl Virus",   "Critical",  "No cure. Remove infected plants. Control whitefly vectors with Imidacloprid."),
    "Tomato___Tomato_mosaic_virus":         ("Tomato",  "Tomato Mosaic Virus",             "High",      "Remove infected plants. Sanitize tools. Use resistant varieties."),
    "Tomato___healthy":                     ("Tomato",  "Healthy",                         "None",      "No action needed."),
}

CLASS_NAMES = list(CLASS_INFO.keys())  # order must match model output

IMG_SIZE = (224, 224)

# ─── Model loader (lazy) ──────────────────────────────────────────────────────

_model = None

def _load_model():
    global _model
    if _model is not None:
        return _model

    from backend.core.config import MODEL_PATH

    model_path = Path(MODEL_PATH)
    if not model_path.exists():
        raise FileNotFoundError(
            f"Disease detection model not found at {MODEL_PATH}. "
            "Run ml_training/train_disease_cnn.py to train and export it."
        )

    # Import TF only when needed — keeps server startup fast
    import tensorflow as tf
    _model = tf.keras.models.load_model(str(model_path))
    return _model


# ─── Inference ────────────────────────────────────────────────────────────────

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)   # shape: (1, 224, 224, 3)


def detect_disease(image_bytes: bytes) -> dict:
    model = _load_model()
    x = preprocess_image(image_bytes)
    preds = model.predict(x, verbose=0)[0]   # shape: (38,)

    top_idx   = int(np.argmax(preds))
    top_conf  = float(preds[top_idx])
    class_key = CLASS_NAMES[top_idx]

    crop, disease, severity, treatment = CLASS_INFO.get(
        class_key,
        ("Unknown", "Unknown", "Unknown", "Please consult an agronomist.")
    )

    return {
        "predicted_class": class_key,
        "confidence":      round(top_conf, 4),
        "crop":            crop,
        "disease":         disease,
        "severity":        severity,
        "treatment":       treatment,
        "is_healthy":      "healthy" in class_key.lower(),
    }


# ─── TFLite inference (for mobile / offline) ─────────────────────────────────

_tflite_interpreter = None

def detect_disease_tflite(image_bytes: bytes) -> dict:
    global _tflite_interpreter

    from backend.core.config import TFLITE_MODEL_PATH
    import tensorflow as tf

    if _tflite_interpreter is None:
        model_path = Path(TFLITE_MODEL_PATH)
        if not model_path.exists():
            raise FileNotFoundError(f"TFLite model not found at {TFLITE_MODEL_PATH}")
        _tflite_interpreter = tf.lite.Interpreter(model_path=str(model_path))
        _tflite_interpreter.allocate_tensors()

    interp = _tflite_interpreter
    input_details  = interp.get_input_details()
    output_details = interp.get_output_details()

    x = preprocess_image(image_bytes)
    interp.set_tensor(input_details[0]["index"], x)
    interp.invoke()
    preds = interp.get_tensor(output_details[0]["index"])[0]

    top_idx   = int(np.argmax(preds))
    top_conf  = float(preds[top_idx])
    class_key = CLASS_NAMES[top_idx]

    crop, disease, severity, treatment = CLASS_INFO.get(
        class_key,
        ("Unknown", "Unknown", "Unknown", "Please consult an agronomist.")
    )

    return {
        "predicted_class": class_key,
        "confidence":      round(top_conf, 4),
        "crop":            crop,
        "disease":         disease,
        "severity":        severity,
        "treatment":       treatment,
        "is_healthy":      "healthy" in class_key.lower(),
    }
