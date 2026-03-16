import type { RawTask, Dependency } from '@/types/scheduling';

interface KahnResult {
  sorted: RawTask[];
  remaining: RawTask[];
}

/**
 * Internal Kahn's BFS topological sort.
 * Returns sorted tasks and any remaining tasks (which form cycles).
 */
function kahnSort(tasks: RawTask[], deps: Dependency[]): KahnResult {
  const taskMap = new Map<string, RawTask>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // Build in-degree map and adjacency list
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }

  for (const dep of deps) {
    // Only process deps where both tasks exist in the input
    if (taskMap.has(dep.upstreamTaskId) && taskMap.has(dep.downstreamTaskId)) {
      inDegree.set(dep.downstreamTaskId, (inDegree.get(dep.downstreamTaskId) ?? 0) + 1);
      adjacency.get(dep.upstreamTaskId)!.push(dep.downstreamTaskId);
    }
  }

  // BFS: start with nodes having in-degree 0
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sorted: RawTask[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(taskMap.get(current)!);

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Remaining tasks are those not in sorted (part of or blocked by cycles)
  const sortedIds = new Set(sorted.map((t) => t.id));
  const remaining = tasks.filter((t) => !sortedIds.has(t.id));

  return { sorted, remaining };
}

/**
 * Returns tasks in topological order respecting dependencies.
 * Tasks with no dependencies can appear in any order relative to each other.
 */
export function topologicalSort(tasks: RawTask[], deps: Dependency[]): RawTask[] {
  return kahnSort(tasks, deps).sorted;
}

/**
 * Detects cycles in the dependency graph.
 * Returns an array of task titles involved in/blocked by the cycle, or null if no cycle exists.
 */
export function detectCycle(tasks: RawTask[], deps: Dependency[]): string[] | null {
  const { remaining } = kahnSort(tasks, deps);
  if (remaining.length === 0) {
    return null;
  }
  return remaining.map((t) => t.title);
}
