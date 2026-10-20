package application

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/closures"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
	"github.com/juancx/tourism-platform/backend/internal/domain/tenants"
	"github.com/juancx/tourism-platform/backend/internal/domain/tickets"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
)

type ticketingRepoStub struct {
	imported         []visits.Record
	tenantID, siteID uuid.UUID
	site             sites.Site
	lastKey          string
	sales            int
}

func (s *ticketingRepoStub) CreateTenant(_ context.Context, v tenants.Tenant) (tenants.Tenant, error) {
	return v, nil
}
func (s *ticketingRepoStub) CreateSite(_ context.Context, v sites.Site) (sites.Site, error) {
	return v, nil
}
func (s *ticketingRepoStub) ListSites(context.Context, uuid.UUID) ([]sites.Site, error) {
	return nil, nil
}
func (s *ticketingRepoStub) FindSite(_ context.Context, tenantID, siteID uuid.UUID) (sites.Site, error) {
	if s.site.ID == uuid.Nil {
		s.site = sites.Site{ID: siteID, TenantID: tenantID, Timezone: "America/Lima"}
	}
	return s.site, nil
}
func (s *ticketingRepoStub) ScopeExists(context.Context, uuid.UUID, uuid.UUID) bool { return true }
func (s *ticketingRepoStub) CreateTickets(_ context.Context, t, site uuid.UUID, d time.Time, q int, key string) ([]tickets.Ticket, error) {
	s.lastKey = key
	s.sales++
	out := make([]tickets.Ticket, q)
	for i := range out {
		out[i] = tickets.New(t, site, d, uuid.NewString())
	}
	return out, nil
}
func (s *ticketingRepoStub) ImportHistorical(_ context.Context, t, site uuid.UUID, _ string, v []visits.Record) error {
	s.tenantID = t
	s.siteID = site
	s.imported = v
	return nil
}
func (s *ticketingRepoStub) ClosureStatus(_ context.Context, _, _ uuid.UUID, day time.Time) (closures.Status, error) {
	return closures.Status{Date: day.Format("2006-01-02")}, nil
}
func TestCSVInvalidRowDoesNotReachRepository(t *testing.T) {
	repo := &ticketingRepoStub{}
	_, err := NewTicketingService(repo).ImportCSV(context.Background(), uuid.New(), uuid.New(), "csv", strings.NewReader("fecha,total\n2026-10-01,nope\n"))
	if err == nil || len(repo.imported) != 0 {
		t.Fatalf("invalid CSV must be rejected atomically: %v", err)
	}
}
func TestCSVImportsScopedRows(t *testing.T) {
	repo := &ticketingRepoStub{}
	tenant, site := uuid.New(), uuid.New()
	n, err := NewTicketingService(repo).ImportCSV(context.Background(), tenant, site, "csv", strings.NewReader("fecha,total,local,national,foreign\n2026-10-01,3,1,1,1\n"))
	if err != nil || n != 1 || repo.tenantID != tenant || repo.siteID != site {
		t.Fatalf("want one tenant-scoped row, got n=%d err=%v", n, err)
	}
}
func TestSellRejectsZero(t *testing.T) {
	_, err := NewTicketingService(&ticketingRepoStub{}).Sell(context.Background(), uuid.New(), uuid.New(), time.Now(), 0, "")
	if err == nil {
		t.Fatal("want validation error")
	}
}
func TestSellRejectsLargeAndNonLocalCurrentDay(t *testing.T) {
	repo := &ticketingRepoStub{}
	tenant, site := uuid.New(), uuid.New()
	service := NewTicketingService(repo)
	if _, err := service.Sell(context.Background(), tenant, site, time.Now(), 101, ""); err == nil {
		t.Fatal("want maximum quantity validation")
	}
	if _, err := service.Sell(context.Background(), tenant, site, time.Now().AddDate(0, 0, -1), 1, ""); err == nil {
		t.Fatal("want local-day validation")
	}
}

func TestSellForwardsTheIdempotencyKey(t *testing.T) {
	repo := &ticketingRepoStub{}
	tenant, site := uuid.New(), uuid.New()
	if _, err := NewTicketingService(repo).Sell(context.Background(), tenant, site, time.Now(), 2, "click-1"); err != nil {
		t.Fatal(err)
	}
	if repo.lastKey != "click-1" || repo.sales != 1 {
		t.Fatalf("want one scoped sale with its key, got key=%q sales=%d", repo.lastKey, repo.sales)
	}
}

func TestClosureStatusNormalizesTheDestinationDay(t *testing.T) {
	repo := &ticketingRepoStub{}
	status, err := NewTicketingService(repo).ClosureStatus(context.Background(), uuid.New(), uuid.New(), time.Now())
	if err != nil || status.Date == "" {
		t.Fatalf("want a date-scoped status, got %+v err=%v", status, err)
	}
}
