import os
from dotenv import load_dotenv

load_dotenv()

# GEE
GEE_PROJECT_ID      = os.getenv("GEE_PROJECT_ID", "croppy-471110")

# Weather
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")

# Supabase
SUPABASE_URL        = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")   # service_role key (server-side only)
SUPABASE_JWT_SECRET  = os.getenv("SUPABASE_JWT_SECRET", "")    # JWT secret from Supabase settings

# ML models
MODEL_PATH          = os.getenv("MODEL_PATH", "./ml_models/disease_model.h5")
TFLITE_MODEL_PATH   = os.getenv("TFLITE_MODEL_PATH", "./ml_models/disease_model.tflite")
