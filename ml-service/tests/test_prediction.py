from app.domain.prediction import calculate_baseline

def test_score_is_bounded_and_high_for_favorable_weekend():
    prediction = calculate_baseline(20, 10, True, True, historical_max=20)
    assert prediction.score == 100
    assert prediction.level == "ALTA"

def test_heavy_rain_reduces_prediction():
    dry = calculate_baseline(20, 10, False, False, historical_max=20)
    rainy = calculate_baseline(20, 80, False, False, historical_max=20)
    assert rainy.estimated_visitors < dry.estimated_visitors
    assert 0 <= rainy.score <= 100

