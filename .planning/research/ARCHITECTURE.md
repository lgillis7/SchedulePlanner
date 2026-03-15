# Architecture Research

**Domain:** Web-based Gantt chart / project scheduling tool
**Researched:** 2026-03-15
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Gantt Chart  │  │  Task List   │  │  Progress Plot       │  │
│  │  (Canvas/SVG) │  │  (Table)     │  │  (Chart)             │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
├─────────┴─────────────────┴──────────────────────┴──────────────┤
│                    Scheduling Engine (Client)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Dependency   │  │  Date        │  │  Critical Path       │  │
│  │  Graph (DAG)  │  │  Calculator  │  │  (Optional)          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      State Management                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Project State (tasks, dependencies, owners, checkpoints) │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      Data Access Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Next.js API  │  │  Supabase    │  │  Passcode Gate       │  │
│  │  Routes       │  │  Client      │  │  (Middleware)         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      Persistence (Supabase)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ projects │  │  tasks   │  │  owners  │  │ checkpoints  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Gantt Chart View | Renders timeline bars, dependency arrows, drag interactions | SVG or Canvas element with virtual viewport for scrolling |
| Task List View | Hierarchical table of tasks with inline editing | React table component with indentation by tier depth |
| Progress Plot | Time vs. work-days-completed chart with desired/actual curves | Lightweight charting (recharts or similar) |
| Scheduling Engine | Resolves dependency graph, calculates required start/end dates | Topological sort + forward pass date calculation |
| Date Calculator | Handles business days vs. calendar days, duration math | Utility functions using date-fns |
| State Management | Single source of truth for all project data in memory | React state (useState/useReducer) or Zustand store |
| Passcode Gate | Protects edit routes; read-only requires no auth | Next.js middleware checking cookie/session |
| Supabase Client | CRUD operations for all entities | @supabase/ssr with server and client instances |

## Core Data Model

This is the heart of the system. Get this right and everything else follows.

### Entity Relationship

```
projects
  │
  ├── owners (many)
  │
  ├── tasks (many, self-referencing hierarchy)
  │     │
  │     ├── parent_task_id → tasks (nullable, for hierarchy)
  │     │
  │     └── dependencies (many-to-many via task_dependencies)
  │           ├── upstream_task_id → tasks
  │           └── downstream_task_id → tasks
  │
  └── checkpoints (many, manual snapshots)
```

### Schema Design

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  passcode_hash TEXT NOT NULL,       -- bcrypt hash of edit passcode
  include_weekends BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Owners (contractors/specialists)
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_info TEXT,                  -- optional phone/email
  color TEXT NOT NULL DEFAULT '#3B82F6',  -- hex color for Gantt bars
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks (hierarchical, up to 4 levels)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  tier_depth INTEGER NOT NULL DEFAULT 0,  -- 0=top, 1, 2, 3
  sort_order INTEGER NOT NULL DEFAULT 0,  -- ordering within parent
  desired_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_days FLOAT NOT NULL DEFAULT 1.0,
  completion_pct FLOAT DEFAULT 0.0 CHECK (completion_pct BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Computed fields (NOT stored, calculated client-side):
--   required_start_date: MAX(upstream dependency end dates) or desired_start_date
--   effective_start_date: MAX(required_start_date, desired_start_date)
--   end_date: effective_start_date + duration_days (respecting weekend toggle)

-- Task Dependencies (join table)
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  upstream_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  downstream_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'finish-to-start',  -- only FS needed for renovation
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(upstream_task_id, downstream_task_id)
);

