package sites

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestNewValidatesRequiredFields(t *testing.T) {
	tenant := uuid.New()
	if _, err := New(tenant, "", "Catarata", -9.2, -75.9, "America/Lima"); err == nil {
		t.Fatal("expected an error for an empty code")
	}
	if _, err := New(tenant, "catarata", "Catarata", 120, -75.9, "America/Lima"); err == nil {
		t.Fatal("expected an error for an out-of-range latitude")
	}
	if _, err := New(tenant, "catarata", "Catarata", -9.2, -75.9, "America/Lima"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// Guards the frontend contract: latitude and longitude must serialize as two
// distinct keys, not as a duplicated "latitude" tag.
func TestSiteJSONSeparatesCoordinates(t *testing.T) {
	site, err := New(uuid.New(), "catarata", "Catarata", -9.295, -75.996, "America/Lima")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	body, err := json.Marshal(site)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	text := string(body)
	if !strings.Contains(text, `"latitude":-9.295`) {
		t.Fatalf("expected latitude in %s", text)
	}
	if !strings.Contains(text, `"longitude":-75.996`) {
		t.Fatalf("expected longitude in %s", text)
	}

	var decoded map[string]any
	if err := json.Unmarshal(body, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if decoded["longitude"] != -75.996 {
		t.Fatalf("expected longitude to round-trip, got %v", decoded["longitude"])
	}
}
