import { describe, it, expect } from 'vitest';
import { addWorkingDays } from '../date-calculator';

describe('addWorkingDays', () => {
  it('adds 1 business day from Monday', () => {
    // Mon 2026-03-16 + 1 business day = Tue 2026-03-17
    expect(addWorkingDays('2026-03-16', 1, false)).toBe('2026-03-17');
  });

  it('adds 1 business day from Friday (skips weekend)', () => {
    // Fri 2026-03-20 + 1 business day = Mon 2026-03-23
    expect(addWorkingDays('2026-03-20', 1, false)).toBe('2026-03-23');
  });

  it('adds 5 business days from Friday', () => {
    // Fri 2026-03-20 + 5 business days = Fri 2026-03-27
    expect(addWorkingDays('2026-03-20', 5, false)).toBe('2026-03-27');
  });

  it('adds 1 calendar day from Friday when includeWeekends=true', () => {
    // Fri 2026-03-20 + 1 calendar day = Sat 2026-03-21
    expect(addWorkingDays('2026-03-20', 1, true)).toBe('2026-03-21');
  });

  it('handles Saturday start with business days', () => {
    // Sat 2026-03-21 + 1 business day -> advance to Mon first, then +1 = Tue 2026-03-24
    expect(addWorkingDays('2026-03-21', 1, false)).toBe('2026-03-24');
  });

  it('ceils fractional duration to 1', () => {
    // 0.5 days ceils to 1 working day
    // Mon 2026-03-16 + ceil(0.5)=1 business day = Tue 2026-03-17
    expect(addWorkingDays('2026-03-16', 0.5, false)).toBe('2026-03-17');
  });

  it('returns same date for zero duration', () => {
    expect(addWorkingDays('2026-03-16', 0, false)).toBe('2026-03-16');
  });
});
