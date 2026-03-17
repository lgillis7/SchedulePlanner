# Phase 4: Progress Tracking - Research

**Researched:** 2026-03-17
**Domain:** SVG/Canvas charting for progress visualization, Supabase checkpoint persistence
**Confidence:** HIGH

## Summary

Phase 4 adds a progress plot that shows planned vs actual renovation progress over time. The core computation is straightforward: for each calendar date, sum each task's `durationDays` weighted by how much of that task should be complete by that date (planned curve), and compare against the actual `completionPct * durationDays` sum (current point). Users save manual checkpoints that accumulate into an "as-built" curve.

The project already has the `checkpoints` table in Supabase (migration `00001`), RLS policies for it (migration `00002`), and all the task data needed to compute both curves. The main implementation work is: (1) a pure computation module that derives the planned S-curve from task data, (2) a chart component to render it, and (3) query/mutation functions for checkpoint CRUD.

**Primary recommendation:** Use Recharts for the progress plot. It is the standard React charting library, works well with Next.js SSR (client component), integrates naturally with Tailwind/shadcn design tokens, and handles the line + scatter plot needed here with minimal code. No custom SVG needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROG-02 | Progress plot with time on x-axis and work-days-completed on y-axis | Recharts `LineChart` with `XAxis` (date) and `YAxis` (work-days). Pure computation function generates data points. |
| PROG-03 | Desired progress curve from each task's planned start date and duration | Computation function iterates calendar dates, accumulates `durationDays` proportionally based on each task's `effectiveStartDate` and `endDate`. Uses existing `computeSchedule` output. |
| PROG-04 | Glowing data point for current state (today's date, sum of task completion % * duration) | Recharts custom dot on scatter layer with CSS glow (`box-shadow` / SVG filter). Single computed point: `sum(task.completionPct / 100 * task.durationDays)` at today's date. |
| PROG-05 | Manual save checkpoint button | Button in header (editor-only) calls Supabase insert on `checkpoints` table. Captures `total_work_days` and `completed_work_days` at click time. |
| PROG-06 | Saved checkpoints as "as-built" curve on the plot | Query `checkpoints` table ordered by `captured_at`, plot as second `Line` on same chart. Each checkpoint is a data point: `(captured_at, completed_work_days)`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | ^2.15 | React charting library for the progress plot | Most widely used React chart library; composable, declarative API; works with SSR via 'use client'; lightweight for line/scatter charts |
| date-fns | ^4.1.0 (already installed) | Date arithmetic for curve generation | Already used throughout the project for scheduling calculations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/supabase-js | ^2.99.1 (already installed) | Checkpoint CRUD | Already used for all data persistence |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Raw SVG/Canvas | Full control but 10x more code for axes, scaling, tooltips, responsiveness |
| Recharts | Chart.js + react-chartjs-2 | Imperative API, canvas-based (no SSR), heavier bundle for this use case |
| Recharts | Nivo | More opinionated, larger bundle, unnecessary features for a simple line chart |
| Recharts | shadcn/ui charts | shadcn charts are built on Recharts anyway; using Recharts directly is cleaner |

**Installation:**
```bash
npm install recharts
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── progress/
│       └── curve-calculator.ts    # Pure functions: planned curve, actual point, as-built data
├── components/
│   └── progress/
│       └── ProgressPlot.tsx       # Recharts-based progress chart component
├── hooks/
│   └── useCheckpoints.ts          # Fetch/save checkpoints from Supabase
└── lib/supabase/
    └── queries.ts                 # Add checkpoint query/mutation functions (existing file)
```

### Pattern 1: Pure Computation Module
**What:** All curve math lives in `lib/progress/curve-calculator.ts` with zero React/UI dependencies. Takes `ComputedTask[]` and `includeWeekends` as input, returns data points.
**When to use:** Always. Keeps chart component thin, math testable.
**Example:**
```typescript
interface ProgressPoint {
  date: string;       // ISO YYYY-MM-DD
  planned: number;    // cumulative work-days that should be complete
  actual?: number;    // from checkpoint data (optional)
}

/**
 * Generate the planned (desired) S-curve.
 * For each calendar day from project start to project end:
 *   For each task, compute what fraction of its duration falls before this date,
 *   multiply by durationDays, and sum across all tasks.
 */
export function computePlannedCurve(
  tasks: ComputedTask[],
  includeWeekends: boolean
): ProgressPoint[] { ... }

/**
 * Compute today's actual progress point.
 * sum(task.completionPct / 100 * task.durationDays) for all tasks
 */
export function computeActualProgress(tasks: ComputedTask[]): number { ... }
```

### Pattern 2: Checkpoint Data Flow
**What:** Checkpoints are fetched alongside project data, passed to the chart component. The save button captures a snapshot and refetches.
**When to use:** For PROG-05 and PROG-06.
**Example:**
```typescript
// Add to queries.ts
export async function getCheckpoints(client, projectId): Promise<Checkpoint[]> { ... }
export async function createCheckpoint(client, checkpoint): Promise<Checkpoint> { ... }

// Checkpoint type in scheduling.ts
export interface Checkpoint {
  id: string;
  projectId: string;
  capturedAt: string;      // ISO timestamp
  totalWorkDays: number;
  completedWorkDays: number;
  notes: string | null;
}
```

### Pattern 3: Chart Component as Thin Wrapper
**What:** `ProgressPlot.tsx` is a 'use client' component that receives pre-computed data and renders a Recharts `ComposedChart` with: (1) `Line` for planned curve, (2) `Line` for as-built curve from checkpoints, (3) custom `Scatter` dot for today's actual progress with glow effect.
**When to use:** Always.

### Pattern 4: Editor-Only Checkpoint Button
**What:** The "Save Checkpoint" button is only visible when `isEditor` is true, matching the existing auth pattern used for Add Task, Owner Manager, etc.
**When to use:** PROG-05.

### Anti-Patterns to Avoid
- **Computing curves inside the render loop:** Put all math in `useMemo` wrapping the pure functions, not inline in JSX.
- **Auto-saving checkpoints:** Requirements explicitly say manual save via button click. Do not add timers or auto-snapshots.
- **Separate page for the progress plot:** Keep it on the same schedule page. A collapsible panel or tab is better than navigation.
- **Including parent tasks in progress calculation:** Parent tasks have rolled-up durations from children. Including both parent and child would double-count. Only include leaf tasks (tasks with no children) in the work-days sum.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart axes, scaling, responsiveness | Custom SVG with manual domain/range math | Recharts `XAxis`, `YAxis`, `ResponsiveContainer` | Edge cases: tick formatting, responsive resize, tooltip positioning |
| Date range iteration | Manual while-loop with date incrementing | date-fns `eachDayOfInterval` + `isWeekend` filter | Already in project; handles DST, leap years |
| Glowing dot effect | Complex SVG filter chains | CSS `box-shadow` on a custom Recharts dot component | Simpler, more maintainable, consistent with project's Tailwind approach |

**Key insight:** The hard part of this phase is the curve computation math, not the charting. Use Recharts to eliminate all rendering complexity and focus implementation effort on getting the planned curve calculation correct.

## Common Pitfalls

### Pitfall 1: Double-Counting Parent Tasks
**What goes wrong:** Including parent (summary) tasks in work-days totals alongside their children produces inflated numbers.
**Why it happens:** Parent tasks have `durationDays` set via roll-up from children. Summing parent + children counts the same work twice.
**How to avoid:** Filter to leaf tasks only. A leaf task is one where no other task has it as `parentTaskId`.
**Warning signs:** Total planned work-days is suspiciously high compared to the number of actual work items.

### Pitfall 2: Planned Curve Ignoring Weekend Settings
**What goes wrong:** The planned curve plots calendar days but the project uses business days, causing the curve to show work happening on weekends.
**Why it happens:** Forgetting to use the `includeWeekends` flag when iterating dates for the planned curve.
**How to avoid:** Use the same `includeWeekends` setting from the project when generating curve data points. Skip weekends in the iteration when `includeWeekends` is false.

### Pitfall 3: Checkpoint Timezone Issues
**What goes wrong:** A checkpoint saved at 11pm shows up on the next day in the plot, or timestamps from Supabase parse to wrong dates.
**Why it happens:** Supabase `TIMESTAMPTZ` stores UTC. Naive parsing without timezone handling causes date shifts.
**How to avoid:** Use `captured_at` for ordering but derive the plot x-value from the date portion only. Use `date-fns` `parseISO` which handles ISO timestamps correctly.

### Pitfall 4: Empty State Crash
**What goes wrong:** Chart component crashes when there are no tasks or no checkpoints.
**Why it happens:** Recharts needs at least one data point for domain calculation; empty arrays cause errors.
**How to avoid:** Guard with early return rendering a "No tasks yet" placeholder when `tasks.length === 0`. Render the as-built line only when `checkpoints.length > 0`.

### Pitfall 5: Checkpoint RLS Blocking Saves
**What goes wrong:** Checkpoint save fails silently or with a cryptic Supabase error.
**Why it happens:** The `checkpoints` table already has editor-only write policies from migration `00002`. The save must use the editor Supabase client (with JWT), not the anon client.
**How to avoid:** Use the same `client` memoization pattern from `ScheduleClient.tsx` that switches between `createEditorClient(token)` and `createClient()` based on auth state.

## Code Examples

### Planned Curve Calculation (core algorithm)
```typescript
// For each calendar day in the project date range:
// 1. Find all leaf tasks active on that day
// 2. For each task, compute fraction of duration completed by that date
// 3. Sum fractions * durationDays across all tasks

import { eachDayOfInterval, parseISO, format, isWeekend } from 'date-fns';

function computePlannedCurve(
  tasks: ComputedTask[],
  includeWeekends: boolean
): { date: string; planned: number }[] {
  // Filter to leaf tasks only
  const parentIds = new Set(tasks.filter(t => t.parentTaskId).map(t => t.parentTaskId!));
  // Actually we need to check which task IDs appear as parentTaskId of OTHER tasks
  const taskParentIds = new Set(tasks.map(t => t.parentTaskId).filter(Boolean));
  const leafTasks = tasks.filter(t => {
    // A task is a leaf if no other task has it as parentTaskId
    return !tasks.some(other => other.parentTaskId === t.id);
  });

  if (leafTasks.length === 0) return [];

  // Find project date range
  const allStarts = leafTasks.map(t => t.effectiveStartDate);
  const allEnds = leafTasks.map(t => t.endDate);
  const projectStart = allStarts.reduce((a, b) => a < b ? a : b);
  const projectEnd = allEnds.reduce((a, b) => a > b ? a : b);

  const days = eachDayOfInterval({
    start: parseISO(projectStart),
    end: parseISO(projectEnd),
  }).filter(d => includeWeekends || !isWeekend(d));

  return days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    let planned = 0;

    for (const task of leafTasks) {
      if (dateStr < task.effectiveStartDate) continue; // not started yet
      if (dateStr >= task.endDate) {
        planned += task.durationDays; // fully complete
      } else {
        // Partially complete: fraction of duration elapsed
        // Count working days from start to this date / total duration
        const elapsed = countWorkingDays(task.effectiveStartDate, dateStr, includeWeekends);
        planned += Math.min(elapsed, task.durationDays);
      }
    }

    return { date: dateStr, planned };
  });
}
```

### Actual Progress Point
```typescript
function computeActualProgress(tasks: ComputedTask[]): number {
  const leafTasks = tasks.filter(t => !tasks.some(o => o.parentTaskId === t.id));
  return leafTasks.reduce(
    (sum, task) => sum + (task.completionPct / 100) * task.durationDays,
    0
  );
}
```

### Recharts ProgressPlot Component (structure)
```typescript
'use client';

import {
  ComposedChart, Line, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// Custom glowing dot for the "today" actual progress point
function GlowDot(props: any) {
  const { cx, cy } = props;
  return (
    <circle
      cx={cx} cy={cy} r={8}
      fill="var(--chart-1)"
      style={{
        filter: 'drop-shadow(0 0 6px var(--chart-1))',
      }}
    />
  );
}
```

### Checkpoint Supabase Queries
```typescript
// Add to queries.ts — follows existing pattern exactly

function mapCheckpoint(row: Record<string, unknown>): Checkpoint {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    capturedAt: row.captured_at as string,
    totalWorkDays: row.total_work_days as number,
    completedWorkDays: row.completed_work_days as number,
    notes: (row.notes as string) ?? null,
  };
}

export async function getCheckpoints(
  client: SupabaseClient,
  projectId: string
): Promise<Checkpoint[]> {
  const { data, error } = await client
    .from('checkpoints')
    .select('*')
    .eq('project_id', projectId)
    .order('captured_at');
  if (error) throw new Error(`Failed to load checkpoints: ${error.message}`);
  return (data as Record<string, unknown>[]).map(mapCheckpoint);
}

export async function createCheckpoint(
  client: SupabaseClient,
  checkpoint: {
    projectId: string;
    totalWorkDays: number;
    completedWorkDays: number;
  }
): Promise<Checkpoint> {
  const { data, error } = await client
    .from('checkpoints')
    .insert({
      project_id: checkpoint.projectId,
      total_work_days: checkpoint.totalWorkDays,
      completed_work_days: checkpoint.completedWorkDays,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to save checkpoint: ${error.message}`);
  return mapCheckpoint(data as Record<string, unknown>);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js with wrapper | Recharts (composable React) | Stable since 2020+ | Declarative, SSR-friendly, smaller bundle for simple charts |
