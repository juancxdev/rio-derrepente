package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
)

type RegisterVisitInput struct {
	SiteID                          uuid.UUID
	VisitDate                       time.Time
	Local, National, Foreign, Total int
	Notes                           string
}
type RegisterVisitService struct {
	visits VisitRepository
	events EventPublisher
}

func NewRegisterVisitService(visits VisitRepository, events EventPublisher) RegisterVisitService {
	return RegisterVisitService{visits: visits, events: events}
}

func (s RegisterVisitService) Execute(ctx context.Context, in RegisterVisitInput) (visits.Record, error) {
	record, err := visits.NewRecord(in.SiteID, in.VisitDate, in.Local, in.National, in.Foreign, in.Total, in.Notes)
	if err != nil {
		return visits.Record{}, err
	}
	stored, err := s.visits.Create(ctx, record)
	if err != nil {
		return visits.Record{}, err
	}
	// The database write is authoritative. A publisher failure is returned so it can be observed,
	// while a production outbox can retry delivery without losing the stored record.
	if err := s.events.PublishVisitCreated(ctx, stored); err != nil {
		return stored, err
	}
	return stored, nil
}
