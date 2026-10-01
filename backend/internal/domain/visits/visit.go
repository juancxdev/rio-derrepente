package visits

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNegativeVisitors = errors.New("visitor counts cannot be negative")
	ErrInvalidTotal     = errors.New("total visitors must equal the sum of visitor categories")
	ErrInvalidDate      = errors.New("visit date is required")
)

type Record struct {
	ID               int64
	SiteID           uuid.UUID
	VisitDate        time.Time
	LocalVisitors    int
	NationalVisitors int
	ForeignVisitors  int
	TotalVisitors    int
	Notes            string
}

func NewRecord(siteID uuid.UUID, visitDate time.Time, local, national, foreign int, total int, notes string) (Record, error) {
	if visitDate.IsZero() {
		return Record{}, ErrInvalidDate
	}
	if local < 0 || national < 0 || foreign < 0 || total < 0 {
		return Record{}, ErrNegativeVisitors
	}
	if local+national+foreign != total {
		return Record{}, ErrInvalidTotal
	}
	return Record{SiteID: siteID, VisitDate: visitDate, LocalVisitors: local, NationalVisitors: national, ForeignVisitors: foreign, TotalVisitors: total, Notes: notes}, nil
}
