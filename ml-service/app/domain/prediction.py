from dataclasses import dataclass

MODEL_VERSION = "baseline-1.0"

@dataclass(frozen=True)
class Prediction:
    estimated_visitors: float
    score: float
    level: str
    model_version: str = MODEL_VERSION

def level_for(score: float) -> str:
    if score < 40:
        return "BAJA"
    if score < 70:
        return "MEDIA"
    return "ALTA"

def calculate_baseline(monthly_average: float, precipitation_probability: float | None, is_weekend: bool, is_holiday: bool, seasonal_factor: float = 1.0, historical_max: float = 1.0) -> Prediction:
    """Initial explainable model; XGBoost will replace this implementation once daily data is sufficient."""
    weather_factor = 0.50 if (precipitation_probability or 0) >= 70 else 1.10
    holiday_factor = 1.80 if is_holiday else 1.0
    weekend_factor = 1.40 if is_weekend else 1.0
    estimated = max(0.0, monthly_average * weather_factor * holiday_factor * weekend_factor * seasonal_factor)
    score = min(100.0, max(0.0, 100.0 * estimated / max(historical_max, 1.0)))
    return Prediction(round(estimated, 2), round(score, 2), level_for(score))

