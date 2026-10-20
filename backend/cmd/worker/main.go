package main

import (
	"context"
	"encoding/json"
	"github.com/juancx/tourism-platform/backend/internal/adapters/postgres"
	"github.com/juancx/tourism-platform/backend/internal/adapters/rabbitmq"
	"github.com/juancx/tourism-platform/backend/internal/adapters/weather"
	"github.com/juancx/tourism-platform/backend/internal/application"
	"log"
	"os"
	"strconv"
	"time"
)

func env(k, f string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return f
}

func closureHour() int {
	hour, err := strconv.Atoi(env("CLOSURE_HOUR", "18"))
	if err != nil || hour < 0 || hour > 23 {
		return 18
	}
	return hour
}

func dateToClose(now time.Time, hour int, once bool) (time.Time, bool) {
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	if once {
		return day.AddDate(0, 0, -1), true
	}
	if now.Hour() < hour {
		return time.Time{}, false
	}
	return day, true
}

func main() {
	ctx := context.Background()
	repo, err := postgres.New(ctx, env("DATABASE_URL", "postgres://tourism:tourism@localhost:5432/tourism?sslmode=disable"))
	if err != nil {
		log.Fatal(err)
	}
	defer repo.Close()
	publisher, err := rabbitmq.New(env("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"))
	if err != nil {
		log.Fatal(err)
	}
	defer publisher.Close()
	provider := weather.OpenMeteo{BaseURL: env("OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast"), ArchiveURL: env("OPEN_METEO_ARCHIVE_URL", "https://archive-api.open-meteo.com/v1/archive")}
	once := env("WORKER_ONCE", "false") == "true"
	for {
		destinations, listErr := repo.ListAllSites(ctx)
		if listErr != nil {
			log.Print(listErr)
		}
		for _, destination := range destinations {
			location, locationErr := time.LoadLocation(destination.Timezone)
			if locationErr != nil {
				log.Print(locationErr)
				continue
			}
			day, shouldClose := dateToClose(time.Now().In(location), closureHour(), once)
			if !shouldClose {
				continue
			}
			observed, weatherErr := provider.Historical(ctx, destination.Latitude, destination.Longitude, day, 1)
			payload, _ := json.Marshal(observed)
			if weatherErr != nil {
				payload = []byte(`{"source":"open-meteo","status":"unavailable"}`)
			}
			if _, _, closeErr := application.NewClosureService(repo, publisher).Close(ctx, destination.TenantID, destination.ID, day, payload); closeErr != nil {
				log.Print(closeErr)
			}
		}
		if once {
			return
		}
		time.Sleep(time.Minute)
	}
}
