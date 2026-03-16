import traceback
import sys
from PIL import Image
import io

img = Image.new('RGB', (224, 224), color='red')
buf = io.BytesIO()
img.save(buf, format='JPEG')
buf.seek(0)
from backend.services.disease_detection import detect_disease
try:
    print("Testing detect_disease...")
    print(detect_disease(buf.read()))
except Exception as e:
    traceback.print_exc()
