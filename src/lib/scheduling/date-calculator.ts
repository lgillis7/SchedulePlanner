import { addBusinessDays, addDays, isWeekend, nextMonday, parseISO, format } from 'date-fns';

/**
 * Adds working days (or calendar days) to an ISO date string.
 *
 * @param startISO - ISO date string YYYY-MM-DD
 * @param days - Number of days to add (fractional values are ceiled)
 * @param includeWeekends - If true, use calendar days; if false, skip weekends
 * @returns ISO date string YYYY-MM-DD
 */
export function addWorkingDays(startISO: string, days: number, includeWeekends: boolean): string {
  if (days === 0) {
    return startISO;
  }

  const ceiledDays = Math.ceil(days);

  // Parse date without timezone issues
  const start = parseISO(startISO);

  if (includeWeekends) {
    const result = addDays(start, ceiledDays);
    return format(result, 'yyyy-MM-dd');
  }

  // Business days: if start is on a weekend, advance to next Monday first
  let adjustedStart = start;
  if (isWeekend(start)) {
    adjustedStart = nextMonday(start);
  }

  const result = addBusinessDays(adjustedStart, ceiledDays);
  return format(result, 'yyyy-MM-dd');
}
