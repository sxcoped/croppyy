"""
CNN disease detection service.
Fine-tuned MobileNetV2 on PlantVillage dataset (38 classes).
Model cached locally in ml_models/disease_hf/.
"""
import io
from pathlib import Path
from PIL import Image

# ─── Local model cache directory ─────────────────────────────────────────────

MODEL_CACHE = Path("./ml_models/disease_hf")
HF_MODEL_ID = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"

# ─── Class metadata ───────────────────────────────────────────────────────────

CLASS_INFO = {
    "Apple___Apple_scab":                   ("Apple",      "Apple Scab",                           "Moderate",  "Apply Captan or Myclobutanil fungicide. Remove fallen leaves."),
    "Apple___Black_rot":                    ("Apple",      "Black Rot",                            "High",      "Prune infected branches. Apply Thiophanate-methyl fungicide."),
    "Apple___Cedar_apple_rust":             ("Apple",      "Cedar Apple Rust",                     "Medium",    "Apply Mancozeb or Myclobutanil. Remove nearby cedar trees if possible."),
    "Apple___healthy":                      ("Apple",      "Healthy",                              "None",      "No action needed. Continue regular monitoring."),
    "Blueberry___healthy":                  ("Blueberry",  "Healthy",                              "None",      "No action needed."),
    "Cherry_(including_sour)___Powdery_mildew": ("Cherry", "Powdery Mildew",                      "Medium",    "Apply Sulphur-based fungicide or Myclobutanil. Improve air circulation."),
    "Cherry_(including_sour)___healthy":    ("Cherry",     "Healthy",                              "None",      "No action needed."),
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": ("Corn", "Cercospora Leaf Spot",         "High",      "Apply Azoxystrobin or Pyraclostrobin. Use resistant hybrids."),
    "Corn_(maize)___Common_rust_":          ("Corn",       "Common Rust",                          "Medium",    "Apply Propiconazole or Tebuconazole fungicide at early stages."),
    "Corn_(maize)___Northern_Leaf_Blight":  ("Corn",       "Northern Leaf Blight",                 "High",      "Apply Trifloxystrobin fungicide. Use resistant varieties next season."),
    "Corn_(maize)___healthy":               ("Corn",       "Healthy",                              "None",      "No action needed."),
    "Grape___Black_rot":                    ("Grape",      "Black Rot",                            "High",      "Apply Myclobutanil or Mancozeb before bloom. Remove mummified berries."),
    "Grape___Esca_(Black_Measles)":         ("Grape",      "Esca (Black Measles)",                 "High",      "Remove affected canes. Apply Tebuconazole. No complete cure available."),
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": ("Grape","Leaf Blight (Isariopsis)",             "Medium",    "Apply Carbendazim or Mancozeb. Ensure proper vine spacing."),
    "Grape___healthy":                      ("Grape",      "Healthy",                              "None",      "No action needed."),
    "Orange___Haunglongbing_(Citrus_greening)": ("Orange", "Citrus Greening (HLB)",               "Critical",  "No cure. Remove infected trees immediately. Control psyllid vectors with Imidacloprid."),
    "Peach___Bacterial_spot":               ("Peach",      "Bacterial Spot",                       "High",      "Apply fixed copper bactericide. Use resistant cultivars. Avoid overhead irrigation."),
    "Peach___healthy":                      ("Peach",      "Healthy",                              "None",      "No action needed."),
    "Pepper,_bell___Bacterial_spot":        ("Pepper",     "Bacterial Spot",                       "High",      "Apply copper hydroxide spray. Remove infected plants. Avoid wet conditions."),
    "Pepper,_bell___healthy":               ("Pepper",     "Healthy",                              "None",      "No action needed."),
    "Potato___Early_blight":                ("Potato",     "Early Blight (Alternaria solani)",     "Medium",    "Apply Chlorothalonil or Mancozeb. Ensure balanced fertilization."),
    "Potato___Late_blight":                 ("Potato",     "Late Blight (P. infestans)",           "Critical",  "Apply Metalaxyl + Mancozeb immediately. Destroy infected plants. Improve drainage."),
    "Potato___healthy":                     ("Potato",     "Healthy",                              "None",      "No action needed."),
    "Raspberry___healthy":                  ("Raspberry",  "Healthy",                              "None",      "No action needed."),
    "Soybean___healthy":                    ("Soybean",    "Healthy",                              "None",      "No action needed."),
    "Squash___Powdery_mildew":              ("Squash",     "Powdery Mildew",                       "Medium",    "Apply potassium bicarbonate or Myclobutanil. Improve air circulation."),
    "Strawberry___Leaf_scorch":             ("Strawberry", "Leaf Scorch",                          "Medium",    "Apply Captan fungicide. Remove infected leaves. Avoid overhead irrigation."),
    "Strawberry___healthy":                 ("Strawberry", "Healthy",                              "None",      "No action needed."),
    "Tomato___Bacterial_spot":              ("Tomato",     "Bacterial Spot",                       "High",      "Apply copper-based bactericide. Use certified disease-free seeds."),
    "Tomato___Early_blight":                ("Tomato",     "Early Blight",                         "Medium",    "Apply Chlorothalonil or Mancozeb. Remove lower infected leaves."),
    "Tomato___Late_blight":                 ("Tomato",     "Late Blight",                          "Critical",  "Apply Metalaxyl + Mancozeb immediately. Destroy infected plants."),
    "Tomato___Leaf_Mold":                   ("Tomato",     "Leaf Mold",                            "Medium",    "Apply Chlorothalonil. Reduce humidity. Improve greenhouse ventilation."),
    "Tomato___Septoria_leaf_spot":          ("Tomato",     "Septoria Leaf Spot",                   "Medium",    "Apply Mancozeb or Chlorothalonil. Mulch to reduce soil splash."),
    "Tomato___Spider_mites Two-spotted_spider_mite": ("Tomato", "Spider Mites (Two-spotted)",     "Medium",    "Apply Abamectin or Spiromesifen. Maintain adequate moisture."),
    "Tomato___Target_Spot":                 ("Tomato",     "Target Spot",                          "Medium",    "Apply Azoxystrobin or Fluxapyroxad fungicide."),
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": ("Tomato",   "Tomato Yellow Leaf Curl Virus",        "Critical",  "No cure. Remove infected plants. Control whitefly vectors with Imidacloprid."),
    "Tomato___Tomato_mosaic_virus":         ("Tomato",     "Tomato Mosaic Virus",                  "High",      "Remove infected plants. Sanitize tools. Use resistant varieties."),
    "Tomato___healthy":                     ("Tomato",     "Healthy",                              "None",      "No action needed."),
}

