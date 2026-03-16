# Phase 1: Data Model + Scheduling Engine - Research

**Researched:** 2026-03-15
**Domain:** PostgreSQL schema design, dependency graph algorithms, date arithmetic, Next.js + Supabase project scaffolding
**Confidence:** HIGH

## Summary

Phase 1 builds the foundation that every subsequent phase depends on: the Supabase database schema, TypeScript type system, scheduling engine (dependency resolution + date calculation), and project scaffolding. This is a pure data and logic phase -- no Gantt visualization, no auth gate, no progress plot. The deliverable is a working Next.js app with Supabase persistence where users can create hierarchical tasks, set durations and dates, wire finish-to-start dependencies, assign owners, and see all computed dates resolve correctly.

The core technical challenge is implementing the scheduling engine correctly. The engine must: (1) model dependencies as a directed acyclic graph, (2) detect and reject circular dependencies with informative error messages, (3) perform topological sort (Kahn's BFS algorithm) to determine calculation order, and (4) execute a forward pass computing required start dates, effective start dates, and end dates -- respecting the weekend inclusion toggle. All of this is well-understood computer science with canonical algorithms. The risk is not algorithmic difficulty but implementation correctness: date arithmetic edge cases (DST transitions, off-by-one on durations, business day calculation when starting on a weekend) are where Gantt implementations silently break.

**Primary recommendation:** Build and test the scheduling engine (`lib/scheduling/`) as pure TypeScript functions with zero React dependency before building any UI. This code is the single most important artifact in the entire project -- every pixel on the Gantt chart depends on it producing correct dates.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TASK-01 | Create, edit, and delete tasks | Supabase `tasks` table with CRUD via typed query functions; Next.js Server Actions or API routes for mutations |
| TASK-02 | Organize tasks in 3-4 level hierarchy | Self-referencing `parent_task_id` foreign key on `tasks` table; `tier_depth` column (0-3) for visual formatting |
| TASK-03 | Visual tier formatting (bold, italics, font size by depth) | `tier_depth` integer drives CSS class selection; no special data model needed beyond the depth value |
| TASK-04 | Desired start date with calendar popup, defaults to today | `desired_start_date DATE DEFAULT CURRENT_DATE` column; shadcn/ui Calendar component (react-day-picker) for popup |
| TASK-05 | Duration in floating-point days | `duration_days FLOAT NOT NULL DEFAULT 1.0` column; forward pass uses this with `addBusinessDays` or `addDays` depending on weekend toggle |
| TASK-06 | Required start date calculated from upstream dependency end dates | Computed client-side by scheduling engine forward pass; `MAX(upstream end dates)` or falls back to desired start date |
| TASK-07 | End date = required start date + duration | Computed client-side; `addBusinessDays(effectiveStart, duration)` or `addDays` based on weekend toggle |
| TASK-08 | Weekend inclusion toggle (business days vs all days) | `include_weekends BOOLEAN DEFAULT false` on `projects` table; toggles which date arithmetic function the engine uses |
| DEP-01 | Finish-to-start dependencies between tasks | `task_dependencies` join table with `upstream_task_id` and `downstream_task_id`; `dependency_type` defaults to `'finish-to-start'` |
| DEP-02 | Edit dependencies by inputting task ID/line number | Each task gets a visible `sort_order` serving as line number; dependency input field accepts comma-separated numbers; resolve to task UUIDs on save |
| DEP-03 | Downstream dates auto-recalculate on upstream change | Scheduling engine runs full topological sort + forward pass after every data change; single-pass O(V+E) recalculation |
| DEP-04 | Detect and prevent circular dependencies | Kahn's algorithm: if `sorted.length < tasks.length` after BFS, cycle exists; identify cycle members (nodes with remaining in-degree > 0) and report to user |
| OWN-01 | Create, edit, and delete owners | Supabase `owners` table with CRUD; `project_id` foreign key for scoping |
| OWN-02 | Owner has name, optional contact info, and color | `name TEXT NOT NULL`, `contact_info TEXT`, `color TEXT NOT NULL DEFAULT '#3B82F6'` columns on `owners` table |
| OWN-03 | Assign owner to any task | `owner_id UUID REFERENCES owners(id) ON DELETE SET NULL` on `tasks` table; dropdown selection in task editor |
| PROG-01 | Set completion percentage (0-100%) per task | `completion_pct FLOAT DEFAULT 0.0 CHECK (completion_pct BETWEEN 0 AND 100)` on `tasks` table; simple numeric input |
| INFRA-01 | Hosted on Vercel | Next.js 16 project deploys to Vercel with zero configuration; set Supabase env vars in Vercel dashboard |
| INFRA-02 | Supabase database | Supabase CLI for local dev (`supabase init`, `supabase start`); SQL migrations in `supabase/migrations/`; push to remote with `supabase db push` |
| INFRA-03 | GitHub source control | Repository at github.com/lgillis7/SchedulePlanner; standard git workflow |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.x | Full-stack React framework | First-class Vercel deployment; App Router with Server Components for initial data fetch; Turbopack default for fast dev builds |
| TypeScript | 5.x | Type safety | Required by Next.js 16 (min 5.1); essential for typed Supabase queries and scheduling engine correctness |
| @supabase/supabase-js | ^2.99 | Database client | Official Supabase client; isomorphic (Server Components + client); typed with generated database types |
| @supabase/ssr | ^0.9 | Server-side Supabase | Cookie-based auth handling for Next.js App Router; required for proxy.ts pattern in Next.js 16 |
| date-fns | ^4.x | Date arithmetic | `addBusinessDays`, `addDays`, `isWeekend`, `isSaturday`, `isSunday` built in; tree-shakeable ESM; DST-safe date-only operations; v4 adds first-class timezone support via `@date-fns/tz` |
| Tailwind CSS | 4.2.x | Styling | Zero-config with Next.js 16; CSS-first configuration (no tailwind.config.js) |
| Zod | ^3.x | Schema validation | Validate task inputs, dependency constraints, owner data; works with Server Actions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | latest | UI components | Calendar popup (date picker), buttons, dialogs, inputs, toasts -- copy-paste model, no dependency bloat |
| react-day-picker | ^9.x | Calendar widget | Underlying calendar for shadcn/ui Calendar component; TASK-04 calendar popup |
| sonner | ^2.x | Toast notifications | Success/error feedback on CRUD operations; feedback when dependency changes cascade dates |
| lucide-react | latest | Icons | Consistent icon set for UI elements (add, delete, edit, dependencies) |
| Supabase CLI | latest | Local dev database | `supabase init` + `supabase start` for local PostgreSQL; migration authoring and testing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| date-fns | dayjs | dayjs is smaller (~2KB) but lacks built-in `addBusinessDays`; date-fns has better TypeScript support and tree-shaking |
| date-fns | Temporal API | Temporal is the future standard but still Stage 3 as of March 2026; polyfills are heavy; date-fns is production-proven |
| Self-referencing parent_task_id | Materialized path or nested sets | Overkill for 3-4 levels and <200 tasks; parent_id is simpler to query and mutate |
| Client-side computed dates | Stored computed columns in DB | Stored dates require cascading DB writes on every change; client-side is O(V+E) and <1ms for this scale |
| Kahn's BFS topological sort | DFS-based topological sort | Both are O(V+E); Kahn's naturally identifies which nodes are in a cycle (nodes with remaining in-degree > 0) making error messages better |

**Installation:**
```bash
# Initialize Next.js 16 project
npx create-next-app@latest schedule-planner --ts --tailwind --app --turbopack

# Database client
npm install @supabase/supabase-js @supabase/ssr

# Date arithmetic + validation
npm install date-fns zod

# UI components
npx shadcn@latest init
npx shadcn@latest add button dialog popover calendar input label select

# Toast notifications + icons
npm install sonner lucide-react

# Dev tooling
npm install -D supabase prettier prettier-plugin-tailwindcss
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root layout (fonts, Tailwind, providers)
│   ├── page.tsx                 # Project view (single project for Phase 1)
│   └── api/                     # API routes (if not using Server Actions)
├── components/                  # UI components
│   ├── task-list/               # Hierarchical task table
│   │   ├── TaskTable.tsx        # Table container with hierarchy rendering
│   │   ├── TaskRow.tsx          # Single task row (tier-formatted)
│   │   └── TaskEditor.tsx       # Inline or panel editing for task properties
│   ├── owners/                  # Owner management
│   │   └── OwnerManager.tsx     # CRUD for owners (name, contact, color)
│   └── ui/                      # shadcn/ui components (generated)
├── lib/                         # Business logic (NO React dependency)
│   ├── scheduling/              # THE CORE ENGINE
│   │   ├── dependency-graph.ts  # DAG construction, topological sort, cycle detection
│   │   ├── date-calculator.ts   # addBusinessDays, addCalendarDays, WorkCalendar
│   │   ├── scheduler.ts        # Orchestrates: raw tasks + deps → computed schedule
│   │   └── validators.ts       # Cycle detection, constraint checks, input validation
│   ├── supabase/                # Database access
│   │   ├── client.ts            # Browser Supabase client
│   │   ├── server.ts            # Server Component Supabase client
│   │   └── queries.ts           # Typed query functions for all CRUD
│   └── utils/                   # Shared utilities
│       └── formatting.ts        # Date display formatting, tier labels
├── hooks/                       # React hooks
│   ├── useProject.ts            # Load project + tasks + deps + owners
│   └── useSchedule.ts           # Wraps scheduling engine in useMemo
├── types/                       # TypeScript types
│   ├── database.ts              # Generated Supabase types (supabase gen types)
│   └── scheduling.ts            # Domain types: RawTask, ComputedTask, Dependency, Owner
supabase/
├── config.toml                  # Supabase CLI config
├── migrations/                  # SQL migration files
│   └── 00001_initial_schema.sql # Tables: projects, tasks, owners, task_dependencies, checkpoints
└── seed.sql                     # Optional: sample renovation data for testing
```

### Pattern 1: Client-Side Scheduling Engine

**What:** All date calculations and dependency resolution happen in the browser. The database stores only raw input data (desired_start_date, duration_days, dependencies). Computed fields (required_start_date, effective_start_date, end_date) are derived on every state change.

**When to use:** Always. This is the correct approach for <500 tasks.

**Why:** Avoids cascading database writes. A single task edit can affect dozens of downstream dates. Computing client-side means one DB write (the edit) and one in-memory recalculation (<1ms), instead of N DB writes for N affected tasks.

```typescript
// lib/scheduling/scheduler.ts
import { topologicalSort, detectCycle } from './dependency-graph';
import { addWorkingDays } from './date-calculator';
import type { RawTask, ComputedTask, Dependency } from '@/types/scheduling';

export function computeSchedule(
  tasks: RawTask[],
  dependencies: Dependency[],
  includeWeekends: boolean
): ComputedTask[] {
  // 1. Cycle check (throws with cycle info if found)
  const cycle = detectCycle(tasks, dependencies);
  if (cycle) {
    throw new CyclicDependencyError(cycle);
  }

  // 2. Topological sort
  const sorted = topologicalSort(tasks, dependencies);

  // 3. Forward pass: compute dates in dependency order
  return forwardPass(sorted, dependencies, includeWeekends);
}
```

### Pattern 2: Kahn's BFS Topological Sort with Cycle Reporting

**What:** Build adjacency list and in-degree map from dependencies. Process nodes with in-degree 0 first (no upstream dependencies). When done, any remaining nodes are in a cycle.

**When to use:** Before every schedule recalculation.

**Why Kahn's over DFS:** Kahn's naturally identifies which specific nodes are in the cycle (they remain with in-degree > 0), enabling a user-facing error message like "Circular dependency detected: Plumbing Rough-in -> Drywall -> Plumbing Rough-in".

```typescript
// lib/scheduling/dependency-graph.ts
export function topologicalSort(
  tasks: RawTask[],
  deps: Dependency[]
): RawTask[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }

  for (const dep of deps) {
    adjacency.get(dep.upstreamTaskId)!.push(dep.downstreamTaskId);
    inDegree.set(
      dep.downstreamTaskId,
      (inDegree.get(dep.downstreamTaskId) ?? 0) + 1
    );
  }

  const queue: string[] = [];
  for (const [taskId, degree] of inDegree) {
    if (degree === 0) queue.push(taskId);
  }

  const sorted: RawTask[] = [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(taskMap.get(current)!);
    for (const downstream of adjacency.get(current) ?? []) {
      const newDegree = inDegree.get(downstream)! - 1;
      inDegree.set(downstream, newDegree);
      if (newDegree === 0) queue.push(downstream);
    }
  }

  if (sorted.length < tasks.length) {
    // Nodes still with in-degree > 0 are in a cycle
    const cycleNodes = tasks.filter(t => !sorted.includes(t));
    throw new CyclicDependencyError(cycleNodes.map(t => t.title));
  }

  return sorted;
}
```

### Pattern 3: Forward Pass Date Calculation with WorkCalendar

**What:** After topological sort, iterate through tasks in order. For each task, required start date = MAX(all upstream end dates). Effective start = MAX(required, desired). End date = effective start + duration (respecting weekend toggle).

**When to use:** After every data change that affects dates, durations, or dependencies.

```typescript
// lib/scheduling/date-calculator.ts
import { addBusinessDays, addDays } from 'date-fns';

export function addWorkingDays(
  start: Date,
  days: number,
  includeWeekends: boolean
): Date {
  if (includeWeekends) {
    return addDays(start, Math.ceil(days));
  }
  return addBusinessDays(start, Math.ceil(days));
}

// lib/scheduling/scheduler.ts
function forwardPass(
  sortedTasks: RawTask[],
  deps: Dependency[],
  includeWeekends: boolean
): ComputedTask[] {
  const endDates = new Map<string, Date>();

  // Build upstream lookup: taskId -> [upstream task IDs]
  const upstreamMap = new Map<string, string[]>();
  for (const dep of deps) {
    if (!upstreamMap.has(dep.downstreamTaskId)) {
      upstreamMap.set(dep.downstreamTaskId, []);
    }
    upstreamMap.get(dep.downstreamTaskId)!.push(dep.upstreamTaskId);
  }

  return sortedTasks.map(task => {
    const upstreamIds = upstreamMap.get(task.id) ?? [];

    // Required start = latest upstream end date
    let requiredStartDate = task.desiredStartDate;
    if (upstreamIds.length > 0) {
      const latestEnd = upstreamIds
        .map(id => endDates.get(id)!)
        .reduce((a, b) => (a > b ? a : b));
      requiredStartDate = latestEnd;
    }

    // Effective start = later of required and desired
    const effectiveStartDate =
      requiredStartDate > task.desiredStartDate
        ? requiredStartDate
        : task.desiredStartDate;

    const endDate = addWorkingDays(
      effectiveStartDate,
      task.durationDays,
      includeWeekends
    );
    endDates.set(task.id, endDate);

    return {
      ...task,
      requiredStartDate,
      effectiveStartDate,
      endDate,
    };
  });
}
```

### Pattern 4: Supabase Type Generation and Typed Queries

**What:** Generate TypeScript types from the Supabase schema, then build typed query functions that all components use. Never call Supabase directly from components.

**When to use:** Always. Set up in Phase 1 and maintained via `supabase gen types` after every migration.

```bash
# Generate types from local database
npx supabase gen types typescript --local > src/types/database.ts

# Or from remote project
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

```typescript
// lib/supabase/queries.ts
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type TypedClient = SupabaseClient<Database>;

export async function getProjectWithData(client: TypedClient, projectId: string) {
  const [project, tasks, dependencies, owners] = await Promise.all([
    client.from('projects').select('*').eq('id', projectId).single(),
    client.from('tasks').select('*').eq('project_id', projectId).order('sort_order'),
    client.from('task_dependencies').select('*').eq('project_id', projectId),
    client.from('owners').select('*').eq('project_id', projectId).order('sort_order'),
  ]);
  return { project, tasks, dependencies, owners };
}
```

### Anti-Patterns to Avoid

- **Storing computed dates in the database:** Causes cascading writes, race conditions, and stale data. Compute all derived dates client-side.
- **Reactive per-task dependency watching:** Each task watching its predecessors causes O(n^2) recalculation storms. Use single-pass topological sort instead.
- **Using JavaScript `Date` constructors for date-only arithmetic:** Causes DST drift. Use date-fns functions that operate on date values, and store dates as ISO strings (`YYYY-MM-DD`).
- **Calling Supabase directly from components:** Scatters database logic, makes refactoring painful. Centralize all queries in `lib/supabase/queries.ts`.
- **Building full Supabase Auth for a passcode:** Over-engineering. The passcode is a simple write gate, not an identity system. (Auth is Phase 3, but the schema should not include Supabase Auth tables.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Business day arithmetic | Custom weekend-skipping loop | `date-fns/addBusinessDays` | [Bug history](https://github.com/date-fns/date-fns/issues/1584): weekend start date edge case took multiple PRs to fix correctly; date-fns has it solved since v2.15.0+ |
| Topological sort | Custom recursive sort | Kahn's BFS algorithm (implement yourself -- it's 30 lines) | The algorithm is simple enough to implement; npm packages like `toposort` exist but add a dependency for trivial code |
| UUID generation | Custom ID scheme | PostgreSQL `gen_random_uuid()` | Database-native, no client-side generation needed for server mutations |
| Date formatting | String concatenation | `date-fns/format` | Locale-aware, handles edge cases, tree-shakeable |
| Form validation | Manual if/else chains | Zod schemas | Composable, type-safe, works with Server Actions, generates TypeScript types |
| Type generation | Manual TypeScript interfaces | `supabase gen types typescript` | Auto-generated from schema; stays in sync with migrations |
| Calendar popup | Custom date picker | shadcn/ui Calendar (react-day-picker) | Accessible, keyboard-navigable, customizable with Tailwind |

**Key insight:** The scheduling engine (topological sort + forward pass) is simple enough to implement directly -- it's canonical computer science, not a library problem. Date arithmetic is deceptively complex and should use date-fns. Everything else (types, validation, UI components) has well-maintained tooling.

## Common Pitfalls

### Pitfall 1: Circular Dependencies Not Detected Before Date Calculation

**What goes wrong:** User creates Task A -> B -> C -> A. Without cycle detection, the scheduling engine enters an infinite loop or produces garbage dates. This is the most common Gantt implementation bug.
**Why it happens:** Developers implement dependency resolution as recursive date propagation without first validating the graph structure.
**How to avoid:** Run Kahn's topological sort before every recalculation. If `sorted.length < tasks.length`, a cycle exists. Reject the dependency that would create the cycle before persisting it. Show the user which tasks form the loop.
**Warning signs:** Browser tab hangs during recalculation; "Maximum call stack exceeded" errors; dates far in the future or past.

### Pitfall 2: Date Arithmetic Edge Cases (DST, Weekend Start, Off-by-One)

**What goes wrong:** Three interrelated bugs:
1. A task starting Friday with 1 business day duration -- does it end Friday or Monday?
2. `addBusinessDays` called with a Saturday start date historically returned wrong results (fixed in date-fns 2.15.0+, carried forward to v4).
3. DST transition causes dates to shift by one day when using timestamp-based arithmetic.

**Why it happens:** JavaScript `Date` objects represent instants in time, not calendar dates. Adding milliseconds near DST boundaries shifts the wall-clock time, which can flip the calendar date.
**How to avoid:** Store all dates as ISO date strings (`YYYY-MM-DD`), never as timestamps. Use `date-fns` for all arithmetic (it operates on date values, not milliseconds). Define the duration convention explicitly: "a task with duration N occupies N working periods." Write unit tests covering: Friday + 1 business day, Saturday start + N days, DST transition dates (March/November in US), zero-duration tasks.
**Warning signs:** Tasks near DST transitions show wrong dates; weekend toggle changes dates by wrong amounts; end dates differ between display and calculation.

### Pitfall 3: Cascade Recalculation Storms (O(n^2) on Every Edit)

**What goes wrong:** Changing one task's duration triggers recalculation of its downstream dependents. Each recalculation triggers more recalculations. The UI freezes while dates cascade.
**Why it happens:** Naive reactive state where each task watches its predecessors. A single edit causes N state updates, each triggering re-renders.
**How to avoid:** Implement recalculation as a single synchronous pass: topological sort all tasks, walk the sorted list once computing dates, produce one state update, trigger one React render. Debounce recalculation during active typing (recalculate on blur or after 300ms idle).
**Warning signs:** UI freezes for 100ms+ after editing a task; React Profiler shows cascading re-renders; multiple Supabase writes for a single user edit.

### Pitfall 4: Supabase RLS Disabled on Tables

**What goes wrong:** Tables created without RLS enabled are publicly readable and writable by anyone with the Supabase anon key. Even though auth is Phase 3, creating tables without RLS in Phase 1 means data is exposed from the moment the app is deployed.
**Why it happens:** RLS is opt-in in Supabase. `CREATE TABLE` does not enable it by default.
**How to avoid:** Enable RLS on every table in the migration that creates it. For Phase 1, use permissive policies (allow all reads and writes) -- the actual passcode enforcement comes in Phase 3. But the RLS infrastructure must exist from day one so Phase 3 is a policy change, not a retroactive security addition.
**Warning signs:** Supabase dashboard shows "RLS Disabled" badge on tables; browser console Supabase inserts succeed without any auth.

### Pitfall 5: Floating-Point Duration Producing Fractional Days

**What goes wrong:** A task with duration 0.5 days produces a fractional result when added to a date. `addBusinessDays(monday, 0.5)` might return Monday (rounded down) when the user expects a half-day task to end on Monday afternoon.
**Why it happens:** `addBusinessDays` works in whole-day increments. Fractional days need special handling.
**How to avoid:** Define the convention: fractional durations are for display and progress calculation (0.5 days = 4 hours of work). For date arithmetic, ceil fractional durations to whole days. A 0.5-day task starting Monday ends Monday (occupies 1 calendar day). Document this convention in code comments and user-facing help text.
**Warning signs:** Half-day tasks show zero-width bars on the Gantt chart; end date equals start date for fractional durations.

## Code Examples

### Database Migration (Initial Schema)

```sql
-- supabase/migrations/00001_initial_schema.sql

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  include_weekends BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- Phase 1: permissive policies (tightened in Phase 3)
CREATE POLICY "Allow all access to projects" ON projects FOR ALL USING (true) WITH CHECK (true);

-- Owners (contractors/specialists)
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  contact_info TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to owners" ON owners FOR ALL USING (true) WITH CHECK (true);

-- Tasks (hierarchical, up to 4 levels)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  tier_depth INTEGER NOT NULL DEFAULT 0 CHECK (tier_depth BETWEEN 0 AND 3),
  sort_order INTEGER NOT NULL DEFAULT 0,
  desired_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_days FLOAT NOT NULL DEFAULT 1.0 CHECK (duration_days > 0),
  completion_pct FLOAT DEFAULT 0.0 CHECK (completion_pct BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- Task Dependencies (join table, finish-to-start)
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  upstream_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  downstream_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  dependency_type TEXT DEFAULT 'finish-to-start',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(upstream_task_id, downstream_task_id),
  CHECK (upstream_task_id != downstream_task_id)
);
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to task_dependencies" ON task_dependencies FOR ALL USING (true) WITH CHECK (true);

-- Checkpoints (manual progress snapshots -- used in Phase 4, schema established now)
CREATE TABLE checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT now(),
  total_work_days FLOAT NOT NULL,
  completed_work_days FLOAT NOT NULL,
  notes TEXT
);
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to checkpoints" ON checkpoints FOR ALL USING (true) WITH CHECK (true);

