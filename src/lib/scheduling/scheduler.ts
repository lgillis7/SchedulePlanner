import { topologicalSort, detectCycle } from './dependency-graph';
import { addWorkingDays, countWorkingDays } from './date-calculator';
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
 * Parent tasks (tasks that have children) get their dates rolled up:
 * - effectiveStartDate = min(children's effectiveStartDate)
 * - endDate = max(children's endDate)
 * - durationDays = working days between start and end
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

  // Identify parent tasks (tasks that have children)
  const childrenMap = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.parentTaskId) {
      if (!childrenMap.has(task.parentTaskId)) {
        childrenMap.set(task.parentTaskId, []);
      }
      childrenMap.get(task.parentTaskId)!.push(task.id);
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

  // Roll-up pass: parent tasks inherit dates from their children
  // Process bottom-up (deepest children first) so nested parents roll up correctly
  const computedMap = new Map(computed.map((t) => [t.id, t]));

  // Sort parents by tierDepth descending so deepest parents roll up first
  const parentIds = [...childrenMap.keys()].sort((a, b) => {
    const taskA = computedMap.get(a);
    const taskB = computedMap.get(b);
    return (taskB?.tierDepth ?? 0) - (taskA?.tierDepth ?? 0);
  });

  for (const parentId of parentIds) {
    const parent = computedMap.get(parentId);
    if (!parent) continue;

    const childIds = childrenMap.get(parentId) ?? [];
    if (childIds.length === 0) continue;

    let minStart = '9999-99-99';
    let maxEnd = '0000-00-00';

    for (const childId of childIds) {
      const child = computedMap.get(childId);
      if (!child) continue;
      if (child.effectiveStartDate < minStart) minStart = child.effectiveStartDate;
      if (child.endDate > maxEnd) maxEnd = child.endDate;
    }

    parent.effectiveStartDate = minStart;
    parent.requiredStartDate = minStart;
    parent.endDate = maxEnd;
    parent.durationDays = countWorkingDays(minStart, maxEnd, includeWeekends);

    // Update endDates map for any downstream dependencies
    endDates.set(parentId, maxEnd);
  }

  return computed;
}
