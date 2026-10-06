package main

import (
	"context"
	"log"
	"os"
	"strconv"

	httpadapter "github.com/juancx/tourism-platform/backend/internal/adapters/http"
	"github.com/juancx/tourism-platform/backend/internal/adapters/logging"
	"github.com/juancx/tourism-platform/backend/internal/adapters/postgres"
	"github.com/juancx/tourism-platform/backend/internal/adapters/rabbitmq"
	"github.com/juancx/tourism-platform/backend/internal/adapters/weather"
	"github.com/juancx/tourism-platform/backend/internal/application"
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
	weatherProvider := weather.OpenMeteo{BaseURL: env("OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast")}
	api := httpadapter.New(application.NewRegisterVisitService(repos, publisher), application.NewGetPredictionService(repos), weatherProvider, envFloat("SITE_LATITUDE", -9.295000), envFloat("SITE_LONGITUDE", -75.996000), logger).App()
	logger.Info("api_started", "port", env("API_PORT", "8080"))
	log.Fatal(api.Listen(":" + env("API_PORT", "8080")))
}
