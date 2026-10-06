package httpadapter

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/adapters/postgres"
	"github.com/juancx/tourism-platform/backend/internal/adapters/weather"
	"github.com/juancx/tourism-platform/backend/internal/application"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
)

type API struct {
	register          application.RegisterVisitService
	predictionService application.GetPredictionService
	weather           WeatherProvider
	latitude          float64
	longitude         float64
	logger            *slog.Logger
}
type WeatherProvider interface {
	Forecasts(context.Context, float64, float64, time.Time, int) ([]weather.Forecast, error)
}
type createVisitRequest struct {
	VisitDate string `json:"visit_date"`
	Local     int    `json:"local_visitors"`
	National  int    `json:"national_visitors"`
	Foreign   int    `json:"foreign_visitors"`
	Total     int    `json:"total_visitors"`
	Notes     string `json:"notes"`
}

func New(register application.RegisterVisitService, getPrediction application.GetPredictionService, provider WeatherProvider, latitude, longitude float64, logger *slog.Logger) *API {
	return &API{register: register, predictionService: getPrediction, weather: provider, latitude: latitude, longitude: longitude, logger: logger}
}
func (a *API) App() *fiber.App {
	app := fiber.New(fiber.Config{ErrorHandler: a.errorHandler})
	app.Use(func(c *fiber.Ctx) error {
		started := time.Now()
		err := c.Next()
		a.logger.Info("http_request", "method", c.Method(), "path", c.Path(), "status", c.Response().StatusCode(), "duration_ms", time.Since(started).Milliseconds())
		return err
	})
	app.Get("/health", func(c *fiber.Ctx) error { return c.JSON(fiber.Map{"status": "ok", "service": "tourism-api"}) })
	app.Post("/api/v1/sites/:siteID/visits", a.createVisit)
	app.Get("/api/v1/sites/:siteID/predictions/:date", a.getPrediction)
	app.Get("/api/v1/sites/:siteID/weather/forecast", a.getForecast)
	return app
}
func (a *API) getForecast(c *fiber.Ctx) error {
	if _, err := uuid.Parse(c.Params("siteID")); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid site_id")
	}
	if a.weather == nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "weather service unavailable")
	}
	days := 7
	if value := c.Query("days"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 || parsed > 7 {
			return fiber.NewError(fiber.StatusUnprocessableEntity, "days must be between 1 and 7")
		}
		days = parsed
	}
	location, err := time.LoadLocation("America/Lima")
	if err != nil {
		return err
	}
	now := time.Now().In(location)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	forecasts, err := a.weather.Forecasts(c.Context(), a.latitude, a.longitude, start, days)
	if err != nil {
		return err
	}
	response := make([]fiber.Map, 0, len(forecasts))
	for _, forecast := range forecasts {
		response = append(response, fiber.Map{
			"date":                      forecast.Date.Format("2006-01-02"),
			"temperature_max":           forecast.TemperatureMax,
			"precipitation_mm":          forecast.PrecipitationMM,
			"precipitation_probability": forecast.PrecipitationProbability,
			"weather_code":              forecast.WeatherCode,
		})
	}
	return c.JSON(fiber.Map{"source": "open-meteo", "days": response})
}
func (a *API) createVisit(c *fiber.Ctx) error {
	siteID, err := uuid.Parse(c.Params("siteID"))
	if err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid site_id")
	}
	var req createVisitRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid JSON")
	}
	date, err := time.Parse("2006-01-02", req.VisitDate)
	if err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid visit_date")
	}
	r, err := a.register.Execute(context.Background(), application.RegisterVisitInput{SiteID: siteID, VisitDate: date, Local: req.Local, National: req.National, Foreign: req.Foreign, Total: req.Total, Notes: req.Notes})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": r.ID, "total_visitors": r.TotalVisitors, "status": "accepted", "processing_event": "published"})
}
func (a *API) getPrediction(c *fiber.Ctx) error {
	siteID, err := uuid.Parse(c.Params("siteID"))
	if err != nil {
		return fiber.NewError(422, "invalid site_id")
	}
	date, err := time.Parse("2006-01-02", c.Params("date"))
	if err != nil {
		return fiber.NewError(422, "invalid date")
	}
	p, err := a.predictionService.Execute(context.Background(), siteID, date)
	if err != nil {
		return err
	}
	return c.JSON(p)
}
func (a *API) errorHandler(c *fiber.Ctx, err error) error {
	status := fiber.StatusInternalServerError
	code := "internal_error"
	message := "internal server error"
	switch {
	case errors.Is(err, postgres.ErrDuplicate):
		status = 409
		code = "duplicate_visit"
		message = err.Error()
	case errors.Is(err, postgres.ErrNotFound):
		status = 404
		code = "prediction_not_found"
		message = err.Error()
	case errors.Is(err, visits.ErrNegativeVisitors), errors.Is(err, visits.ErrInvalidTotal), errors.Is(err, visits.ErrInvalidDate):
		status = 422
		code = "validation_error"
		message = err.Error()
	default:
		var f *fiber.Error
		if errors.As(err, &f) {
			status = f.Code
			code = "validation_error"
			message = f.Message
		}
	}
	a.logger.Error("request_error", "status", status, "code", code, "error", err.Error())
	return c.Status(status).JSON(fiber.Map{"error": fiber.Map{"code": code, "message": message}})
}
