import requests
import traceback
from PIL import Image
import io
try:
    img = Image.new('RGB', (224, 224), color = 'red')
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    buf.seek(0)
    res = requests.post('http://127.0.0.1:8000/api/ml/detect-disease', files={'file': ('test.jpg', buf, 'image/jpeg')})
    print(res.status_code)
    print(res.text)
except Exception as e:
    traceback.print_exc()
