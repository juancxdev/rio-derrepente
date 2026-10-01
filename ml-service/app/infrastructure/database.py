import json
import os
from datetime import date
import psycopg
from app.domain.prediction import Prediction

def connection():
    return psycopg.connect(os.environ["DATABASE_URL"])

def historical_monthly_average(site_id: str, target: date) -> tuple[float, float]:
    with connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT COALESCE(AVG(total_visitors), 0), COALESCE(MAX(total_visitors), 1) FROM visit_records WHERE site_id=%s AND EXTRACT(MONTH FROM visit_date)=EXTRACT(MONTH FROM %s::date)", (site_id, target))
        average, maximum = cur.fetchone()
        return float(average), float(maximum)

def latest_forecast(site_id: str, target: date) -> tuple[float | None, float | None]:
    with connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT temperature_max, precipitation_probability FROM weather_forecasts WHERE site_id=%s AND forecast_date=%s ORDER BY generated_at DESC LIMIT 1", (site_id, target))
        row = cur.fetchone()
        return (float(row[0]) if row and row[0] is not None else None, float(row[1]) if row and row[1] is not None else None)

def save_forecast(site_id: str, target: date, forecast: dict) -> None:
    with connection() as conn, conn.cursor() as cur:
        cur.execute("""INSERT INTO weather_forecasts(site_id,forecast_date,temperature_max,precipitation_mm,precipitation_probability,weather_code,source,raw_payload)
        VALUES (%s,%s,%s,%s,%s,%s,'open-meteo',%s::jsonb)""", (site_id, target, forecast["temperature_max"], forecast["precipitation_mm"], forecast["precipitation_probability"], forecast["weather_code"], forecast["raw_payload"]))
        conn.commit()

def save_prediction(site_id: str, target: date, prediction: Prediction, temperature: float | None, probability: float | None) -> None:
    snapshot = json.dumps({"temperature_max": temperature, "precipitation_probability": probability})
    with connection() as conn, conn.cursor() as cur:
        cur.execute("""INSERT INTO predictions(site_id,prediction_date,estimated_visitors,score,level,model_version,input_snapshot)
        VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb)
        ON CONFLICT(site_id,prediction_date,model_version) DO UPDATE SET estimated_visitors=EXCLUDED.estimated_visitors,score=EXCLUDED.score,level=EXCLUDED.level,input_snapshot=EXCLUDED.input_snapshot,generated_at=NOW()""", (site_id, target, prediction.estimated_visitors, prediction.score, prediction.level, prediction.model_version, snapshot))
        conn.commit()