-- Indexes for common query patterns
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_sort_order ON tasks(project_id, sort_order);
CREATE INDEX idx_owners_project_id ON owners(project_id);
CREATE INDEX idx_deps_project_id ON task_dependencies(project_id);
CREATE INDEX idx_deps_upstream ON task_dependencies(upstream_task_id);
CREATE INDEX idx_deps_downstream ON task_dependencies(downstream_task_id);
```

### TypeScript Domain Types

```typescript
// types/scheduling.ts

export interface RawTask {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  ownerId: string | null;
  title: string;
  tierDepth: number; // 0-3
  sortOrder: number;
  desiredStartDate: string; // ISO date 'YYYY-MM-DD'
  durationDays: number;
  completionPct: number;
  notes: string | null;
}

export interface ComputedTask extends RawTask {
  requiredStartDate: string;   // from upstream deps, or desiredStartDate
  effectiveStartDate: string;  // max(required, desired)
  endDate: string;             // effective + duration
}

export interface Dependency {
  id: string;
  projectId: string;
  upstreamTaskId: string;
  downstreamTaskId: string;
  dependencyType: 'finish-to-start';
}

export interface Owner {
  id: string;
  projectId: string;
  name: string;
  contactInfo: string | null;
  color: string;
  sortOrder: number;
}

