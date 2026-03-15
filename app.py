# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import ee

# =======================
# CONFIG: Your Google Cloud Project ID
# =======================
GEE_PROJECT_ID = 'croppy-471110'

# =======================
# Initialize Earth Engine
# =======================
def initialize_ee():
    try:
        ee.Initialize(project=GEE_PROJECT_ID)
        print("✅ Earth Engine initialized successfully!")
    except ee.EEException:
        print("🌐 Authenticating Earth Engine...")
        ee.Authenticate(project=GEE_PROJECT_ID)
        ee.Initialize(project=GEE_PROJECT_ID)
        print("✅ Earth Engine initialized after authentication!")

initialize_ee()

# =======================
# FLASK APP
# =======================
app = Flask(__name__)
CORS(app)  # allow calls from browser

@app.route("/ndvi", methods=["POST"])
def ndvi():
    data = request.get_json()
    try:
        lat = float(data.get("lat"))
        lon = float(data.get("lon"))
        start = data.get("start")
        end = data.get("end")
    except Exception:
        return jsonify({"error": "Invalid input data"}), 400

    # Create a point and buffer 1000 m around it
    point = ee.Geometry.Point(lon, lat)

    collection = (ee.ImageCollection("COPERNICUS/S2_SR")
                  .filterBounds(point)
                  .filterDate(start, end)
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30)))

    image = collection.median()
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")

    mean_dict = ndvi.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=point.buffer(1000),
        scale=10,
        maxPixels=1e9
    )

    mean_ndvi = None
    try:
        mean_ndvi = mean_dict.getInfo().get("NDVI")
    except Exception:
        mean_ndvi = None

    return jsonify({"mean_ndvi": mean_ndvi})

if __name__ == "__main__":
    app.run(debug=True)
