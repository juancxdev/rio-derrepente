import { describe, expect, it } from 'vitest';
import { addDays, dailyCycle, dateInZone, formatLongDate, isRegistrationOpen } from './time';

describe('isRegistrationOpen', () => {
  it('opens at 18:00 in America/Lima', () => {
    expect(isRegistrationOpen(new Date('2026-10-07T22:59:00Z'), 'America/Lima', 18)).toBe(false);
    expect(isRegistrationOpen(new Date('2026-10-07T23:00:00Z'), 'America/Lima', 18)).toBe(true);
  });

  it('uses the closure hour configured by the backend', () => {
    expect(isRegistrationOpen(new Date('2026-10-06T18:59:00Z'), 'America/Lima', 14)).toBe(false);
    expect(isRegistrationOpen(new Date('2026-10-06T19:00:00Z'), 'America/Lima', 14)).toBe(true);
  });

  it('respects the destination timezone instead of the browser timezone', () => {
    // 23:30 UTC is 18:30 in Lima but already the next day in UTC.
    expect(dateInZone(new Date('2026-10-07T23:30:00Z'), 'America/Lima')).toBe('2026-10-07');
    expect(dateInZone(new Date('2026-10-07T23:30:00Z'), 'UTC')).toBe('2026-10-07');
  });
});

describe('dailyCycle', () => {
  it('does not consult tomorrow before the automatic closing window', () => {
    const cycle = dailyCycle(new Date('2026-10-06T15:00:00Z'), 'America/Lima', 18);
    expect(cycle.today).toBe('2026-10-06');
    expect(cycle.tomorrow).toBe('2026-10-07');
    expect(cycle.registrationOpen).toBe(false);
    expect(cycle.canShowTomorrow).toBe(false);
  });

  it('consults tomorrow after the closure while the Worker completes the close', () => {
    const cycle = dailyCycle(new Date('2026-10-06T23:10:00Z'), 'America/Lima', 18);
    expect(cycle.registrationOpen).toBe(true);
    expect(cycle.canShowTomorrow).toBe(true);
  });

  it('resets the window when the destination local date changes', () => {
    const cycle = dailyCycle(new Date('2026-10-07T05:01:00Z'), 'America/Lima', 18);
    expect(cycle.today).toBe('2026-10-07');
    expect(cycle.canShowTomorrow).toBe(false);
  });

  it('exposes the configured closure hour to the UI copy', () => {
    const cycle = dailyCycle(new Date('2026-10-07T01:10:00Z'), 'America/Lima', 20);
    expect(cycle.closureHour).toBe(20);
    expect(cycle.canShowTomorrow).toBe(true);
  });
});

describe('date helpers', () => {
  it('adds calendar days without shifting the date through a timezone', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formats a long date in the destination locale', () => {
    expect(formatLongDate('2026-10-20', 'America/Lima')).toContain('octubre');
  });
});
