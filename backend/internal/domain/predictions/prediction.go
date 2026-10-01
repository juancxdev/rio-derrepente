package predictions

import (
	"time"

	"github.com/google/uuid"
)

type Prediction struct {
	SiteID            uuid.UUID `json:"site_id"`
	PredictionDate    time.Time `json:"prediction_date"`
	EstimatedVisitors float64   `json:"estimated_visitors"`
	Score             float64   `json:"score"`
	Level             string    `json:"level"`
	ModelVersion      string    `json:"model_version"`
	TemperatureMax    *float64  `json:"temperature_max,omitempty"`
	PrecipitationProb *float64  `json:"precipitation_probability,omitempty"`
}
