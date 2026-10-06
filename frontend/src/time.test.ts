import { describe, expect, it } from 'vitest';
import { dailyCycle, isRegistrationOpen } from './time';

describe('isRegistrationOpen', () => {
  it('opens at 18:00 in America/Lima', () => {
    expect(isRegistrationOpen(new Date('2026-10-06T22:59:00Z'))).toBe(false);
    expect(isRegistrationOpen(new Date('2026-10-06T23:00:00Z'))).toBe(true);
  });

  it('does not authorize tomorrow before the daily close, even when a visit was registered', () => {
    const cycle = dailyCycle(new Date('2026-10-06T15:00:00Z'), '2026-10-06');
    expect(cycle.today).toBe('2026-10-06');
    expect(cycle.canShowTomorrow).toBe(false);
  });

  it('authorizes tomorrow only after 18:00 and after the current date was registered', () => {
    const cycle = dailyCycle(new Date('2026-10-06T23:10:00Z'), '2026-10-06');
    expect(cycle.registrationOpen).toBe(true);
    expect(cycle.canShowTomorrow).toBe(true);
  });

  it('keeps tomorrow blocked after 18:00 when today has not been registered', () => {
    const cycle = dailyCycle(new Date('2026-10-06T23:10:00Z'));
    expect(cycle.registrationOpen).toBe(true);
    expect(cycle.canShowTomorrow).toBe(false);
  });

  it('resets the authorization when the Lima date changes', () => {
    const cycle = dailyCycle(new Date('2026-10-07T05:01:00Z'), '2026-10-06');
    expect(cycle.today).toBe('2026-10-07');
    expect(cycle.canShowTomorrow).toBe(false);
  });
});
