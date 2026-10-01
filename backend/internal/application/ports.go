package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/predictions"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
)

type VisitRepository interface {
	Create(context.Context, visits.Record) (visits.Record, error)
}
type PredictionRepository interface {
	FindByDate(context.Context, uuid.UUID, time.Time) (predictions.Prediction, error)
}
type EventPublisher interface {
	PublishVisitCreated(context.Context, visits.Record) error
}
