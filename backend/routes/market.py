"""
Market prices route — Agmarknet API with mock fallback for demo.
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
import httpx

router = APIRouter(prefix="/api/market", tags=["Market"])

# Mock mandi price data (used when Agmarknet API is unavailable)
MOCK_PRICES = {
    "wheat": [
        {"mandi": "Ludhiana",    "state": "Punjab",       "district": "Ludhiana",  "min_price": 2125, "max_price": 2275, "modal_price": 2200, "date": "2026-03-10"},
        {"mandi": "Karnal",      "state": "Haryana",      "district": "Karnal",    "min_price": 2100, "max_price": 2250, "modal_price": 2175, "date": "2026-03-10"},
        {"mandi": "Agra",        "state": "Uttar Pradesh","district": "Agra",      "min_price": 2050, "max_price": 2200, "modal_price": 2125, "date": "2026-03-09"},
        {"mandi": "Indore",      "state": "Madhya Pradesh","district":"Indore",    "min_price": 2080, "max_price": 2220, "modal_price": 2150, "date": "2026-03-09"},
        {"mandi": "Kota",        "state": "Rajasthan",    "district": "Kota",      "min_price": 2030, "max_price": 2180, "modal_price": 2110, "date": "2026-03-09"},
    ],
    "rice": [
        {"mandi": "Amritsar",    "state": "Punjab",       "district": "Amritsar",  "min_price": 2100, "max_price": 2320, "modal_price": 2210, "date": "2026-03-10"},
        {"mandi": "Panipat",     "state": "Haryana",      "district": "Panipat",   "min_price": 2050, "max_price": 2280, "modal_price": 2165, "date": "2026-03-10"},
        {"mandi": "Thanjavur",   "state": "Tamil Nadu",   "district": "Thanjavur", "min_price": 1980, "max_price": 2150, "modal_price": 2065, "date": "2026-03-09"},
        {"mandi": "Raichur",     "state": "Karnataka",    "district": "Raichur",   "min_price": 1960, "max_price": 2120, "modal_price": 2040, "date": "2026-03-08"},
    ],
    "maize": [
        {"mandi": "Davangere",   "state": "Karnataka",    "district": "Davangere", "min_price": 1750, "max_price": 1980, "modal_price": 1865, "date": "2026-03-10"},
        {"mandi": "Nizamabad",   "state": "Telangana",    "district": "Nizamabad", "min_price": 1700, "max_price": 1950, "modal_price": 1825, "date": "2026-03-09"},
    ],
    "cotton": [
        {"mandi": "Rajkot",      "state": "Gujarat",      "district": "Rajkot",    "min_price": 6350, "max_price": 6800, "modal_price": 6575, "date": "2026-03-10"},
        {"mandi": "Nagpur",      "state": "Maharashtra",  "district": "Nagpur",    "min_price": 6200, "max_price": 6700, "modal_price": 6450, "date": "2026-03-09"},
        {"mandi": "Coimbatore",  "state": "Tamil Nadu",   "district": "Coimbatore","min_price": 6100, "max_price": 6600, "modal_price": 6350, "date": "2026-03-09"},
    ],
    "potato": [
        {"mandi": "Agra",        "state": "Uttar Pradesh","district": "Agra",      "min_price": 620,  "max_price": 850,  "modal_price": 735,  "date": "2026-03-10"},
        {"mandi": "Jalandhar",   "state": "Punjab",       "district": "Jalandhar", "min_price": 650,  "max_price": 880,  "modal_price": 765,  "date": "2026-03-10"},
        {"mandi": "Indore",      "state": "Madhya Pradesh","district":"Indore",    "min_price": 600,  "max_price": 820,  "modal_price": 710,  "date": "2026-03-09"},
    ],
    "tomato": [
        {"mandi": "Nashik",      "state": "Maharashtra",  "district": "Nashik",    "min_price": 1200, "max_price": 2100, "modal_price": 1650, "date": "2026-03-10"},
        {"mandi": "Kolar",       "state": "Karnataka",    "district": "Kolar",     "min_price": 1100, "max_price": 1900, "modal_price": 1500, "date": "2026-03-09"},
        {"mandi": "Tirupati",    "state": "Andhra Pradesh","district":"Tirupati",  "min_price": 1050, "max_price": 1800, "modal_price": 1425, "date": "2026-03-09"},
    ],
    "sugarcane": [
        {"mandi": "Meerut",      "state": "Uttar Pradesh","district": "Meerut",    "min_price": 315,  "max_price": 350,  "modal_price": 332,  "date": "2026-03-10"},
        {"mandi": "Pune",        "state": "Maharashtra",  "district": "Pune",      "min_price": 290,  "max_price": 330,  "modal_price": 310,  "date": "2026-03-09"},
    ],
    "soybean": [
        {"mandi": "Indore",      "state": "Madhya Pradesh","district":"Indore",    "min_price": 4150, "max_price": 4500, "modal_price": 4325, "date": "2026-03-10"},
        {"mandi": "Latur",       "state": "Maharashtra",  "district": "Latur",     "min_price": 4100, "max_price": 4450, "modal_price": 4275, "date": "2026-03-09"},
    ],
    "onion": [
        {"mandi": "Lasalgaon",   "state": "Maharashtra",  "district": "Nashik",    "min_price": 1400, "max_price": 2200, "modal_price": 1800, "date": "2026-03-10"},
        {"mandi": "Hubli",       "state": "Karnataka",    "district": "Dharwad",   "min_price": 1300, "max_price": 2100, "modal_price": 1700, "date": "2026-03-09"},
    ],
    "mustard": [
        {"mandi": "Alwar",       "state": "Rajasthan",    "district": "Alwar",     "min_price": 4900, "max_price": 5300, "modal_price": 5100, "date": "2026-03-10"},
        {"mandi": "Bharatpur",   "state": "Rajasthan",    "district": "Bharatpur", "min_price": 4850, "max_price": 5250, "modal_price": 5050, "date": "2026-03-09"},
    ],
}

AGMARKNET_URL = "https://agmarknet.gov.in/SearchCapsule/VeggiesAndFruits.aspx"


@router.get("/prices", summary="Get mandi prices (Agmarknet / demo data)")
async def get_prices(
    crop: str = "wheat",
    state: Optional[str] = None,
    limit: int = 20,
):
    crop_key = crop.lower().strip()

    # Try Agmarknet API (may not have a clean public JSON API, use mock)
    prices = MOCK_PRICES.get(crop_key, [])

    if state:
        state_lower = state.lower()
        prices = [p for p in prices if state_lower in p["state"].lower()]

    if not prices:
        # Return empty with note
        return {
            "crop": crop,
            "state": state,
            "source": "mock",
            "prices": [],
            "note": f"No price data available for '{crop}'.",
        }

    return {
        "crop": crop,
        "state": state or "All States",
        "source": "mock-agmarknet",    # Change to "agmarknet" when API integrated
        "count": len(prices[:limit]),
        "prices": prices[:limit],
        "unit": "₹ per quintal (100 kg)",
        "last_updated": prices[0]["date"] if prices else None,
    }


@router.get("/crops", summary="List available crops for price query")
def list_crops():
    return {"crops": list(MOCK_PRICES.keys())}
