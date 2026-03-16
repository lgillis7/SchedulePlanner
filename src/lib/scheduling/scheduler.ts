import { topologicalSort, detectCycle } from './dependency-graph';
import { addWorkingDays } from './date-calculator';
import type { RawTask, ComputedTask, Dependency } from '@/types/scheduling';
import { CyclicDependencyError } from '@/types/scheduling';

/**
 * Computes the full schedule for a set of tasks and dependencies.
 *
 * For each task, computes:
 * - requiredStartDate: earliest start considering upstream dependencies
 * - effectiveStartDate: max(requiredStartDate, desiredStartDate)
 * - endDate: effectiveStartDate + durationDays
 *
 * @throws CyclicDependencyError if the dependency graph contains a cycle
 */
export function computeSchedule(
  tasks: RawTask[],
  dependencies: Dependency[],
  includeWeekends: boolean
): ComputedTask[] {
  if (tasks.length === 0) {
    return [];
  }

  // Check for cycles first
  const cycleResult = detectCycle(tasks, dependencies);
  if (cycleResult !== null) {
    throw new CyclicDependencyError(cycleResult);
  }

  // Get topologically sorted tasks
  const sorted = topologicalSort(tasks, dependencies);

  // Build upstream lookup: taskId -> [upstream task IDs]
  const upstreamMap = new Map<string, string[]>();
  for (const task of tasks) {
    upstreamMap.set(task.id, []);
  }
  for (const dep of dependencies) {
    const downstreamUpstreams = upstreamMap.get(dep.downstreamTaskId);
    if (downstreamUpstreams) {
      downstreamUpstreams.push(dep.upstreamTaskId);
    }
  }

  // Forward pass: compute dates in topological order
  const endDates = new Map<string, string>();
  const computed: ComputedTask[] = [];

  for (const task of sorted) {
    const upstreams = upstreamMap.get(task.id) ?? [];

    // requiredStartDate = max of all upstream end dates, or desiredStartDate if no upstreams
    let requiredStartDate: string;
    if (upstreams.length === 0) {
      requiredStartDate = task.desiredStartDate;
    } else {
      requiredStartDate = upstreams.reduce((maxDate, upId) => {
        const upEnd = endDates.get(upId)!;
        return upEnd > maxDate ? upEnd : maxDate;
      }, '0000-00-00');
    }

    // effectiveStartDate = max(requiredStartDate, desiredStartDate)
    const effectiveStartDate =
      requiredStartDate > task.desiredStartDate ? requiredStartDate : task.desiredStartDate;

    // endDate = effectiveStartDate + durationDays
    const endDate = addWorkingDays(effectiveStartDate, task.durationDays, includeWeekends);

    endDates.set(task.id, endDate);

    computed.push({
      ...task,
      requiredStartDate,
      effectiveStartDate,
      endDate,
    });
  }

  return computed;
}
