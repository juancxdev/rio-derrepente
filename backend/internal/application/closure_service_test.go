package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

type closureRepoStub struct {
	created bool
	marked  int
}

type retryClosureRepo struct {
	created          bool
	unpublished      bool
	lastPublishError error
}

func (s *retryClosureRepo) CloseDay(context.Context, uuid.UUID, uuid.UUID, time.Time, []byte) (int64, bool, error) {
	if !s.created {
		s.created = true
		s.unpublished = true
	}
	return 46, s.unpublished, nil
}
func (s *retryClosureRepo) MarkClosureEvent(_ context.Context, _ uuid.UUID, _ uuid.UUID, _ time.Time, publishErr error) error {
	s.lastPublishError = publishErr
	s.unpublished = publishErr != nil
	return nil
}

type failsOncePublisher struct{ attempts int }

func (p *failsOncePublisher) PublishDailyClosure(context.Context, DailyClosureEvent) error {
	p.attempts++
	if p.attempts == 1 {
		return errors.New("rabbitmq unavailable")
	}
	return nil
}

func (s *closureRepoStub) CloseDay(context.Context, uuid.UUID, uuid.UUID, time.Time, []byte) (int64, bool, error) {
	if s.created {
		return 45, false, nil
	}
	s.created = true
	return 45, true, nil
}
func (s *closureRepoStub) MarkClosureEvent(context.Context, uuid.UUID, uuid.UUID, time.Time, error) error {
	s.marked++
	return nil
}

type closurePublisherStub struct{ published int }

func (s *closurePublisherStub) PublishDailyClosure(_ context.Context, _ DailyClosureEvent) error {
	s.published++
	return nil
}

func TestClosurePublishesOnlyWhenTheDailyRecordIsCreated(t *testing.T) {
	repo := &closureRepoStub{}
	publisher := &closurePublisherStub{}
	service := NewClosureService(repo, publisher)
	day := time.Date(2026, time.October, 20, 0, 0, 0, 0, time.UTC)
	for range 2 {
		if _, _, err := service.Close(context.Background(), uuid.New(), uuid.New(), day, []byte(`{}`)); err != nil {
			t.Fatal(err)
		}
	}
	if publisher.published != 1 || repo.marked != 1 {
		t.Fatalf("want one event and mark, got events=%d marks=%d", publisher.published, repo.marked)
	}
}

func TestClosureRetriesWhenThePreviousPublicationFailed(t *testing.T) {
	repo := &retryClosureRepo{}
	publisher := &failsOncePublisher{}
	service := NewClosureService(repo, publisher)
	tenant, site := uuid.New(), uuid.New()
	day := time.Date(2026, time.October, 20, 0, 0, 0, 0, time.UTC)
	if _, _, err := service.Close(context.Background(), tenant, site, day, []byte(`{}`)); err == nil {
		t.Fatal("first publish must fail")
	}
	if _, _, err := service.Close(context.Background(), tenant, site, day, []byte(`{}`)); err != nil {
		t.Fatalf("retry must publish: %v", err)
	}
	if publisher.attempts != 2 || repo.lastPublishError != nil {
		t.Fatalf("want one retry followed by a successful mark, attempts=%d err=%v", publisher.attempts, repo.lastPublishError)
	}
}