-- Progress Checkpoints (manual snapshots)
CREATE TABLE checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ DEFAULT now(),
  total_work_days FLOAT NOT NULL,         -- sum of all task durations
  completed_work_days FLOAT NOT NULL,     -- sum of (duration * completion_pct / 100)
  notes TEXT
);
```

### Why This Schema

- **Hierarchy via `parent_task_id`**: Self-referencing foreign key is the simplest pattern for 3-4 levels of nesting. No need for materialized path or nested sets at this scale.
- **Dependencies as join table**: Many-to-many relationship between tasks. A task can have multiple upstream dependencies. The `dependency_type` column exists for future flexibility but defaults to finish-to-start (the only type needed for construction scheduling).
- **Computed dates on the client**: Required start date and end date are NOT stored in the database. They are calculated by the scheduling engine on the client after loading all tasks and dependencies. This avoids cascading database updates whenever one task changes.
- **Checkpoints are snapshots**: Each checkpoint captures total vs. completed work-days at a moment in time. This is simple and sufficient for the progress plot.

## Recommended Project Structure

```
src/
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing / project selector
│   ├── [projectId]/             # Project routes (dynamic)
│   │   ├── layout.tsx           # Project layout (loads project data)
│   │   ├── page.tsx             # Main Gantt view (read-only default)
│   │   ├── edit/                # Edit mode (passcode-gated)
│   │   │   └── page.tsx
│   │   └── progress/            # Progress plot view
│   │       └── page.tsx
│   └── api/                     # API routes
│       ├── projects/
│       ├── tasks/
│       ├── dependencies/
│       ├── owners/
│       └── checkpoints/
├── components/                  # UI components
│   ├── gantt/                   # Gantt chart rendering
│   │   ├── GanttChart.tsx       # Main chart container
│   │   ├── GanttBar.tsx         # Individual task bar
│   │   ├── GanttTimeline.tsx    # Date header/grid
│   │   ├── DependencyArrow.tsx  # Arrow between bars
│   │   └── GanttDragHandle.tsx  # Drag interaction (future)
│   ├── task-list/               # Left-side task table
│   │   ├── TaskTable.tsx        # Table container
│   │   ├── TaskRow.tsx          # Single task row
│   │   └── TaskEditor.tsx       # Inline editing
│   ├── progress/                # Progress plot
│   │   └── ProgressChart.tsx
│   ├── owners/                  # Owner management
│   │   └── OwnerManager.tsx
│   └── auth/                    # Passcode gate
│       └── PasscodeGate.tsx
├── lib/                         # Business logic
│   ├── scheduling/              # THE CORE ENGINE
│   │   ├── dependency-graph.ts  # DAG construction + topological sort
│   │   ├── date-calculator.ts   # Date math (business days, durations)
│   │   ├── scheduler.ts         # Orchestrates graph + dates → computed fields
│   │   └── validators.ts        # Cycle detection, constraint checks
│   ├── supabase/                # Database access
│   │   ├── client.ts            # Browser client
│   │   ├── server.ts            # Server client
│   │   └── queries.ts           # Typed query functions
│   └── utils/                   # Shared utilities
│       ├── colors.ts            # Owner color logic
│       └── formatting.ts        # Date/number formatting
├── hooks/                       # React hooks
│   ├── useProject.ts            # Project data loading
│   ├── useSchedule.ts           # Computed schedule (uses scheduling engine)
│   └── usePasscode.ts           # Passcode state
└── types/                       # TypeScript types
    ├── database.ts              # Supabase generated types
    └── scheduling.ts            # Domain types (Task, Dependency, etc.)
```

### Structure Rationale

- **`lib/scheduling/`**: This is the most important code in the project. Separating the scheduling engine from UI components makes it testable, reusable, and the single source of truth for date calculations.
- **`components/gantt/`**: Gantt rendering is complex enough to warrant its own directory. Each sub-component has a clear, single responsibility.
- **`app/[projectId]/`**: Dynamic routing per project. The read-only view is the default; edit mode is a separate route behind the passcode gate.
- **`hooks/`**: Custom hooks bridge the scheduling engine to React components. `useSchedule` is the key hook that takes raw tasks/dependencies and returns computed schedule data.

## Architectural Patterns

### Pattern 1: Client-Side Scheduling Engine

**What:** All date calculations and dependency resolution happen in the browser, not the database or server. The database stores only raw input data (desired start date, duration, dependencies). Computed fields (required start date, effective start date, end date) are derived on every render.

**When to use:** Always. This is the correct approach for a Gantt chart with <500 tasks.

**Trade-offs:** Slightly more client CPU usage, but avoids cascading database writes and keeps the data model clean.

**Example:**
```typescript
// lib/scheduling/scheduler.ts
interface RawTask {
  id: string;
  parentTaskId: string | null;
  desiredStartDate: Date;
  durationDays: number;
  completionPct: number;
}

interface ComputedTask extends RawTask {
  requiredStartDate: Date;   // from upstream dependencies
  effectiveStartDate: Date;  // max(required, desired)
  endDate: Date;             // effective + duration
}

