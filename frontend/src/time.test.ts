import { describe, expect, it } from 'vitest';
import { isRegistrationOpen } from './time';

describe('isRegistrationOpen', () => {
  it('opens at 18:00 in America/Lima', () => {
    expect(isRegistrationOpen(new Date('2026-10-06T22:59:00Z'))).toBe(false);
    expect(isRegistrationOpen(new Date('2026-10-06T23:00:00Z'))).toBe(true);
  });
});
