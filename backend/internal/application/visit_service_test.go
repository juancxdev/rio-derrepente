package application

import (
	"context"
	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
	"testing"
	"time"
)

type visitRepoStub struct{ stored visits.Record }

func (s *visitRepoStub) Create(_ context.Context, v visits.Record) (visits.Record, error) {
	v.ID = 7
	s.stored = v
	return v, nil
}

type publisherStub struct{ called bool }

func (s *publisherStub) PublishVisitCreated(_ context.Context, _ visits.Record) error {
	s.called = true
	return nil
}
func TestRegisterVisitPersistsThenPublishes(t *testing.T) {
	repo := &visitRepoStub{}
	pub := &publisherStub{}
	svc := NewRegisterVisitService(repo, pub)
	r, err := svc.Execute(context.Background(), RegisterVisitInput{SiteID: uuid.New(), VisitDate: time.Now(), Local: 2, National: 3, Foreign: 1, Total: 6})
	if err != nil || r.ID != 7 || !pub.called {
		t.Fatalf("unexpected: %+v %v published=%v", r, err, pub.called)
	}
}
