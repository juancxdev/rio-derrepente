package visits

import (
	"errors"
	"github.com/google/uuid"
	"testing"
	"time"
)

func TestNewRecordRejectsInvalidCounts(t *testing.T) {
	_, err := NewRecord(uuid.New(), time.Now(), 1, 0, 0, 0, "")
	if !errors.Is(err, ErrInvalidTotal) {
		t.Fatalf("expected ErrInvalidTotal, got %v", err)
	}
}
func TestNewRecordCreatesValidRecord(t *testing.T) {
	v, err := NewRecord(uuid.New(), time.Now(), 1, 2, 3, 6, "ok")
	if err != nil || v.TotalVisitors != 6 {
		t.Fatalf("unexpected result: %+v %v", v, err)
	}
}
