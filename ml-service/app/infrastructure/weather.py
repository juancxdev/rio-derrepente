import os
from datetime import date
import httpx

OPEN_METEO_URL = os.getenv("OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast")
# The attraction is near Tingo María; this value is configuration, not a derived visitor datum.
LATITUDE = float(os.getenv("SITE_LATITUDE", "-9.295"))
LONGITUDE = float(os.getenv("SITE_LONGITUDE", "-75.996"))

def forecast_for(target: date) -> dict:
    params = {
        "latitude": LATITUDE, "longitude": LONGITUDE,
        "daily": "temperature_2m_max,precipitation_sum,precipitation_probability_max,weather_code",
        "timezone": "America/Lima", "start_date": target.isoformat(), "end_date": target.isoformat(),
    }
    response = httpx.get(OPEN_METEO_URL, params=params, timeout=10.0)
    response.raise_for_status()
    daily = response.json()["daily"]
    return {
        "temperature_max": daily["temperature_2m_max"][0],
        "precipitation_mm": daily["precipitation_sum"][0],
        "precipitation_probability": daily["precipitation_probability_max"][0],
        "weather_code": daily["weather_code"][0],
        "raw_payload": response.text,
    }

