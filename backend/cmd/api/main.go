package main

import (
	"context"
	"log"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/google/uuid"
	authadapter "github.com/juancx/tourism-platform/backend/internal/adapters/auth"
	httpadapter "github.com/juancx/tourism-platform/backend/internal/adapters/http"
	"github.com/juancx/tourism-platform/backend/internal/adapters/logging"
	"github.com/juancx/tourism-platform/backend/internal/adapters/postgres"
	"github.com/juancx/tourism-platform/backend/internal/adapters/rabbitmq"
	"github.com/juancx/tourism-platform/backend/internal/adapters/weather"
	"github.com/juancx/tourism-platform/backend/internal/application"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
)

func env(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}
func envFloat(key string, fallback float64) float64 {
	value, err := strconv.ParseFloat(env(key, ""), 64)
	if err != nil {
		return fallback
	}
	return value
}
func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(env(key, ""))
	if err != nil {
		return fallback
	}
	return value
}
func envDuration(key string, fallback time.Duration) time.Duration {
	value, err := time.ParseDuration(env(key, ""))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func main() {
	logger := logging.New()
	ctx := context.Background()
	repos, err := postgres.New(ctx, env("DATABASE_URL", "postgres://tourism:tourism@localhost:5432/tourism?sslmode=disable"))
	if err != nil {
		log.Fatal(err)
	}
	defer repos.Close()
	if err := repos.Pool.Ping(ctx); err != nil {
		log.Fatal(err)
	}
	publisher, err := rabbitmq.New(env("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"))
	if err != nil {
		log.Fatal(err)
	}
	defer publisher.Close()
	weatherProvider := weather.OpenMeteo{
		BaseURL:    env("OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast"),
		ArchiveURL: env("OPEN_METEO_ARCHIVE_URL", "https://archive-api.open-meteo.com/v1/archive"),
	}

	ticketing := application.NewTicketingService(repos)
	tokens, authService := buildAuth(logger, repos, ticketing)
	platform := application.NewPlatformService(repos, authadapter.BcryptHasher{})
	if env("APP_SEED_DEMO", "false") == "true" {
		seedDemoUser(ctx, authService, logger)
	}

	api := httpadapter.New(
		application.NewRegisterVisitService(repos, publisher),
		application.NewGetPredictionService(repos),
		weatherProvider,
		envFloat("SITE_LATITUDE", -9.295000),
		envFloat("SITE_LONGITUDE", -75.996000),
		logger,
	).
		WithTicketing(ticketing).
		WithPlatform(platform).
		WithAuth(authService, tokens).
		WithLegacyRoutes(env("APP_ENABLE_LEGACY_ROUTES", "false") == "true").
		WithClosureHour(envInt("CLOSURE_HOUR", 18)).
		WithRefreshTTL(envDuration("AUTH_REFRESH_TTL", 30*24*time.Hour)).
		App()

	logger.Info("api_started", "port", env("API_PORT", "8080"))
	log.Fatal(api.Listen(":" + env("API_PORT", "8080")))
}

func buildAuth(logger *slog.Logger, repos *postgres.Repositories, ticketing application.TicketingService) (authadapter.TokenManager, application.AuthService) {
	secret := env("AUTH_JWT_SECRET", "")
	if secret == "" {
		if env("APP_ENV", "development") == "production" {
			log.Fatal("AUTH_JWT_SECRET is required when APP_ENV=production")
		}
		secret = "dev-only-insecure-secret-change-me"
		logger.Warn("auth_secret_missing", "detail", "using the development-only JWT secret")
	}
	ttl := envDuration("AUTH_TOKEN_TTL", 8*time.Hour)
	tokens := authadapter.TokenManager{Secret: []byte(secret), TTL: ttl, Issuer: "tourism-api"}
	passwords := authadapter.BcryptHasher{}
	return tokens, application.NewAuthService(repos, ticketing, passwords, tokens, ttl)
}

// seedDemoUser is the only controlled seed for the demo account. It runs only
// with APP_SEED_DEMO=true and never deletes or rewrites operational data.
func seedDemoUser(ctx context.Context, authService application.AuthService, logger *slog.Logger) {
	tenantID, err := uuid.Parse(env("DEMO_TENANT_ID", "00000000-0000-0000-0000-000000000001"))
	if err != nil {
		log.Fatal("invalid DEMO_TENANT_ID: ", err)
	}
	email := env("DEMO_USER_EMAIL", "")
	password := env("DEMO_USER_PASSWORD", "")
	if email == "" || password == "" {
		log.Fatal("DEMO_USER_EMAIL and DEMO_USER_PASSWORD are required when APP_SEED_DEMO=true")
	}
	displayName := env("DEMO_USER_NAME", "Operador de demostración")
	role := identity.NormalizeTenantRole(env("DEMO_USER_ROLE", string(identity.RoleManager)))
	if _, err := authService.EnsureDemoUser(ctx, email, password, displayName, tenantID, role); err != nil {
		log.Fatal("could not seed demo user: ", err)
	}
	logger.Info("demo_user_seeded", "email", email, "tenant_id", tenantID.String(), "role", role)
}
