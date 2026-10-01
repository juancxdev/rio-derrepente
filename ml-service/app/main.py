import logging
import os
from datetime import date
from fastapi import FastAPI
from pydantic import BaseModel
from app.application.service import generate
from app.infrastructure.worker import start

logging.basicConfig(level=logging.INFO, format='{"timestamp":"%(asctime)s","level":"%(levelname)s","message":"%(message)s"}')
app = FastAPI(title="Tourism ML Service", version="1.0.0")

class PredictRequest(BaseModel):
    site_id: str
    prediction_date: date

@app.on_event("startup")
def startup() -> None:
    if os.getenv("ENABLE_WORKER", "true").lower() == "true":
        start()

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "tourism-ml"}

@app.post("/internal/predictions")
def predict(request: PredictRequest) -> dict:
    value = generate(request.site_id, request.prediction_date)
    return {"estimated_visitors": value.estimated_visitors, "score": value.score, "level": value.level, "model_version": value.model_version}

