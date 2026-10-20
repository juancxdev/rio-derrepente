package application

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/closures"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
	"github.com/juancx/tourism-platform/backend/internal/domain/tenants"
	"github.com/juancx/tourism-platform/backend/internal/domain/tickets"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
	"io"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidCSV = errors.New("invalid CSV: expected fecha,total and optional local,national,foreign columns")

type TicketingRepository interface {
	CreateTenant(context.Context, tenants.Tenant) (tenants.Tenant, error)
	CreateSite(context.Context, sites.Site) (sites.Site, error)
	ListSites(context.Context, uuid.UUID) ([]sites.Site, error)
	FindSite(context.Context, uuid.UUID, uuid.UUID) (sites.Site, error)
	ScopeExists(context.Context, uuid.UUID, uuid.UUID) bool
	CreateTickets(context.Context, uuid.UUID, uuid.UUID, time.Time, int, string) ([]tickets.Ticket, error)
	ImportHistorical(context.Context, uuid.UUID, uuid.UUID, string, []visits.Record) error
	ClosureStatus(context.Context, uuid.UUID, uuid.UUID, time.Time) (closures.Status, error)
}
type TicketingService struct{ repo TicketingRepository }

func NewTicketingService(repo TicketingRepository) TicketingService { return TicketingService{repo} }
func (s TicketingService) CreateTenant(ctx context.Context, name string) (tenants.Tenant, error) {
	t, err := tenants.New(name)
	if err != nil {
		return t, err
	}
	return s.repo.CreateTenant(ctx, t)
}
func (s TicketingService) CreateSite(ctx context.Context, tenantID uuid.UUID, code, name string, lat, lng float64, tz string) (sites.Site, error) {
	v, err := sites.New(tenantID, code, name, lat, lng, tz)
	if err != nil {
		return v, err
	}
	if _, err = time.LoadLocation(tz); err != nil {
		return sites.Site{}, sites.ErrInvalidSite
	}
	return s.repo.CreateSite(ctx, v)
}
func (s TicketingService) ListSites(ctx context.Context, tenantID uuid.UUID) ([]sites.Site, error) {
	return s.repo.ListSites(ctx, tenantID)
}
func (s TicketingService) OwnsSite(ctx context.Context, tenantID, siteID uuid.UUID) bool {
	return s.repo.ScopeExists(ctx, tenantID, siteID)
}
func (s TicketingService) Site(ctx context.Context, tenantID, siteID uuid.UUID) (sites.Site, error) {
	return s.repo.FindSite(ctx, tenantID, siteID)
}
func (s TicketingService) Sell(ctx context.Context, tenantID, siteID uuid.UUID, day time.Time, quantity int, idempotencyKey string) ([]tickets.Ticket, error) {
	if quantity < 1 || quantity > 100 {
		return nil, tickets.ErrInvalidQuantity
	}
	site, err := s.repo.FindSite(ctx, tenantID, siteID)
	if err != nil {
		return nil, err
	}
	location, err := time.LoadLocation(site.Timezone)
	if err != nil {
		return nil, sites.ErrInvalidSite
	}
	now := time.Now().In(location)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	issuedFor := localDay(day, location)
	if !issuedFor.Equal(today) {
		return nil, tickets.ErrInvalidIssueDate
	}
	return s.repo.CreateTickets(ctx, tenantID, siteID, issuedFor, quantity, idempotencyKey)
}

func (s TicketingService) ClosureStatus(ctx context.Context, tenantID, siteID uuid.UUID, day time.Time) (closures.Status, error) {
	site, err := s.repo.FindSite(ctx, tenantID, siteID)
	if err != nil {
		return closures.Status{}, err
	}
	location, err := time.LoadLocation(site.Timezone)
	if err != nil {
		return closures.Status{}, sites.ErrInvalidSite
	}
	return s.repo.ClosureStatus(ctx, tenantID, siteID, localDay(day, location))
}

// localDay keeps a calendar date intact when it comes from a YYYY-MM-DD
// payload (UTC midnight) and otherwise converts the instant to the
// destination timezone before dropping the clock.
func localDay(value time.Time, location *time.Location) time.Time {
	if value.Location() == time.UTC && value.Hour() == 0 && value.Minute() == 0 && value.Second() == 0 && value.Nanosecond() == 0 {
		year, month, day := value.Date()
		return time.Date(year, month, day, 0, 0, 0, 0, location)
	}
	local := value.In(location)
	year, month, day := local.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, location)
}
func (s TicketingService) ImportCSV(ctx context.Context, tenantID, siteID uuid.UUID, source string, body io.Reader) (int, error) {
	r := csv.NewReader(body)
	rows, err := r.ReadAll()
	if err != nil {
		return 0, ErrInvalidCSV
	}
	if len(rows) < 2 {
		return 0, ErrInvalidCSV
	}
	header := map[string]int{}
	for i, h := range rows[0] {
		header[strings.ToLower(strings.TrimSpace(h))] = i
	}
	dateCol, okDate := header["fecha"]
	totalCol, okTotal := header["total"]
	if !okDate || !okTotal {
		return 0, ErrInvalidCSV
	}
	out := make([]visits.Record, 0, len(rows)-1)
	value := func(row []string, key string) (int, error) {
		i, ok := header[key]
		if !ok {
			return 0, nil
		}
		if i >= len(row) {
			return 0, ErrInvalidCSV
		}
		return strconv.Atoi(strings.TrimSpace(row[i]))
	}
	for n, row := range rows[1:] {
		if len(row) <= totalCol || len(row) <= dateCol {
			return 0, fmt.Errorf("row %d: %w", n+2, ErrInvalidCSV)
		}
		d, e := time.Parse("2006-01-02", strings.TrimSpace(row[dateCol]))
		if e != nil {
			return 0, fmt.Errorf("row %d: %w", n+2, ErrInvalidCSV)
		}
		total, e := strconv.Atoi(strings.TrimSpace(row[totalCol]))
		if e != nil || total < 0 {
			return 0, fmt.Errorf("row %d: %w", n+2, ErrInvalidCSV)
		}
		local, e := value(row, "local")
		if e != nil {
			return 0, ErrInvalidCSV
		}
		national, e := value(row, "national")
		if e != nil {
			return 0, ErrInvalidCSV
		}
		foreign, e := value(row, "foreign")
		if e != nil {
			return 0, ErrInvalidCSV
		}
		if local < 0 || national < 0 || foreign < 0 || (local+national+foreign > 0 && local+national+foreign != total) {
			return 0, fmt.Errorf("row %d: %w", n+2, ErrInvalidCSV)
		}
		out = append(out, visits.Record{SiteID: siteID, VisitDate: d, LocalVisitors: local, NationalVisitors: national, ForeignVisitors: foreign, TotalVisitors: total})
	}
	if err := s.repo.ImportHistorical(ctx, tenantID, siteID, source, out); err != nil {
		return 0, err
	}
	return len(out), nil
}
