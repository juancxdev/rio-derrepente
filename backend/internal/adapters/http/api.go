package httpadapter

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/adapters/postgres"
	"github.com/juancx/tourism-platform/backend/internal/adapters/weather"
	"github.com/juancx/tourism-platform/backend/internal/application"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
	"github.com/juancx/tourism-platform/backend/internal/domain/tenants"
	"github.com/juancx/tourism-platform/backend/internal/domain/tickets"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
)

const (
	localsUserID   = "auth.user_id"
	localsTenantID = "auth.tenant_id"
	localsRole     = "auth.role"
	localsUser     = "auth.user"
)

type API struct {
	register          application.RegisterVisitService
	predictionService application.GetPredictionService
	weather           WeatherProvider
	latitude          float64
	longitude         float64
	logger            *slog.Logger
	ticketing         *application.TicketingService
	platform          *application.PlatformService
	auth              *application.AuthService
	tokens            application.TokenService
	legacyRoutes      bool
	closureHour       int
}

func (a *API) WithTicketing(s application.TicketingService) *API { a.ticketing = &s; return a }

// WithPlatform wires the super-administrator console.
func (a *API) WithPlatform(s application.PlatformService) *API { a.platform = &s; return a }

// WithAuth wires identity into the HTTP adapter. Protected routes return 503
// until this is configured, which keeps misconfiguration visible and safe.
func (a *API) WithAuth(service application.AuthService, tokens application.TokenService) *API {
	a.auth = &service
	a.tokens = tokens
	return a
}

// WithLegacyRoutes enables the original site-only endpoints for compatibility
// only. They stay disabled by default and still require authentication plus
// ownership of the site by the token tenant.
func (a *API) WithLegacyRoutes(enabled bool) *API { a.legacyRoutes = enabled; return a }

func (a *API) WithClosureHour(hour int) *API {
	if hour < 0 || hour > 23 {
		hour = 18
	}
	a.closureHour = hour
	return a
}

type WeatherProvider interface {
	Forecasts(context.Context, float64, float64, time.Time, int) ([]weather.Forecast, error)
	Historical(context.Context, float64, float64, time.Time, int) ([]weather.Forecast, error)
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
	return &API{register: register, predictionService: getPrediction, weather: provider, latitude: latitude, longitude: longitude, logger: logger, closureHour: 18}
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

	app.Post("/api/v1/auth/login", a.login)
	auth := app.Group("/api/v1/auth", a.RequireAuth())
	auth.Get("/me", a.me)
	auth.Post("/logout", a.logout)

	// Every tenant-scoped route takes the tenant from the signed token and
	// rejects a path tenant that does not match it with a 404.
	scoped := app.Group("/api/v1/tenants/:tenantID", a.RequireAuth(), a.RequireTenantParam())
	scoped.Get("/sites", a.listSites)
	scoped.Post("/sites", a.RequireRole(identity.RoleManager), a.createSite)
	scoped.Post("/sites/:siteID/tickets", a.sellTickets)
	scoped.Post("/sites/:siteID/imports", a.RequireRole(identity.RoleManager), a.importCSV)
	scoped.Get("/sites/:siteID/predictions/:date", a.getScopedPrediction)
	scoped.Get("/sites/:siteID/weather/forecast", a.getScopedForecast)
	scoped.Get("/sites/:siteID/closures/:date", a.getClosure)

	admin := app.Group("/api/v1/admin", a.RequireAuth(), a.RequireSuperAdmin())
	admin.Get("/tenants", a.listPlatformTenants)
	admin.Post("/tenants", a.createPlatformTenant)
	admin.Get("/tenants/:tenantID/sites", a.listPlatformSites)
	admin.Post("/tenants/:tenantID/sites", a.createPlatformSite)
	admin.Get("/users", a.listPlatformUsers)
	admin.Post("/users", a.createPlatformUser)

	if a.legacyRoutes {
		// Compatibility only. The main UI never calls these routes.
		legacy := app.Group("/api/v1/sites/:siteID", a.RequireAuth(), a.legacySite)
		legacy.Post("/visits", a.createVisit)
		legacy.Get("/predictions/:date", a.getPrediction)
		legacy.Get("/weather/forecast", a.getForecast)
	}
	return app
}

func (a *API) scopedIDs(c *fiber.Ctx) (uuid.UUID, uuid.UUID, error) {
	tenant, err := uuid.Parse(c.Params("tenantID"))
	if err != nil {
		return uuid.Nil, uuid.Nil, fiber.NewError(422, "invalid tenant_id")
	}
	site, err := uuid.Parse(c.Params("siteID"))
	if err != nil {
		return uuid.Nil, uuid.Nil, fiber.NewError(422, "invalid site_id")
	}
	return tenant, site, nil
}
func (a *API) requireTicketing() error {
	if a.ticketing == nil {
		return fiber.NewError(503, "ticketing service unavailable")
	}
	return nil
}
func (a *API) requireScopedSite(c *fiber.Ctx) error {
	if err := a.requireTicketing(); err != nil {
		return err
	}
	tenant, site, err := a.scopedIDs(c)
	if err != nil {
		return err
	}
	if !a.ticketing.OwnsSite(c.Context(), tenant, site) {
		return postgres.ErrScopeNotFound
	}
	return nil
}