function computeSchedule(
  tasks: RawTask[],
  dependencies: Dependency[],
  includeWeekends: boolean
): ComputedTask[] {
  const sorted = topologicalSort(tasks, dependencies);
  return forwardPass(sorted, dependencies, includeWeekends);
}
```

### Pattern 2: Topological Sort for Dependency Resolution

**What:** Build a Directed Acyclic Graph (DAG) from task dependencies, then process tasks in topological order so that every task is computed after all its upstream dependencies.

**When to use:** Every time the schedule needs recalculation (task edit, dependency change).

**Trade-offs:** O(V+E) time complexity -- trivial for hundreds of tasks. Must detect cycles to prevent infinite loops.

**Algorithm (Kahn's BFS-based -- recommended for this project):**
```typescript
// lib/scheduling/dependency-graph.ts
function topologicalSort(tasks: RawTask[], deps: Dependency[]): RawTask[] {
  // Build adjacency list and in-degree map
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }

  for (const dep of deps) {
    adjacency.get(dep.upstreamTaskId)!.push(dep.downstreamTaskId);
    inDegree.set(dep.downstreamTaskId, (inDegree.get(dep.downstreamTaskId) ?? 0) + 1);
  }

  // Start with tasks that have no upstream dependencies
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
      inDegree.set(downstream, inDegree.get(downstream)! - 1);
      if (inDegree.get(downstream) === 0) {
        queue.push(downstream);
      }
    }
  }

  // Cycle detection: if sorted.length < tasks.length, there is a cycle
  if (sorted.length < tasks.length) {
    throw new Error('Circular dependency detected');
  }

  return sorted;
}
```

### Pattern 3: Forward Pass Date Calculation

**What:** After topological sort, iterate through tasks in order. For each task, its required start date is the latest end date of all upstream dependencies. Its effective start date is the later of required and desired. Its end date is effective start + duration (accounting for weekends).

**When to use:** After every data change.

**Example:**
```typescript
// lib/scheduling/date-calculator.ts
function addBusinessDays(start: Date, days: number): Date {
  let current = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    current.setDate(current.getDate() + 1);
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return current;
}

function addCalendarDays(start: Date, days: number): Date {
  const result = new Date(start);
  result.setDate(result.getDate() + Math.ceil(days));
  return result;
}

