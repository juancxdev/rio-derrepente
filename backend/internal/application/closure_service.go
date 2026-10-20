package application

import (
	"context"
	"github.com/google/uuid"
	"time"
)

type ClosureRepository interface {
	CloseDay(context.Context, uuid.UUID, uuid.UUID, time.Time, []byte) (int64, bool, error)
	MarkClosureEvent(context.Context, uuid.UUID, uuid.UUID, time.Time, error) error
}
type DailyClosureEvent struct {
	EventType      string    `json:"event_type"`
	TenantID       string    `json:"tenant_id"`
	SiteID         string    `json:"site_id"`
	VisitRecordID  int64     `json:"visit_record_id"`
	PredictionDate string    `json:"prediction_date"`
	OccurredAt     time.Time `json:"occurred_at"`
}
type ClosurePublisher interface {
	PublishDailyClosure(context.Context, DailyClosureEvent) error
}
type ClosureService struct {
	repo   ClosureRepository
	events ClosurePublisher
}

func NewClosureService(r ClosureRepository, e ClosurePublisher) ClosureService {
	return ClosureService{r, e}
}
func (s ClosureService) Close(ctx context.Context, tenantID, siteID uuid.UUID, day time.Time, weather []byte) (int64, bool, error) {
	id, created, err := s.repo.CloseDay(ctx, tenantID, siteID, day, weather)
	if err != nil || !created {
		return id, created, err
	}
	event := DailyClosureEvent{"daily-closure", tenantID.String(), siteID.String(), id, day.AddDate(0, 0, 1).Format("2006-01-02"), time.Now().UTC()}
	err = s.events.PublishDailyClosure(ctx, event)
	_ = s.repo.MarkClosureEvent(ctx, tenantID, siteID, day, err)
	return id, true, err
}
