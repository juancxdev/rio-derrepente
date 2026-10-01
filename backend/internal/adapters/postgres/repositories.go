package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juancx/tourism-platform/backend/internal/domain/predictions"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
)

var ErrDuplicate = errors.New("visit already exists for site and date")
var ErrNotFound = errors.New("prediction not found")

type Repositories struct{ Pool *pgxpool.Pool }

func New(ctx context.Context, url string) (*Repositories, error) {
	p, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	return &Repositories{Pool: p}, nil
}
func (r *Repositories) Close() { r.Pool.Close() }

func (r *Repositories) Create(ctx context.Context, v visits.Record) (visits.Record, error) {
	err := r.Pool.QueryRow(ctx, `INSERT INTO visit_records(site_id, visit_date, local_visitors, national_visitors, foreign_visitors, total_visitors, notes)
VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, v.SiteID, v.VisitDate, v.LocalVisitors, v.NationalVisitors, v.ForeignVisitors, v.TotalVisitors, v.Notes).Scan(&v.ID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return visits.Record{}, ErrDuplicate
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