// lib/scheduling/scheduler.ts
function forwardPass(
  sortedTasks: RawTask[],
  deps: Dependency[],
  includeWeekends: boolean
): ComputedTask[] {
  const endDates = new Map<string, Date>();
  const addDays = includeWeekends ? addCalendarDays : addBusinessDays;

  // Build reverse lookup: for each task, its upstream task IDs
  const upstreamMap = new Map<string, string[]>();
  for (const dep of deps) {
    if (!upstreamMap.has(dep.downstreamTaskId)) {
      upstreamMap.set(dep.downstreamTaskId, []);
    }
    upstreamMap.get(dep.downstreamTaskId)!.push(dep.upstreamTaskId);
  }

  return sortedTasks.map(task => {
    const upstreamIds = upstreamMap.get(task.id) ?? [];

    // Required start = latest end date of all upstream tasks
    let requiredStartDate = task.desiredStartDate;
    if (upstreamIds.length > 0) {
      const latestUpstreamEnd = upstreamIds
        .map(id => endDates.get(id)!)
        .reduce((a, b) => a > b ? a : b);
      requiredStartDate = latestUpstreamEnd;
    }

    const effectiveStartDate = requiredStartDate > task.desiredStartDate
      ? requiredStartDate
      : task.desiredStartDate;

    const endDate = addDays(effectiveStartDate, task.durationDays);
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

### Pattern 4: Passcode Gate via Next.js Middleware

**What:** A simple middleware that checks for a passcode cookie on edit routes. Read-only routes are unprotected. The passcode is verified against a bcrypt hash stored in the project record.

**When to use:** For the `/[projectId]/edit` routes only.

**Trade-offs:** Not real auth -- anyone with the passcode can edit. This is by design for a household tool.

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Only gate /[projectId]/edit routes
  if (request.nextUrl.pathname.match(/^\/[^/]+\/edit/)) {
    const passcodeToken = request.cookies.get('edit_token');
    if (!passcodeToken) {
      // Redirect to passcode entry
      const url = request.nextUrl.clone();
      url.pathname = url.pathname.replace('/edit', '');
      url.searchParams.set('auth', 'required');
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}
```

## Data Flow

### Schedule Calculation Flow

```
[User edits task/dependency]
    |
    v
[React state update (raw data)]
    |
    v
[useSchedule hook triggers recalculation]
    |
    v
[topologicalSort(tasks, dependencies)]
    |
    v
[forwardPass(sortedTasks, deps, weekendToggle)]
    |
    v
[ComputedTask[] with all dates resolved]
    |
    v
[Gantt Chart re-renders]     [Task List updates]
    |
    v
[Debounced save to Supabase]
```

### Data Loading Flow

```
[Page load: /[projectId]]
    |
    v
[Server Component fetches project + tasks + deps + owners]
    |
    v
[Pass to Client Component as initial props]
    |
    v
[Client runs computeSchedule() for derived dates]
    |
    v
[Render Gantt + Task List with computed data]
```

### Checkpoint Flow

```
[User clicks "Save Checkpoint"]
    |
    v
[Calculate: totalWorkDays = sum(task.durationDays)]
[Calculate: completedWorkDays = sum(task.durationDays * task.completionPct / 100)]
    |
    v
[INSERT INTO checkpoints (project_id, total_work_days, completed_work_days)]
    |
    v
[Progress plot re-fetches checkpoints, redraws curves]
```

### Key Data Flows

1. **Read-only view**: Server Component loads all data, passes to client, client computes schedule, renders. No writes.
2. **Edit flow**: Client Component captures edits, updates local state immediately (optimistic), debounces writes to Supabase, recomputes schedule on every change.
3. **Progress tracking**: Checkpoint creation is a one-shot INSERT. The progress plot queries all checkpoints for the project and renders the "as-built" curve alongside the "desired" curve (computed from current schedule).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 projects, <200 tasks each | Current design is perfect. All computation client-side. |
| 10-50 projects, <500 tasks each | Still fine. Supabase free tier handles this easily. Consider adding database indexes on project_id + sort_order. |
| 100+ projects or 1000+ tasks | Would need virtual scrolling on the Gantt chart, pagination on task loading, and potentially move scheduling engine to a Web Worker. Not relevant for this use case. |

### Scaling Priorities

1. **First bottleneck**: Gantt chart rendering with many tasks. Solve with virtual viewport (only render visible bars). Unlikely to hit with renovation tasks (<100 tasks typical).
2. **Second bottleneck**: Supabase connection limits on free tier. Irrelevant for a personal tool with 2-3 concurrent users.

## Anti-Patterns

### Anti-Pattern 1: Storing Computed Dates in the Database

**What people do:** Store `required_start_date`, `effective_start_date`, and `end_date` as database columns, then update them with cascading triggers when any task changes.
**Why it's wrong:** A single task edit can cascade through the entire dependency graph, causing N database updates. This creates race conditions, makes the database the bottleneck, and the stored dates can become inconsistent if any update fails mid-cascade.
**Do this instead:** Store only raw inputs (desired start, duration, dependencies). Compute all derived dates in the client scheduling engine on every render. It is O(V+E) and takes <1ms for hundreds of tasks.

### Anti-Pattern 2: Using a Gantt Library for the Whole Application

**What people do:** Choose a heavy Gantt library (DHTMLX, Bryntum, Syncfusion) and let it own the data model, rendering, and interaction layer. Build the rest of the app around its API.
**Why it's wrong:** These libraries cost $500-$5000/year for commercial use, have massive bundle sizes, impose their own data model, and make customization difficult. They are designed for enterprise project management tools, not a personal scheduling app.
**Do this instead:** Build a custom Gantt renderer using SVG. For <200 tasks and finish-to-start dependencies only, the rendering is straightforward: position bars on a time axis, draw arrows between them. The scheduling engine (the hard part) is yours regardless.

### Anti-Pattern 3: Complex Auth for a Household Tool

**What people do:** Implement full Supabase Auth with email/password, JWT tokens, Row Level Security policies, and session management.
**Why it's wrong:** Massive over-engineering for a tool used by 2 people. Adds significant complexity to every database query, every component, and the deployment process.
**Do this instead:** Simple passcode cookie. Hash the passcode with bcrypt, store the hash in the project. On passcode entry, verify with bcrypt and set an httpOnly cookie. Check the cookie in middleware for edit routes. Read-only routes are open.

### Anti-Pattern 4: Real-Time Collaboration

**What people do:** Add Supabase Realtime subscriptions so multiple users see live edits.
**Why it's wrong:** Adds complexity for a scenario that barely exists (homeowner and wife rarely edit simultaneously). Conflict resolution in a Gantt chart is non-trivial.
**Do this instead:** Simple optimistic updates with last-write-wins. If the rare conflict occurs, a page refresh resolves it.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase (database) | @supabase/ssr with separate server/client instances | Use server client in Server Components, client in browser. Service role NOT needed -- passcode gate is at middleware level, not RLS. |
| Vercel (hosting) | Standard Next.js deployment | Environment variables for Supabase URL and anon key. No special configuration needed. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Scheduling Engine <-> React Components | Via `useSchedule` hook | Engine is pure functions, no React dependency. Hook wraps it in useMemo for performance. |
| Task List <-> Gantt Chart | Shared state via parent component or context | Both read from the same ComputedTask[] array. Hover/select state synchronized. |
| Edit Mode <-> Read-Only Mode | Same components, different `editable` prop | Components check editable flag to enable/disable inline editing, drag handles, etc. |
| Client <-> Supabase | Via typed query functions in `lib/supabase/queries.ts` | All database access goes through these functions. Never call Supabase directly from components. |

## Build Order (Dependency Chain)

This is the recommended implementation sequence based on architectural dependencies:

```
1. Database Schema + Supabase Setup
   (Everything depends on the data model)
       |
       v
2. TypeScript Types + Supabase Client
   (Type safety foundation)
       |
       v
3. Scheduling Engine (lib/scheduling/)
   (Core logic, testable in isolation, no UI dependency)
       |
       v
4. Task List View (CRUD without Gantt)
   (Proves the data model and scheduling engine work)
       |
       v
5. Gantt Chart Renderer (read-only first)
   (Visualization layer on top of working data)
       |
       v
6. Passcode Gate + Edit Mode
   (Adds write access to working read-only system)
       |
       v
7. Dependency Editing (UI for creating/removing links)
   (Requires both task list and Gantt to be working)
       |
       v
8. Progress Plot + Checkpoints
   (Independent feature, can be built in parallel with 6-7)
       |
       v
9. Polish: drag-and-drop deps, calendar view, owner management
```

**Rationale:** Each step produces a working, testable artifact. The scheduling engine (step 3) is the riskiest code and should be built and tested early, before any UI complexity is added.

## Sources

- [Topological Sorting - Wikipedia](https://en.wikipedia.org/wiki/Topological_sorting) - HIGH confidence, canonical algorithm reference
- [Critical Path Method Implementation Javascript](https://gist.github.com/perico/7790396) - MEDIUM confidence, reference implementation
- [toposort npm package](https://github.com/marcelklehr/toposort) - HIGH confidence, well-maintained JS topological sort
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) - HIGH confidence, official docs
- [Use Supabase with Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) - HIGH confidence, official quickstart
- [Next.js + Supabase: What I'd Do Differently](https://catjam.fi/articles/next-supabase-what-do-differently) - MEDIUM confidence, production experience report
- [MakerKit Architecture and Folder Structure](https://makerkit.dev/docs/next-supabase/architecture) - MEDIUM confidence, established Next.js+Supabase boilerplate
- [DHTMLX Gantt for React](https://dhtmlx.com/docs/products/dhtmlxGantt-for-React/) - MEDIUM confidence, reference for data model patterns
- [Dependencies between tasks - Highcharts](https://www.highcharts.com/docs/gantt/gantt-task-dependencies) - MEDIUM confidence, dependency type reference
- [Critical Path Method Explained for Developers](https://dev.to/teamcamp/critical-path-method-cpm-explained-for-developers-mastering-project-timelines-4k6j) - MEDIUM confidence, algorithm walkthrough

---
*Architecture research for: SchedulePlanner -- Home Renovation Gantt Tool*
*Researched: 2026-03-15*
