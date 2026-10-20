package sites

import (
	"errors"
	"github.com/google/uuid"
	"strings"
)

var ErrInvalidSite = errors.New("site name, coordinates and timezone are required")

type Site struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Timezone  string    `json:"timezone"`
}

func New(tenantID uuid.UUID, code, name string, latitude, longitude float64, timezone string) (Site, error) {
	if tenantID == uuid.Nil || strings.TrimSpace(name) == "" || strings.TrimSpace(code) == "" || strings.TrimSpace(timezone) == "" || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 {
		return Site{}, ErrInvalidSite
	}
	return Site{ID: uuid.New(), TenantID: tenantID, Code: strings.TrimSpace(code), Name: strings.TrimSpace(name), Latitude: latitude, Longitude: longitude, Timezone: timezone}, nil
}
