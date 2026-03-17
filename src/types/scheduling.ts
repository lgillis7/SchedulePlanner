/**
 * Domain types for the scheduling engine.
 *
 * All types use camelCase (TypeScript convention).
 * The Supabase query layer handles snake_case <-> camelCase mapping.
 */

/** A task as stored in the database (before scheduling computation). */
export interface RawTask {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  ownerId: string | null;
  title: string;
  /** Nesting depth: 0 = top-level, max 3 */
  tierDepth: 0 | 1 | 2 | 3;
  sortOrder: number;
  /** ISO date string YYYY-MM-DD */
  desiredStartDate: string;
  /** Duration in working days (must be > 0) */
  durationDays: number;
  /** Completion percentage 0-100 */
  completionPct: number;
  notes: string | null;
}

/** A task with computed scheduling dates from the engine. */
export interface ComputedTask extends RawTask {
  /** Earliest start date considering dependencies (ISO YYYY-MM-DD) */
  requiredStartDate: string;
  /** max(desiredStartDate, requiredStartDate) (ISO YYYY-MM-DD) */
  effectiveStartDate: string;
  /** effectiveStartDate + durationDays skipping weekends if needed (ISO YYYY-MM-DD) */
  endDate: string;
}

/** A dependency link between two tasks. */
export interface Dependency {
  id: string;
  projectId: string;
  upstreamTaskId: string;
  downstreamTaskId: string;
  dependencyType: 'finish-to-start';
}

/** A task owner (person or team). */
export interface Owner {
  id: string;
  projectId: string;
  name: string;
  contactInfo: string | null;
  /** Hex color for Gantt chart display */
  color: string;
  sortOrder: number;
}

/** A project configuration. */
export interface Project {
  id: string;
  name: string;
  includeWeekends: boolean;
}

/** A saved progress checkpoint snapshot. */
export interface Checkpoint {
  id: string;
  projectId: string;
  capturedAt: string;          // ISO timestamp from TIMESTAMPTZ
  totalWorkDays: number;
  completedWorkDays: number;
  notes: string | null;
}

/** Error thrown when the dependency graph contains a cycle. */
export class CyclicDependencyError extends Error {
  public readonly cycleTasks: string[];

  constructor(cycleTasks: string[]) {
    super(`Circular dependency detected: ${cycleTasks.join(' -> ')}`);
    this.name = 'CyclicDependencyError';
    this.cycleTasks = cycleTasks;
  }
}