func (a *API) createTenant(c *fiber.Ctx) error {
	if err := a.requireTicketing(); err != nil {
		return err
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(422, "invalid JSON")
	}
	v, err := a.ticketing.CreateTenant(c.Context(), req.Name)
	if err != nil {
		return err
	}
	return c.Status(201).JSON(v)
}
func (a *API) createSite(c *fiber.Ctx) error {
	if err := a.requireTicketing(); err != nil {
		return err
	}
	tenant, err := uuid.Parse(c.Params("tenantID"))
	if err != nil {
		return fiber.NewError(422, "invalid tenant_id")
	}
	var req struct {
		Code      string  `json:"code"`
		Name      string  `json:"name"`
		Timezone  string  `json:"timezone"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(422, "invalid JSON")
	}
	v, err := a.ticketing.CreateSite(c.Context(), tenant, req.Code, req.Name, req.Latitude, req.Longitude, req.Timezone)
	if err != nil {
		return err
	}
	return c.Status(201).JSON(v)
}
func (a *API) listSites(c *fiber.Ctx) error {
	if err := a.requireTicketing(); err != nil {
		return err
	}
	tenant, err := uuid.Parse(c.Params("tenantID"))
	if err != nil {
		return fiber.NewError(422, "invalid tenant_id")
	}
	v, err := a.ticketing.ListSites(c.Context(), tenant)
	if err != nil {
		return err
	}
	return c.JSON(v)
}
func (a *API) sellTickets(c *fiber.Ctx) error {
	if err := a.requireTicketing(); err != nil {
		return err
	}
	tenant, site, err := a.scopedIDs(c)
	if err != nil {
		return err
	}
	var req struct {
		Quantity  int    `json:"quantity"`
		IssuedFor string `json:"issued_for"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(422, "invalid JSON")
	}
	key := strings.TrimSpace(c.Get("Idempotency-Key"))
	if len(key) > 120 {
		return fiber.NewError(422, "Idempotency-Key must be at most 120 characters")
	}
	day := time.Now()
	if req.IssuedFor != "" {
		day, err = time.Parse("2006-01-02", req.IssuedFor)
		if err != nil {
			return fiber.NewError(422, "invalid issued_for")
		}
	}
	sold, err := a.ticketing.Sell(c.Context(), tenant, site, day, req.Quantity, key)
	if err != nil {
		return err
	}
	codes := make([]string, len(sold))
	for i, t := range sold {
		codes[i] = t.EmissionCode
	}
	return c.Status(201).JSON(fiber.Map{
		"codes":      codes,
		"quantity":   len(codes),
		"issued_for": sold[0].IssuedFor.Format("2006-01-02"),
	})
}
func (a *API) importCSV(c *fiber.Ctx) error {
	if err := a.requireTicketing(); err != nil {
		return err
	}
	tenant, site, err := a.scopedIDs(c)
	if err != nil {
		return err
	}
	source := c.Query("source", "declared_csv")
	count, err := a.ticketing.ImportCSV(c.Context(), tenant, site, source, io.LimitReader(bytes.NewReader(c.Body()), 5<<20))
	if err != nil {
		return err
	}
	return c.Status(201).JSON(fiber.Map{"imported_rows": count, "source": source})
}
func (a *API) getScopedForecast(c *fiber.Ctx) error {
	if err := a.requireTicketing(); err != nil {
		return err
	}
	tenant, siteID, err := a.scopedIDs(c)
	if err != nil {
		return err
	}
	site, err := a.ticketing.Site(c.Context(), tenant, siteID)
	if err != nil {
		return err
	}
	return a.getForecastFor(c, site.Latitude, site.Longitude, site.Timezone)
}
func (a *API) getForecast(c *fiber.Ctx) error {
	if _, err := uuid.Parse(c.Params("siteID")); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid site_id")
	}
	return a.getForecastFor(c, a.latitude, a.longitude, "America/Lima")
}
func (a *API) getForecastFor(c *fiber.Ctx, latitude, longitude float64, timezone string) error {
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
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return err
	}
	now := time.Now().In(location)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	if days < 7 {
		forecasts, forecastErr := a.weather.Forecasts(c.Context(), latitude, longitude, today, days)
		if forecastErr != nil {
			return forecastErr
		}
		return c.JSON(fiber.Map{"source": "open-meteo", "days": weatherResponse(forecasts, false)})
	}
	weekStart, weekEnd := calendarWeek(today)
	// Seven days means the whole current week: Monday through Sunday.

	pastDays := int(today.Sub(weekStart).Hours() / 24)
	observed := make([]weather.Forecast, 0, pastDays)
	if pastDays > 0 {
		observed, err = a.weather.Historical(c.Context(), latitude, longitude, weekStart, pastDays)
		if err != nil {
			return err
		}
	}
	forecastDays := int(weekEnd.Sub(today).Hours()/24) + 1
	forecasts, err := a.weather.Forecasts(c.Context(), latitude, longitude, today, forecastDays)
	if err != nil {
		return err
	}
	response := append(weatherResponse(observed, true), weatherResponse(forecasts, false)...)
	return c.JSON(fiber.Map{"source": "open-meteo", "days": response})
}

