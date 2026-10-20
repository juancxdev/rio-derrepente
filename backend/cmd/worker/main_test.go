package main

import (
	"testing"
	"time"
)

func TestDateToCloseAllowsConfiguredHourAndLater(t *testing.T) {
	location := time.FixedZone("test", 0)
	for _, hour := range []int{18, 23} {
		day, ok := dateToClose(time.Date(2026, 10, 20, hour, 15, 0, 0, location), 18, false)
		if !ok || day.Format("2006-01-02") != "2026-10-20" {
			t.Fatalf("hour %d should close current day", hour)
		}
	}
	if _, ok := dateToClose(time.Date(2026, 10, 20, 17, 59, 0, 0, location), 18, false); ok {
		t.Fatal("must not close before the configured hour")
	}
}