export interface Project {
  id: string;
  name: string;
  includeWeekends: boolean;
}

export class CyclicDependencyError extends Error {
  constructor(public cycleTasks: string[]) {
    super(`Circular dependency detected: ${cycleTasks.join(' -> ')}`);
    this.name = 'CyclicDependencyError';
  }
}
```

### useSchedule Hook

```typescript
// hooks/useSchedule.ts
import { useMemo } from 'react';
import { computeSchedule } from '@/lib/scheduling/scheduler';
import type { RawTask, ComputedTask, Dependency } from '@/types/scheduling';

export function useSchedule(
  tasks: RawTask[],
  dependencies: Dependency[],
  includeWeekends: boolean
): { schedule: ComputedTask[]; error: Error | null } {
  return useMemo(() => {
    try {
      const schedule = computeSchedule(tasks, dependencies, includeWeekends);
      return { schedule, error: null };
    } catch (err) {
      return { schedule: [], error: err as Error };
    }
  }, [tasks, dependencies, includeWeekends]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` for auth checks | `proxy.ts` in Next.js 16 | Oct 2025 (Next.js 16) | Middleware still works but is deprecated; new projects should use proxy.ts |
| `tailwind.config.js` | CSS-first config (`@theme` in CSS) | Jan 2025 (Tailwind 4.0) | No JS config file; all customization in CSS |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers is deprecated; @supabase/ssr is the official replacement |
| `date-fns` v3 | `date-fns` v4 | Sep 2024 | v4 adds first-class timezone support via `@date-fns/tz`; minimal breaking changes (type-level only) |
| Manual Supabase types | `supabase gen types typescript` | 2023+ | Auto-generated types from schema; stays in sync with migrations |

**Deprecated/outdated:**
- `moment.js`: Maintenance mode, 300KB+ bundle. Use date-fns.
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`.
- `tailwind.config.js`: Tailwind 4 uses CSS-first configuration.
- `next lint`: Removed in Next.js 16. Use ESLint directly with `@next/eslint-plugin-next`.

## Open Questions

1. **Fractional duration convention**
   - What we know: `duration_days` is a float (TASK-05). `addBusinessDays` works in whole days.
   - What's unclear: Should 0.5 days occupy 0 calendar days (same start and end) or 1 calendar day? How should fractional durations interact with the weekend toggle?
   - Recommendation: Ceil to whole days for date arithmetic. A 0.5-day task starting Monday ends Monday (occupies 1 day). Display fractional duration for progress calculation purposes. Document the convention clearly.

2. **Task ordering for dependency editing by line number (DEP-02)**
   - What we know: Users enter dependencies as comma-separated line numbers. Tasks need a stable, visible line number.
   - What's unclear: Does the line number correspond to `sort_order` or to visual position (which changes when hierarchy is collapsed)?
   - Recommendation: Use `sort_order` as the stable line number. Display it in the leftmost column. It does not change when tasks are collapsed/expanded. Persist it in the database.

3. **Single project vs. multi-project in Phase 1**
   - What we know: REQUIREMENTS.md has multi-project as v2 (PROJ-01, PROJ-02). The schema includes `project_id` on all tables.
   - What's unclear: Should Phase 1 build a project selector UI, or hardcode a single default project?
   - Recommendation: Schema supports multi-project (it's just a foreign key). Phase 1 UI creates one default project on first visit. No project selector -- that's a future phase. The schema is ready for multi-project without any migration changes.

## Sources

### Primary (HIGH confidence)
- [date-fns v4.0 release blog](https://blog.date-fns.org/v40-with-time-zone-support/) - v4 changes, timezone support, ESM-first
- [date-fns addBusinessDays issue #1584](https://github.com/date-fns/date-fns/issues/1584) - Weekend start date bug history, fix in v2.15.0+
- [date-fns migration v3 to v4](https://deepwiki.com/date-fns/date-fns/1.2-migration-from-v3-to-v4) - Breaking changes are type-level only
- [Supabase Database Migrations docs](https://supabase.com/docs/guides/deployment/database-migrations) - SQL-first migration workflow
- [Supabase TypeScript type generation](https://supabase.com/docs/guides/api/rest/generating-types) - `supabase gen types typescript` command
- [Supabase CLI getting started](https://supabase.com/docs/guides/local-development/cli/getting-started) - Local dev setup
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) - RLS policy syntax
- [Topological Sorting - Wikipedia](https://en.wikipedia.org/wiki/Topological_sorting) - Kahn's algorithm canonical reference
- [Kahn's algorithm for cycle detection](https://gaultier.github.io/blog/kahns_algorithm.html) - Cycle detection as natural byproduct of BFS topological sort
- [Topological Sort BFS - GeeksforGeeks](https://www.geeksforgeeks.org/dsa/topological-sorting-indegree-based-solution/) - Kahn's algorithm implementation reference

### Secondary (MEDIUM confidence)
- [MakerKit: Database migrations in Next.js Supabase](https://makerkit.dev/docs/next-supabase-turbo/development/migrations) - Migration workflow patterns
- [Supabase TypeScript support docs](https://supabase.com/docs/reference/javascript/typescript-support) - Type inference with supabase-js v2.48.0+
- [Use Supabase with Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) - Official integration guide

### Tertiary (LOW confidence)
- None -- all Phase 1 topics are well-documented with canonical algorithm references and official library docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs, release notes, and npm. Versions confirmed current.
- Architecture: HIGH - Client-side scheduling engine with topological sort + forward pass is the canonical approach, well-documented in algorithm textbooks and Gantt library implementations.
- Pitfalls: HIGH - Circular dependency, DST, and business day edge cases are extensively documented in open-source Gantt chart issue trackers (frappe/gantt #110, date-fns #1584).
- Database schema: HIGH - Self-referencing parent_task_id for hierarchy and join table for dependencies are standard PostgreSQL patterns.

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (30 days -- stable domain, canonical algorithms)