func weatherResponse(forecasts []weather.Forecast, observed bool) []fiber.Map {
	response := make([]fiber.Map, 0, len(forecasts))
	for _, forecast := range forecasts {
		probability := any(forecast.PrecipitationProbability)
		if observed {
			probability = nil
		}
		response = append(response, fiber.Map{
			"date":                      forecast.Date.Format("2006-01-02"),
			"temperature_max":           forecast.TemperatureMax,
			"precipitation_mm":          forecast.PrecipitationMM,
			"precipitation_probability": probability,
			"weather_code":              forecast.WeatherCode,
			"observed":                  observed,
		})
	}
	return response
}

func calendarWeek(today time.Time) (time.Time, time.Time) {
	// Go uses Sunday = 0; normalize it so Monday starts the week.
	daysSinceMonday := (int(today.Weekday()) + 6) % 7
	start := today.AddDate(0, 0, -daysSinceMonday)
	return start, start.AddDate(0, 0, 6)
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
func (a *API) getScopedPrediction(c *fiber.Ctx) error {
	if err := a.requireScopedSite(c); err != nil {
		return err
	}
	return a.getPrediction(c)
}
func (a *API) getClosure(c *fiber.Ctx) error {
	if err := a.requireScopedSite(c); err != nil {
		return err
	}
	tenant, site, err := a.scopedIDs(c)
	if err != nil {
		return err
	}
	date, err := time.Parse("2006-01-02", c.Params("date"))
	if err != nil {
		return fiber.NewError(422, "invalid date")
	}
	status, err := a.ticketing.ClosureStatus(c.Context(), tenant, site, date)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"date":                 status.Date,
		"status":               status.State(),
		"closed":               status.Closed,
		"tickets":              status.Tickets,
		"prediction_available": status.PredictionAvailable,
		"event_published_at":   status.EventPublishedAt,
		"event_error":          status.EventError,
		"closure_hour":         a.closureHour,
	})
}

func (a *API) errorHandler(c *fiber.Ctx, err error) error {
	var authErr *authError
	if errors.As(err, &authErr) {
		a.logger.Error("request_error", "status", authErr.status, "code", authErr.code, "error", err.Error())
		return c.Status(authErr.status).JSON(fiber.Map{"error": fiber.Map{"code": authErr.code, "message": authErr.message}})
	}
	status := fiber.StatusInternalServerError
	code := "internal_error"
	message := "internal server error"
	switch {
	case errors.Is(err, identity.ErrInvalidCredentials):
		status = 401
		code = "invalid_credentials"
		message = "Correo o contraseña incorrectos."
	case errors.Is(err, identity.ErrInactiveUser):
		status = 403
		code = "inactive_user"
		message = "La cuenta está desactivada."
	case errors.Is(err, identity.ErrMembershipNotFound), errors.Is(err, identity.ErrUserNotFound):
		status = 403
		code = "forbidden"
		message = "La cuenta no tiene acceso a este tenant."
	case errors.Is(err, identity.ErrForbidden):
		status = 403
		code = "forbidden"
		message = "El rol actual no permite esta operación."
	case errors.Is(err, postgres.ErrDuplicate), errors.Is(err, postgres.ErrDuplicateSite), errors.Is(err, postgres.ErrClosedDay):
		status = 409
		code = "conflict"
		message = err.Error()
	case errors.Is(err, postgres.ErrNotFound), errors.Is(err, postgres.ErrScopeNotFound):
		status = 404
		code = "not_found"
		message = "El recurso no pertenece al tenant autenticado."
	case errors.Is(err, visits.ErrNegativeVisitors), errors.Is(err, visits.ErrInvalidTotal), errors.Is(err, visits.ErrInvalidDate), errors.Is(err, tenants.ErrInvalidName), errors.Is(err, sites.ErrInvalidSite), errors.Is(err, tickets.ErrInvalidQuantity), errors.Is(err, tickets.ErrInvalidIssueDate), errors.Is(err, identity.ErrInvalidUser), errors.Is(err, application.ErrInvalidCSV):
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
