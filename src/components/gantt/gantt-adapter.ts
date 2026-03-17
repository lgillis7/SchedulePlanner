import { parseISO } from 'date-fns';
import type { ComputedTask, Dependency, Owner } from '@/types/scheduling';
import type { TID } from '@svar-ui/react-gantt';

/**
 * SVAR task shape -- defined locally to decouple from SVAR internals.
 * ITask from SVAR accepts `[key: string]: any` so custom fields are allowed.
 */
export interface SvarTask {
  id: string;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  progress: number; // 0-100
  parent: TID; // string ID or 0 for root-level
  type: 'task' | 'summary';
  open?: boolean;
  /** Custom field: owner color for bar styling */
  $color: string;
}

export interface SvarLink {
  id: string;
  source: string;
  target: string;
  type: 'e2s'; // end-to-start = finish-to-start
}

const DEFAULT_NEUTRAL_COLOR = '#94A3B8'; // Tailwind slate-400

/**
 * Transform domain ComputedTasks + Owners into SVAR-compatible task objects.
 * Pure function -- no side effects.
 */
export function toSvarTasks(
  tasks: ComputedTask[],
  owners: Owner[],
  collapsedIds?: Set<string>
): SvarTask[] {
  const ownerMap = new Map(owners.map((o) => [o.id, o]));
  const parentIds = new Set(
    tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId)
  );

  return tasks.map((t) => {
    const isSummary = parentIds.has(t.id);
    return {
    id: t.id,
    text: t.title,
    start: parseISO(t.effectiveStartDate),
    end: parseISO(t.endDate),
    duration: t.durationDays,
    progress: t.completionPct,
    parent: t.parentTaskId ?? 0,
    type: isSummary ? ('summary' as const) : ('task' as const),
    // Only set open on summary tasks — SVAR's toArray recurses into
    // a.data when open===true, but leaf nodes have data:null which crashes.
    open: isSummary ? !collapsedIds?.has(t.id) : undefined,
    $color: t.ownerId
      ? (ownerMap.get(t.ownerId)?.color ?? DEFAULT_NEUTRAL_COLOR)
      : DEFAULT_NEUTRAL_COLOR,
  };
  });
}

/**
 * Transform domain Dependencies into SVAR-compatible link objects.
 * Pure function -- no side effects.
 */
export function toSvarLinks(deps: Dependency[]): SvarLink[] {
  return deps.map((d) => ({
    id: d.id,
    source: d.upstreamTaskId,
    target: d.downstreamTaskId,
    type: 'e2s' as const,
  }));
}

/**
 * Sort tasks in tree order: parent → children (recursively), siblings by sortOrder.
 * Matches SVAR's internal tree display order for scroll sync alignment.
 */
export function treeSortTasks<
  T extends { id: string; parentTaskId: string | null; sortOrder: number }
>(tasks: T[]): T[] {
  const byParent = new Map<string | null, T[]>();
  for (const t of tasks) {
    const key = t.parentTaskId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const result: T[] = [];
  function visit(parentId: string | null) {
    for (const task of byParent.get(parentId) ?? []) {
      result.push(task);
      visit(task.id);
    }
  }
  visit(null);
  return result;
}