IMG_SIZE = (224, 224)

# ─── Model loader (lazy) ──────────────────────────────────────────────────────

_pipeline = None


def _load_model():
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    import torch
    from transformers import MobileNetV2ImageProcessor, MobileNetV2ForImageClassification

    MODEL_CACHE.mkdir(parents=True, exist_ok=True)
    cache = str(MODEL_CACHE)

    processor = MobileNetV2ImageProcessor.from_pretrained(HF_MODEL_ID, cache_dir=cache)
    model     = MobileNetV2ForImageClassification.from_pretrained(HF_MODEL_ID, cache_dir=cache)
    model.eval()

    _pipeline = (processor, model)
    return _pipeline


# ─── Inference ────────────────────────────────────────────────────────────────

def detect_disease(image_bytes: bytes) -> dict:
    import torch

    processor, model = _load_model()

    img    = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    inputs = processor(images=img, return_tensors="pt")

    with torch.no_grad():
        logits = model(**inputs).logits

    top_idx    = int(logits.argmax(-1))
    confidence = float(torch.softmax(logits, dim=-1)[0][top_idx])
    label      = model.config.id2label[top_idx]

    crop, disease, severity, treatment = CLASS_INFO.get(
        label,
        ("Unknown", label.replace("___", " — ").replace("_", " "),
         "Unknown", "Please consult an agronomist.")
    )

    return {
        "predicted_class": label,
        "confidence":      round(confidence, 4),
        "crop":            crop,
        "disease":         disease,
        "severity":        severity,
        "treatment":       treatment,
        "is_healthy":      "healthy" in label.lower(),
    }


# ─── TFLite stub (kept for API compatibility) ─────────────────────────────────

def detect_disease_tflite(image_bytes: bytes) -> dict:
    """Falls back to the main pipeline inference."""
    return detect_disease(image_bytes)
