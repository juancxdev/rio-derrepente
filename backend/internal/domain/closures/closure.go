package closures

import "time"

// Status describes the automatic daily close for one destination and day.
// It is read by the dashboard so the UI never infers closure state from
// localStorage or a manual browser registration.
type Status struct {
	Date                string     `json:"date"`
	Closed              bool       `json:"closed"`
	EventPublishedAt    *time.Time `json:"event_published_at,omitempty"`
	EventError          *string    `json:"event_error,omitempty"`
	Tickets             int        `json:"tickets"`
	PredictionAvailable bool       `json:"prediction_available"`
}

// State is the UI-facing label: pending before the close, processing while the
// worker/ML pipeline runs, and ready once the persisted prediction exists.
func (s Status) State() string {
	if s.PredictionAvailable {
		return "ready"
	}
	if s.Closed {
		return "processing"
	}
	return "pending"
}
