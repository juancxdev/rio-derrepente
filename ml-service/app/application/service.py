from datetime import date
from app.domain.prediction import calculate_baseline, Prediction
from app.infrastructure import database
from app.infrastructure.weather import forecast_for

def generate(site_id: str, target: date, probability_override: float | None = None) -> Prediction:
    if probability_override is None:
        database.save_forecast(site_id, target, forecast_for(target))
    average, maximum = database.historical_monthly_average(site_id, target)
    temperature, probability = database.latest_forecast(site_id, target)
    probability = probability_override if probability_override is not None else probability
    result = calculate_baseline(average, probability, target.weekday() >= 5, False, historical_max=maximum)
    database.save_prediction(site_id, target, result, temperature, probability)
    return result
