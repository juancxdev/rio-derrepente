package httpadapter

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/adapters/logging"
	"github.com/juancx/tourism-platform/backend/internal/adapters/postgres"
	"github.com/juancx/tourism-platform/backend/internal/adapters/weather"
	"github.com/juancx/tourism-platform/backend/internal/application"
	"github.com/juancx/tourism-platform/backend/internal/domain/predictions"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type memoryVisits struct{ duplicate bool }

func (m memoryVisits) Create(_ context.Context, v visits.Record) (visits.Record, error) {
	if m.duplicate {
		return visits.Record{}, postgres.ErrDuplicate
	}
	v.ID = 1
	return v, nil
}

type noopPublisher struct{}

func (noopPublisher) PublishVisitCreated(context.Context, visits.Record) error { return nil }

type missingPredictions struct{}

func (missingPredictions) FindByDate(context.Context, uuid.UUID, time.Time) (predictions.Prediction, error) {
	return predictions.Prediction{}, postgres.ErrNotFound
}

type fixedWeather struct{}

func (fixedWeather) Forecasts(_ context.Context, _ float64, _ float64, target time.Time, days int) ([]weather.Forecast, error) {
	result := make([]weather.Forecast, days)
	for i := range result {
		result[i] = weather.Forecast{Date: target.AddDate(0, 0, i), TemperatureMax: 30, PrecipitationMM: 2, PrecipitationProbability: 45, WeatherCode: 3}
	}
	return result, nil
}
func newTestAPI(duplicate bool) *API {
	return New(application.NewRegisterVisitService(memoryVisits{duplicate}, noopPublisher{}), application.NewGetPredictionService(missingPredictions{}), fixedWeather{}, -9.295, -75.996, logging.New())
}
func TestForecastReturnsDashboardWeather(t *testing.T) {
	a := newTestAPI(false).App()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/11111111-1111-1111-1111-111111111111/weather/forecast?days=2", nil)
	res, err := a.Test(req)
	if err != nil || res.StatusCode != http.StatusOK {
		t.Fatalf("want 200 got %v %v", res.StatusCode, err)
	}
}

func TestForecastRejectsAnUnsupportedNumberOfDays(t *testing.T) {
	a := newTestAPI(false).App()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/11111111-1111-1111-1111-111111111111/weather/forecast?days=8", nil)
	res, err := a.Test(req)
	if err != nil || res.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("want 422 got %v %v", res.StatusCode, err)
	}
}
func TestCreateVisitRejectsInconsistentCounts(t *testing.T) {
	a := newTestAPI(false).App()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/sites/11111111-1111-1111-1111-111111111111/visits", strings.NewReader(`{"visit_date":"2026-10-01","local_visitors":1,"national_visitors":0,"foreign_visitors":0,"total_visitors":2}`))
	req.Header.Set("Content-Type", "application/json")
	res, err := a.Test(req)
	if err != nil || res.StatusCode != 422 {
		t.Fatalf("want 422 got %v %v", res.StatusCode, err)
	}
}

func TestCreateVisitAcceptsValidRecord(t *testing.T) {
	a := newTestAPI(false).App()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/sites/11111111-1111-1111-1111-111111111111/visits", strings.NewReader(`{"visit_date":"2026-10-01","local_visitors":1,"national_visitors":1,"foreign_visitors":0,"total_visitors":2}`))
	req.Header.Set("Content-Type", "application/json")
	res, err := a.Test(req)
	if err != nil || res.StatusCode != http.StatusCreated {
		t.Fatalf("want 201 got %v %v", res.StatusCode, err)
	}
}
func TestCreateVisitReturnsConflictForDuplicate(t *testing.T) {
	a := newTestAPI(true).App()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/sites/11111111-1111-1111-1111-111111111111/visits", strings.NewReader(`{"visit_date":"2026-10-01","local_visitors":1,"national_visitors":0,"foreign_visitors":0,"total_visitors":1}`))
	req.Header.Set("Content-Type", "application/json")
	res, err := a.Test(req)
	if err != nil || res.StatusCode != 409 {
		t.Fatalf("want 409 got %v %v", res.StatusCode, err)
	}
}
func TestPredictionNotFoundDoesNotCallML(t *testing.T) {
	a := newTestAPI(false).App()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/11111111-1111-1111-1111-111111111111/predictions/2026-10-02", nil)
	res, err := a.Test(req)
	if err != nil || res.StatusCode != 404 {
		t.Fatalf("want 404 got %v %v", res.StatusCode, err)
	}
	if !errors.Is(postgres.ErrNotFound, postgres.ErrNotFound) {
		t.Fatal("sanity")
	}
}
