import { eachDayOfInterval, parseISO, format, isWeekend } from 'date-fns';
import { countWorkingDays } from '@/lib/scheduling/date-calculator';
import type { ComputedTask } from '@/types/scheduling';

/** A single point on the planned progress curve. */
export interface ProgressPoint {
  /** ISO YYYY-MM-DD */
  date: string;
  /** Cumulative work-days that should be complete by this date */
  planned: number;
}

/**
 * Returns only leaf tasks (tasks that are not a parent of any other task).
 * Parent tasks are excluded to prevent double-counting.
 */
function getLeafTasks(tasks: ComputedTask[]): ComputedTask[] {
  const parentIds = new Set<string>();
  for (const t of tasks) {
    if (t.parentTaskId) {
      parentIds.add(t.parentTaskId);
    }
  }
  return tasks.filter((t) => !parentIds.has(t.id));
}

/**
 * Computes the planned progress curve as cumulative work-days per day.
 *
 * Uses only leaf tasks to avoid double-counting parent/summary tasks.
 * Returns a monotonically increasing array of { date, planned } points
 * from the earliest task start to the latest task end.
 */
export function computePlannedCurve(
  tasks: ComputedTask[],
  includeWeekends: boolean
): ProgressPoint[] {
  const leafTasks = getLeafTasks(tasks);
  if (leafTasks.length === 0) return [];

  // Find project date range from leaf tasks
  let earliest = leafTasks[0].effectiveStartDate;
  let latest = leafTasks[0].endDate;
  for (const t of leafTasks) {
    if (t.effectiveStartDate < earliest) earliest = t.effectiveStartDate;
    if (t.endDate > latest) latest = t.endDate;
  }

  // Generate all days in range
  const allDays = eachDayOfInterval({
    start: parseISO(earliest),
    end: parseISO(latest),
  });

  // Filter out weekends when includeWeekends is false
  const days = includeWeekends
    ? allDays
    : allDays.filter((d) => !isWeekend(d));

  const result: ProgressPoint[] = [];

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');
    let sum = 0;

    for (const task of leafTasks) {
      if (dateStr < task.effectiveStartDate) {
        // Task hasn't started yet -- contribute 0
        continue;
      }
      if (dateStr >= task.endDate) {
        // Task fully complete by this date
        sum += task.durationDays;
      } else {
        // Task partially complete
        const partial = countWorkingDays(
          task.effectiveStartDate,
          dateStr,
          includeWeekends
        );
        sum += Math.min(partial, task.durationDays);
      }
    }

    result.push({ date: dateStr, planned: sum });
  }

  return result;
}

/**
 * Computes the actual progress as total completed work-days.
 *
 * Uses only leaf tasks to avoid double-counting parent/summary tasks.
 * Returns sum of (completionPct / 100) * durationDays for each leaf task.
 */
export function computeActualProgress(tasks: ComputedTask[]): number {
  const leafTasks = getLeafTasks(tasks);
  return leafTasks.reduce(
    (sum, t) => sum + (t.completionPct / 100) * t.durationDays,
    0
  );
}