| D3 for everything | D3 for custom viz, Recharts for standard charts | Ongoing | Use the right tool; Recharts handles line/scatter without D3 complexity |

**Deprecated/outdated:**
- Victory Charts: Still maintained but less community adoption than Recharts
- react-vis (Uber): Archived/unmaintained since 2022

## Open Questions

1. **Progress plot placement in the UI**
   - What we know: The main page is a split-pane (TaskTable + GanttView) taking full viewport height
   - What's unclear: Where should the progress plot live? Options: (a) collapsible panel below the split-pane, (b) toggle/tab that swaps the Gantt view, (c) separate route
   - Recommendation: Collapsible panel below the main split-pane is simplest and keeps the Gantt visible. A toggle button in the header area (like the existing "Include weekends" control) opens/closes it. Reduces the split-pane height when open.

2. **Checkpoint deletion**
   - What we know: PROG-05 says "save" but doesn't mention delete
   - What's unclear: Should users be able to delete bad checkpoints?
   - Recommendation: Implement save only per requirements. Deletion can be added later if needed.

## Sources

### Primary (HIGH confidence)
- Project codebase: `supabase/migrations/00001_initial_schema.sql` - `checkpoints` table already exists with `total_work_days`, `completed_work_days`, `captured_at` columns
- Project codebase: `supabase/migrations/00002_auth_rls_slug.sql` - RLS policies already configured for checkpoints (public read, editor write)
- Project codebase: `src/types/scheduling.ts` - `ComputedTask` with `completionPct`, `durationDays`, `effectiveStartDate`, `endDate`
- Project codebase: `src/lib/scheduling/date-calculator.ts` - `countWorkingDays` and `addWorkingDays` utilities
- Project codebase: `src/lib/supabase/queries.ts` - Established pattern for snake_case mapping and CRUD functions

### Secondary (MEDIUM confidence)
- Recharts is the most commonly used React charting library based on npm downloads and ecosystem adoption. The `ComposedChart` component supports mixing `Line` and `Scatter` on the same chart, which is exactly what this phase needs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Recharts is well-established; all other libraries already in use
- Architecture: HIGH - Follows existing project patterns exactly; computation is pure math
- Pitfalls: HIGH - Derived from direct codebase analysis (double-counting, RLS, timezones)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain, no fast-moving dependencies)
