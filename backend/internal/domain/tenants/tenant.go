package tenants

import (
	"errors"
	"github.com/google/uuid"
	"strings"
)

var ErrInvalidName = errors.New("tenant name is required")

type Tenant struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

// Summary is the platform-admin view of one tourism operator.
type Summary struct {
	Tenant
	Sites    int `json:"sites"`
	Accounts int `json:"accounts"`
}

func New(name string) (Tenant, error) {
	if strings.TrimSpace(name) == "" {
		return Tenant{}, ErrInvalidName
	}
	return Tenant{ID: uuid.New(), Name: strings.TrimSpace(name)}, nil
}
