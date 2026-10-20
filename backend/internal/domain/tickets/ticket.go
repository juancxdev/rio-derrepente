package tickets

import (
	"errors"
	"github.com/google/uuid"
	"time"
)

var ErrInvalidQuantity = errors.New("quantity must be positive")
var ErrInvalidIssueDate = errors.New("tickets can only be issued for the destination's current local day")

type Ticket struct {
	ID, TenantID, SiteID uuid.UUID
	IssuedFor            time.Time
	EmissionCode         string
}

func New(tenantID, siteID uuid.UUID, issuedFor time.Time, code string) Ticket {
	return Ticket{ID: uuid.New(), TenantID: tenantID, SiteID: siteID, IssuedFor: issuedFor, EmissionCode: code}
}
