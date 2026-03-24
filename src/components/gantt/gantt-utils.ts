import {
  parseISO,
  min,
  max,
  subDays,
  addDays,
  differenceInCalendarDays,
} from 'date-fns';
import type { ComputedTask } from '@/types/scheduling';

// ── Layout constants ────────────────────────────────────────────────
export const DAY_WIDTH = 34;
export const ROW_HEIGHT = 28;
export const BAR_HEIGHT = 18;
export const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2; // 5
export const HEADER_HEIGHT = 40; // two 20px rows: month + day

// ── Date range ──────────────────────────────────────────────────────
export interface DateRange {
  startDate: Date;
  endDate: Date;
  totalDays: number;
}

/**
 * Compute the visible date range across ALL tasks (not just visible ones)
 * so the timeline doesn't jump when collapsing groups.
 */
export function computeDateRange(
  tasks: ComputedTask[],
  paddingBefore = 7,
  paddingAfter = 14
): DateRange {
  if (tasks.length === 0) {
    const today = new Date();
    const startDate = subDays(today, paddingBefore);
    const endDate = addDays(today, paddingAfter);
    return {
      startDate,
      endDate,
      totalDays: differenceInCalendarDays(endDate, startDate) + 1,
    };
  }

  const starts = tasks.map((t) => parseISO(t.effectiveStartDate));
  const ends = tasks.map((t) => parseISO(t.endDate));

  const earliest = subDays(min(starts), paddingBefore);
  const latest = addDays(max(ends), paddingAfter);

  return {
    startDate: earliest,
    endDate: latest,
    totalDays: differenceInCalendarDays(latest, earliest) + 1,
  };
}

/**
 * Convert an ISO date string to an X pixel offset relative to rangeStart.
 */
export function dateToX(dateISO: string, rangeStart: Date): number {
  return differenceInCalendarDays(parseISO(dateISO), rangeStart) * DAY_WIDTH;
}
