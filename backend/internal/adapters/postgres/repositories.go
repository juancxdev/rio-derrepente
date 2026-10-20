package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juancx/tourism-platform/backend/internal/domain/closures"
	"github.com/juancx/tourism-platform/backend/internal/domain/predictions"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
	"github.com/juancx/tourism-platform/backend/internal/domain/tenants"
	"github.com/juancx/tourism-platform/backend/internal/domain/tickets"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
)

var ErrDuplicate = errors.New("visit already exists for site and date")
var ErrDuplicateSite = errors.New("a destination with this code already exists in the tenant")
var ErrNotFound = errors.New("prediction not found")
var ErrScopeNotFound = errors.New("tenant or site not found")
var ErrClosedDay = errors.New("the daily closure already exists for this date")

type Repositories struct{ Pool *pgxpool.Pool }

func New(ctx context.Context, url string) (*Repositories, error) {
	p, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	return &Repositories{Pool: p}, nil
}

func (r *Repositories) CreateTenant(ctx context.Context, t tenants.Tenant) (tenants.Tenant, error) {
	err := r.Pool.QueryRow(ctx, `INSERT INTO tenants(id,name) VALUES($1,$2) RETURNING id`, t.ID, t.Name).Scan(&t.ID)
	return t, err
}
func (r *Repositories) CreateSite(ctx context.Context, s sites.Site) (sites.Site, error) {
	if !r.scopeExists(ctx, s.TenantID, uuid.Nil) {
		return sites.Site{}, ErrScopeNotFound
	}
	err := r.Pool.QueryRow(ctx, `INSERT INTO tourist_sites(id,tenant_id,code,name,latitude,longitude,timezone) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, s.ID, s.TenantID, s.Code, s.Name, s.Latitude, s.Longitude, s.Timezone).Scan(&s.ID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return sites.Site{}, ErrDuplicateSite
	}
	return s, err
}
func (r *Repositories) ListSites(ctx context.Context, tenantID uuid.UUID) ([]sites.Site, error) {
	rows, err := r.Pool.Query(ctx, `SELECT id,tenant_id,code,name,latitude,longitude,timezone FROM tourist_sites WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []sites.Site{}
	for rows.Next() {
		var s sites.Site
		if err := rows.Scan(&s.ID, &s.TenantID, &s.Code, &s.Name, &s.Latitude, &s.Longitude, &s.Timezone); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}
func (r *Repositories) FindSite(ctx context.Context, tenantID, siteID uuid.UUID) (sites.Site, error) {
	var s sites.Site
	err := r.Pool.QueryRow(ctx, `SELECT id,tenant_id,code,name,latitude,longitude,timezone FROM tourist_sites WHERE tenant_id=$1 AND id=$2`, tenantID, siteID).Scan(&s.ID, &s.TenantID, &s.Code, &s.Name, &s.Latitude, &s.Longitude, &s.Timezone)
	if errors.Is(err, pgx.ErrNoRows) {
		return sites.Site{}, ErrScopeNotFound
	}
	return s, err
}
func (r *Repositories) ListAllSites(ctx context.Context) ([]sites.Site, error) {
	rows, err := r.Pool.Query(ctx, `SELECT id,tenant_id,code,name,latitude,longitude,timezone FROM tourist_sites ORDER BY tenant_id,name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []sites.Site{}
	for rows.Next() {
		var s sites.Site
		if err := rows.Scan(&s.ID, &s.TenantID, &s.Code, &s.Name, &s.Latitude, &s.Longitude, &s.Timezone); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}
func (r *Repositories) CreateTickets(ctx context.Context, tenantID, siteID uuid.UUID, issuedFor time.Time, quantity int, idempotencyKey string) ([]tickets.Ticket, error) {
	if !r.scopeExists(ctx, tenantID, siteID) {
		return nil, ErrScopeNotFound
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if idempotencyKey != "" {
		// Serialize identical retries so two concurrent clicks cannot both pass
		// the existence check and emit twice.
		if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, tenantID.String()+":"+siteID.String()+":"+idempotencyKey); err != nil {
			return nil, err
		}
		var codes []string
		err = tx.QueryRow(ctx, `SELECT codes FROM ticket_sale_requests WHERE tenant_id=$1 AND site_id=$2 AND idempotency_key=$3`, tenantID, siteID, idempotencyKey).Scan(&codes)
		if err == nil {
			previous := make([]tickets.Ticket, 0, len(codes))
			for _, code := range codes {
				previous = append(previous, tickets.Ticket{TenantID: tenantID, SiteID: siteID, IssuedFor: issuedFor, EmissionCode: code})
			}
			return previous, tx.Commit(ctx)
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}
	result := make([]tickets.Ticket, 0, quantity)
	codes := make([]string, 0, quantity)
	for i := 0; i < quantity; i++ {
		code := uuid.NewString()
		t := tickets.New(tenantID, siteID, issuedFor, code)
		if _, err = tx.Exec(ctx, `INSERT INTO tickets(id,tenant_id,site_id,issued_for,emission_code) VALUES($1,$2,$3,$4,$5)`, t.ID, t.TenantID, t.SiteID, t.IssuedFor, t.EmissionCode); err != nil {
			return nil, err
		}
		result = append(result, t)
		codes = append(codes, code)
	}
	if idempotencyKey != "" {
		if _, err = tx.Exec(ctx, `INSERT INTO ticket_sale_requests(tenant_id,site_id,idempotency_key,quantity,codes) VALUES($1,$2,$3,$4,$5)`, tenantID, siteID, idempotencyKey, quantity, codes); err != nil {
			return nil, err
		}
	}
	return result, tx.Commit(ctx)
}

// ClosureStatus returns the automatic close state for one day without
// inventing data: the prediction flag comes from the persisted predictions.
func (r *Repositories) ClosureStatus(ctx context.Context, tenantID, siteID uuid.UUID, day time.Time) (closures.Status, error) {
	if !r.scopeExists(ctx, tenantID, siteID) {
		return closures.Status{}, ErrScopeNotFound
	}
	status := closures.Status{Date: day.Format("2006-01-02")}
	if err := r.Pool.QueryRow(ctx, `SELECT count(*) FROM tickets WHERE tenant_id=$1 AND site_id=$2 AND issued_for=$3`, tenantID, siteID, day).Scan(&status.Tickets); err != nil {
		return closures.Status{}, err
	}
	err := r.Pool.QueryRow(ctx, `SELECT event_published_at,event_error FROM daily_closures WHERE tenant_id=$1 AND site_id=$2 AND closure_date=$3`, tenantID, siteID, day).
		Scan(&status.EventPublishedAt, &status.EventError)
	if err == nil {
		status.Closed = true
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return closures.Status{}, err
	}
	if err := r.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM predictions WHERE site_id=$1 AND prediction_date=$2)`, siteID, day.AddDate(0, 0, 1)).Scan(&status.PredictionAvailable); err != nil {
		return closures.Status{}, err
	}
	return status, nil
}
func (r *Repositories) ImportHistorical(ctx context.Context, tenantID, siteID uuid.UUID, source string, records []visits.Record) error {
	if !r.scopeExists(ctx, tenantID, siteID) {
		return ErrScopeNotFound
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for _, v := range records {
		var closed bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM daily_closures WHERE tenant_id=$1 AND site_id=$2 AND closure_date=$3)`, tenantID, siteID, v.VisitDate).Scan(&closed); err != nil {
			return err
		}
		if closed {
			return ErrClosedDay
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO historical_imports(tenant_id,site_id,source,row_count) VALUES($1,$2,$3,$4)`, tenantID, siteID, source, len(records)); err != nil {
		return err
	}
	for _, v := range records {
		if _, err = tx.Exec(ctx, `INSERT INTO visit_records(tenant_id,site_id,visit_date,local_visitors,national_visitors,foreign_visitors,total_visitors,notes,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'historical_import') ON CONFLICT(site_id,visit_date) DO UPDATE SET local_visitors=EXCLUDED.local_visitors,national_visitors=EXCLUDED.national_visitors,foreign_visitors=EXCLUDED.foreign_visitors,total_visitors=EXCLUDED.total_visitors,notes=EXCLUDED.notes,source=EXCLUDED.source`, tenantID, siteID, v.VisitDate, v.LocalVisitors, v.NationalVisitors, v.ForeignVisitors, v.TotalVisitors, v.Notes); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
func (r *Repositories) scopeExists(ctx context.Context, tenantID, siteID uuid.UUID) bool {
	var ok bool
	q := `SELECT EXISTS(SELECT 1 FROM tenants WHERE id=$1)`
	args := []any{tenantID}
	if siteID != uuid.Nil {
		q = `SELECT EXISTS(SELECT 1 FROM tourist_sites WHERE tenant_id=$1 AND id=$2)`
		args = append(args, siteID)
	}
	return r.Pool.QueryRow(ctx, q, args...).Scan(&ok) == nil && ok
}

// ScopeExists is intentionally small: it is the ownership guard used before
// tenant-scoped reads, while writes repeat the check inside their transaction.
func (r *Repositories) ScopeExists(ctx context.Context, tenantID, siteID uuid.UUID) bool {
	return r.scopeExists(ctx, tenantID, siteID)
}
func (r *Repositories) CloseDay(ctx context.Context, tenantID, siteID uuid.UUID, day time.Time, weatherJSON []byte) (int64, bool, error) {
	if !r.scopeExists(ctx, tenantID, siteID) {
		return 0, false, ErrScopeNotFound
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return 0, false, err
	}
	defer tx.Rollback(ctx)
	var existing int64
	var unpublished bool
	err = tx.QueryRow(ctx, `SELECT visit_record_id,event_published_at IS NULL FROM daily_closures WHERE tenant_id=$1 AND site_id=$2 AND closure_date=$3`, tenantID, siteID, day).Scan(&existing, &unpublished)
	if err == nil {
		return existing, unpublished, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return 0, false, err
	}
	var total int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM tickets WHERE tenant_id=$1 AND site_id=$2 AND issued_for=$3`, tenantID, siteID, day).Scan(&total); err != nil {
		return 0, false, err
	}
	err = tx.QueryRow(ctx, `INSERT INTO visit_records(tenant_id,site_id,visit_date,local_visitors,national_visitors,foreign_visitors,total_visitors,source,weather_observed) VALUES($1,$2,$3,0,0,0,$4,'ticket_sales',$5::jsonb) ON CONFLICT(site_id,visit_date) DO UPDATE SET total_visitors=EXCLUDED.total_visitors,source='ticket_sales',weather_observed=EXCLUDED.weather_observed RETURNING id`, tenantID, siteID, day, total, string(weatherJSON)).Scan(&existing)
	if err != nil {
		return 0, false, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO daily_closures(tenant_id,site_id,closure_date,visit_record_id) VALUES($1,$2,$3,$4)`, tenantID, siteID, day, existing); err != nil {
		return 0, false, err
	}
	return existing, true, tx.Commit(ctx)
}
func (r *Repositories) MarkClosureEvent(ctx context.Context, tenantID, siteID uuid.UUID, day time.Time, publishErr error) error {
	if publishErr != nil {
		_, err := r.Pool.Exec(ctx, `UPDATE daily_closures SET event_error=$4 WHERE tenant_id=$1 AND site_id=$2 AND closure_date=$3`, tenantID, siteID, day, publishErr.Error())
		return err
	}
	_, err := r.Pool.Exec(ctx, `UPDATE daily_closures SET event_published_at=now(),event_error=NULL WHERE tenant_id=$1 AND site_id=$2 AND closure_date=$3`, tenantID, siteID, day)
	return err
}
func (r *Repositories) Close() { r.Pool.Close() }

func (r *Repositories) Create(ctx context.Context, v visits.Record) (visits.Record, error) {
	err := r.Pool.QueryRow(ctx, `INSERT INTO visit_records(tenant_id, site_id, visit_date, local_visitors, national_visitors, foreign_visitors, total_visitors, notes)
SELECT tenant_id, id, $2, $3, $4, $5, $6, $7 FROM tourist_sites WHERE id=$1
RETURNING id`, v.SiteID, v.VisitDate, v.LocalVisitors, v.NationalVisitors, v.ForeignVisitors, v.TotalVisitors, v.Notes).Scan(&v.ID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return visits.Record{}, ErrDuplicate
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return visits.Record{}, ErrScopeNotFound
		}
		return visits.Record{}, err
	}
	return v, nil
}

func (r *Repositories) FindByDate(ctx context.Context, siteID uuid.UUID, date time.Time) (predictions.Prediction, error) {
	var p predictions.Prediction
	err := r.Pool.QueryRow(ctx, `SELECT p.site_id,p.prediction_date,p.estimated_visitors,p.score,p.level,p.model_version,w.temperature_max,w.precipitation_probability
FROM predictions p LEFT JOIN LATERAL (
 SELECT temperature_max, precipitation_probability FROM weather_forecasts w
 WHERE w.site_id=p.site_id AND w.forecast_date=p.prediction_date ORDER BY generated_at DESC LIMIT 1
) w ON TRUE WHERE p.site_id=$1 AND p.prediction_date=$2 ORDER BY p.generated_at DESC LIMIT 1`, siteID, date).Scan(&p.SiteID, &p.PredictionDate, &p.EstimatedVisitors, &p.Score, &p.Level, &p.ModelVersion, &p.TemperatureMax, &p.PrecipitationProb)
	if errors.Is(err, pgx.ErrNoRows) {
		return predictions.Prediction{}, ErrNotFound
	}
	return p, err
}
