# Phase 2: Gantt Visualization - Research

**Researched:** 2026-03-16
**Domain:** Interactive Gantt chart rendering with SVAR React Gantt
**Confidence:** HIGH

## Summary

SVAR React Gantt (`@svar-ui/react-gantt` v2.5.2) is the correct library for this phase. It is MIT-licensed, React 19 compatible, ships with TypeScript types, and has an official Next.js App Router demo project. The library provides built-in split-pane layout (task tree grid on left, timeline bars on right), dependency arrows between bars, drag-and-drop link creation, progress fill indicators, and custom bar coloring -- all features this phase requires.

The primary integration work is a **data adapter layer** that maps our existing `ComputedTask`/`Dependency`/`Owner` domain types (ISO date strings, camelCase) to SVAR's `ITask`/`ILink` format (Date objects, flat numeric IDs). SVAR handles its own internal state and rendering; we feed it transformed data and listen to its action events (`add-link`, `delete-link`) to persist changes back to Supabase via our existing query layer. The existing `page.tsx` layout needs restructuring from a full-width task table to a split-pane Gantt view where the SVAR component replaces the standalone `TaskTable`.

**Primary recommendation:** Use SVAR React Gantt with a thin adapter layer mapping our domain types to SVAR's format. Do NOT use RestDataProvider -- instead, intercept SVAR action events directly and route through our existing Supabase query layer.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIS-01 | Split-pane list + Gantt chart view | SVAR Gantt provides built-in grid (left) + timeline (right) layout with `columns` prop for grid configuration. Wrap in `"use client"` component with mounted check for SSR. |
| VIS-02 | Gantt displays horizontal time bars with owner-colored fills | SVAR task bars support custom styling. Map `Owner.color` onto task objects and use SVAR's `taskTemplate` or CSS custom properties to color bars per-owner. `progress` prop renders completion fill natively. |
| VIS-03 | Dependency lines between connected tasks | SVAR renders dependency arrows from `links` array. Map our `Dependency` records to SVAR `ILink` objects with `{source, target, type: "e2s"}`. |
| VIS-04 | Each task shows completion % on its Gantt bar | SVAR's `progress` property (0-100) renders a fill indicator inside the bar natively. Map `ComputedTask.completionPct` directly. |
| OWN-04 | Task color determined by owner's color | Build a lookup map `taskId -> Owner.color` and inject color into SVAR task objects. Apply via SVAR's bar template/CSS. |
| DEP-05 | Drag-and-drop dependency creation on Gantt | SVAR supports creating links by dragging from one bar to another. Listen to `add-link` action event, translate source/target IDs back to our task UUIDs, call `addDependency()` from our query layer, then `refetch()`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @svar-ui/react-gantt | ^2.5.2 | Gantt chart component | MIT-licensed, React 19 + Next.js App Router compatible, built-in split-pane, dependency arrows, drag-and-drop links, progress bars, TypeScript types |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 (already installed) | Date conversion between ISO strings and Date objects | Adapter layer: `parseISO()` to convert our ISO strings to SVAR Date objects |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVAR React Gantt | Custom SVG/Canvas Gantt | Full control but massive effort -- drag-and-drop, dependency arrows, scroll sync, and bar rendering are weeks of work vs. a drop-in component |
| SVAR React Gantt | Bryntum Gantt | More features, but $940+/dev commercial license -- overkill for personal renovation tool |
| SVAR React Gantt | DHTMLX Gantt | jQuery heritage, wrapper-based React integration, commercial license |

**Installation:**
```bash
npm install @svar-ui/react-gantt
```

No additional packages needed. `date-fns` already installed from Phase 1.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── gantt/
│   │   ├── GanttView.tsx           # Main Gantt wrapper (use client, mounted check, Willow theme)
│   │   ├── gantt-adapter.ts        # Pure functions: ComputedTask[] -> ITask[], Dependency[] -> ILink[]
│   │   └── gantt-config.ts         # Scales, columns, and static configuration
│   ├── task-list/                   # Existing (may be simplified or kept for non-Gantt views)
│   └── owners/                      # Existing (unchanged)
├── hooks/
│   ├── useProject.ts               # Existing (unchanged)
│   └── useSchedule.ts              # Existing (unchanged)
├── app/
│   └── page.tsx                     # Restructured: GanttView replaces standalone TaskTable
└── types/
    └── scheduling.ts                # Existing (may add SVAR type re-exports)
```

### Pattern 1: Data Adapter Layer
**What:** Pure functions that transform our domain types to SVAR's expected format and back
**When to use:** Every render cycle when passing data to SVAR, and every event callback when SVAR reports changes

```typescript
// gantt-adapter.ts
import { parseISO } from 'date-fns';
import type { ComputedTask, Dependency, Owner } from '@/types/scheduling';

interface SvarTask {
  id: string;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  progress: number;
  parent: string | 0;
  type: 'task' | 'summary';
  open: boolean;
  // Custom fields for owner coloring
  ownerColor: string | null;
}

interface SvarLink {
  id: string;
  source: string;
  target: string;
  type: 'e2s';
}

export function toSvarTasks(
  tasks: ComputedTask[],
  owners: Owner[]
): SvarTask[] {
  const ownerMap = new Map(owners.map(o => [o.id, o]));
  return tasks.map(t => ({
    id: t.id,
    text: t.title,
    start: parseISO(t.effectiveStartDate),
    end: parseISO(t.endDate),
    duration: t.durationDays,
    progress: t.completionPct,
    parent: t.parentTaskId ?? 0,
    type: tasks.some(c => c.parentTaskId === t.id) ? 'summary' : 'task',
    open: true,
    ownerColor: t.ownerId ? (ownerMap.get(t.ownerId)?.color ?? null) : null,
  }));
}

export function toSvarLinks(deps: Dependency[]): SvarLink[] {
  return deps.map(d => ({
    id: d.id,
    source: d.upstreamTaskId,
    target: d.downstreamTaskId,
    type: 'e2s',
  }));
}
```

### Pattern 2: SSR Guard for Gantt Component
**What:** Client-only rendering with mounted check to avoid hydration mismatch
**When to use:** Always -- SVAR Gantt depends on browser APIs (DOM measurements)

```typescript
// GanttView.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Gantt, Willow } from '@svar-ui/react-gantt';
import type { IApi } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';

export function GanttView({ tasks, links, scales, onAddLink, onDeleteLink }) {
  const [mounted, setMounted] = useState(false);
  const [api, setApi] = useState<IApi | undefined>();

  useEffect(() => { setMounted(true); }, []);

  const init = useCallback((ganttApi: IApi) => {
    setApi(ganttApi);
    // Intercept link creation from drag-and-drop
    ganttApi.intercept('add-link', (data) => {
      onAddLink(data.link.source, data.link.target);
    });
    ganttApi.intercept('delete-link', (data) => {
      onDeleteLink(data.id);
    });
  }, [onAddLink, onDeleteLink]);

  if (!mounted) {
    return <div style={{ height: '100%', width: '100%' }} />;
  }

  return (
    <Willow>
      <Gantt tasks={tasks} links={links} scales={scales} init={init} />
    </Willow>
  );
}
```

### Pattern 3: Event-Driven Persistence (No RestDataProvider)
**What:** Intercept SVAR action events and route to our existing Supabase query layer
**When to use:** For DEP-05 (drag-and-drop dependency creation) and any future Gantt-initiated mutations

We already have `addDependency()`, `removeDependency()`, and `refetch()` in our query layer and `page.tsx`. SVAR's `api.intercept()` or `api.addEventListener()` captures user actions on the Gantt, which we translate to our Supabase calls. This avoids introducing a second data persistence path (RestDataProvider) that would conflict with our existing hooks.

### Anti-Patterns to Avoid
- **Using RestDataProvider alongside existing Supabase hooks:** Creates dual persistence paths, race conditions, and data inconsistency. Use `api.intercept()` instead and route through our existing `addDependency`/`removeDependency` + `refetch()` flow.
- **Letting SVAR manage task state internally:** SVAR wants to own task data (add/update/delete tasks). For Phase 2, the Gantt is read-only for tasks (editing stays in the task table). Only link creation/deletion flows through SVAR events.
- **Converting dates on every render without memoization:** `parseISO()` on 50-200 tasks per render is cheap, but wrap the adapter in `useMemo` keyed on `schedule` and `owners` to be safe.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gantt bar rendering | Custom SVG bars with positioning math | SVAR `<Gantt>` component | Handles time-to-pixel math, scroll virtualization, zoom, resize, and hundreds of edge cases |
| Dependency arrows | Custom SVG path drawing between bars | SVAR's built-in `links` prop | Arrow routing around bars, bend points, and arrow heads are surprisingly complex |
| Drag-to-link | Custom mouse event tracking on SVG elements | SVAR's built-in drag-to-link | Requires hit detection, visual feedback line, snap-to-bar, and undo on cancel |
| Split-pane sync scroll | Custom scroll event listeners + RAF sync | SVAR's built-in grid + timeline layout | Scroll sync between two panes has jank/flicker edge cases that SVAR handles internally |
| Task bar coloring | CSS class injection by task type | SVAR's template/style customization | Library provides hooks for custom bar rendering including color overrides |

**Key insight:** Gantt chart rendering is a deceptively deep problem. Time-to-pixel conversion, bar overlap, scroll performance, dependency arrow routing, and drag interaction feedback each have dozens of edge cases. SVAR handles all of these out of the box.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch with SSR
**What goes wrong:** SVAR measures DOM dimensions on mount. Server-rendered HTML has no dimensions, causing React hydration warnings and layout shifts.
**Why it happens:** Next.js App Router server-renders by default.
**How to avoid:** Use `"use client"` directive and a `mounted` state guard that renders an empty placeholder until `useEffect` fires.
**Warning signs:** Console warnings about hydration mismatch, Gantt renders at 0 height then pops into view.

### Pitfall 2: Date Format Mismatch
**What goes wrong:** SVAR expects JavaScript `Date` objects for `start`/`end`. Our domain uses ISO `YYYY-MM-DD` strings. Passing strings silently produces wrong/missing bars.
**Why it happens:** Different conventions between our scheduling engine (string-based for JSON serialization) and SVAR (Date-based for time calculations).
**How to avoid:** The adapter layer MUST call `parseISO()` on `effectiveStartDate` and `endDate` when building SVAR task objects.
**Warning signs:** Bars don't appear, or all bars stack at the epoch origin.

### Pitfall 3: ID Type Mismatch
**What goes wrong:** Our domain uses UUID strings for task/dependency IDs. SVAR examples show numeric IDs. If SVAR internally coerces to numbers, UUID strings would break.
**Why it happens:** SVAR's `id` field accepts `string | number` per the TypeScript types, but internal comparisons might be type-sensitive.
**How to avoid:** Pass UUID strings directly (SVAR TypeScript types accept strings). Test with real UUIDs early.
**Warning signs:** Links don't render, parent-child hierarchy flattens.

### Pitfall 4: Dual State Ownership
**What goes wrong:** SVAR tries to manage its own task state (add/update/delete). If we also manage state through our hooks, the two fight and data desyncs.
**Why it happens:** SVAR is designed as a full task management widget, not just a renderer.
**How to avoid:** For Phase 2, treat SVAR as display-only for tasks (disable task editing in Gantt). Only dependency creation/deletion flows through SVAR events. Task CRUD stays in the existing task table/editors.
**Warning signs:** Editing a task in the Gantt reverts on refetch, or deleting a task in the table doesn't update the Gantt.

### Pitfall 5: CSS Import Order / Theme Conflicts
**What goes wrong:** SVAR's `all.css` conflicts with Tailwind's reset or shadcn component styles, causing broken layout.
**Why it happens:** Both frameworks use CSS resets and base styles.
**How to avoid:** Import `@svar-ui/react-gantt/all.css` in the Gantt component file (not globally). Scope the Gantt inside a container div. Add `.wx-theme { height: 100%; }` to global CSS.
**Warning signs:** Gantt has zero height, fonts look wrong, grid borders disappear.

## Code Examples

### Complete Data Flow (Adapter + Event Handling)

```typescript
// In page.tsx or a parent component
const svarTasks = useMemo(
  () => toSvarTasks(schedule, owners),
  [schedule, owners]
);

const svarLinks = useMemo(
  () => toSvarLinks(dependencies),
  [dependencies]
);

const scales = [
  { unit: 'month', step: 1, format: '%M %Y' },
  { unit: 'day', step: 1, format: '%d' },
];

const handleAddLink = useCallback(async (sourceId: string, targetId: string) => {
  try {
    await addDependency(client, {
      projectId: DEFAULT_PROJECT_ID,
      upstreamTaskId: sourceId,
      downstreamTaskId: targetId,
    });
    await refetch();
    toast.success('Dependency created');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create dependency');
  }
}, [client, refetch]);

const handleDeleteLink = useCallback(async (linkId: string) => {
  try {
    await removeDependency(client, linkId);
    await refetch();
    toast.success('Dependency removed');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to remove dependency');
  }
}, [client, refetch]);
```

### Owner-Colored Bar Styling

```typescript
// Approach: pass ownerColor as custom task field, use SVAR's template to apply it
// SVAR allows custom task bar templates via the taskTemplate config
// The exact API for bar color customization needs validation during implementation,
// but the two known approaches are:
// 1. CSS custom property on the task bar element
// 2. taskTemplate callback that returns custom JSX with inline style

// If SVAR supports a `color` or `$color` field on tasks directly:
const svarTask = {
  id: task.id,
  text: task.title,
  start: parseISO(task.effectiveStartDate),
  end: parseISO(task.endDate),
  progress: task.completionPct,
  color: ownerColor,  // Verify this field name in SVAR docs during implementation
};
```

### SVAR Gantt Scales Configuration

```typescript
// Day-level view (good for renovation projects spanning weeks-months)
const scales = [
  { unit: 'month', step: 1, format: '%M %Y' },
  { unit: 'week', step: 1, format: 'Week %w' },
];

// For zoomed-in view
const detailScales = [
  { unit: 'week', step: 1, format: 'Week %w (%M)' },
  { unit: 'day', step: 1, format: '%d' },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DHTMLX Gantt with jQuery wrapper | SVAR React Gantt (native React) | 2024 | No jQuery dependency, proper React lifecycle, hooks-based API |
| Manual SVG Gantt bars | Component libraries with built-in interactions | 2023+ | Drag-and-drop, dependency arrows, and scroll sync handled by library |
| Separate grid + chart components | Integrated split-pane Gantt components | 2024+ | No need to wire scroll sync between separate components |

**Deprecated/outdated:**
- `react-gantt-timeline`: Abandoned, not React 18+ compatible
- `gantt-task-react`: Minimal features, no dependency arrows, no drag-to-link

## Open Questions

1. **Owner color application to SVAR bars**
   - What we know: SVAR supports custom task bar templates and CSS styling. Tasks can carry custom fields.
   - What's unclear: The exact prop/API for applying per-task colors (is it a `color` field, a CSS class, or a template callback?).
   - Recommendation: Test during implementation with a simple color field first. Fall back to `taskTemplate` callback if needed. LOW risk -- one of these approaches will work.

2. **Task editing scope in the Gantt**
   - What we know: SVAR supports inline task editing, drag-to-resize, and a side Editor panel.
   - What's unclear: Can we disable task editing in the Gantt (make bars display-only) while keeping link drag-and-drop enabled?
   - Recommendation: Use `api.intercept()` on `update-task` to block/redirect edits, or configure read-only mode for tasks only. If not possible, allow SVAR task edits and sync back to Supabase.

3. **SVAR + Next.js 16 App Router (flagged blocker)**
   - What we know: SVAR has an official Next.js demo (tested with Next.js 14+), React 19 support confirmed in v2.3+, and the `"use client"` + mounted guard pattern is documented.
   - What's unclear: Next.js 16 specifically (this project uses 16.1.6). No explicit "Next.js 16 tested" claim found.
   - Recommendation: MEDIUM confidence this works -- React 19 support is the key compatibility factor, and Next.js 16 uses React 19. The `"use client"` pattern bypasses SSR entirely, so App Router version differences shouldn't matter. Validate early in implementation.

## Sources

### Primary (HIGH confidence)
- [SVAR React Gantt Official Docs - Quickstart](https://docs.svar.dev/react/gantt/getting_started/) - Installation, props, data format
- [SVAR React Gantt Official Docs - Loading Data](https://docs.svar.dev/react/gantt/guides/loading_data/) - Task and link data structures
- [SVAR React Gantt Official Docs - Working with Server](https://docs.svar.dev/react/gantt/guides/working_with_server/) - Event system, RestDataProvider, action events
- [SVAR React Gantt Official Docs - Tasks API](https://docs.svar.dev/react/gantt/api/properties/tasks/) - Full task property reference
- [SVAR React Gantt Official Docs - Grid Configuration](https://docs.svar.dev/react/gantt/guides/configuration/configure_grid/) - Column and grid customization
- [SVAR Next.js Integration Tutorial](https://svar.dev/blog/nextjs-gantt-chart-tutorial/) - SSR handling, theme setup, mounted guard pattern
- [SVAR Next.js Backend Tutorial](https://svar.dev/blog/nextjs-gantt-chart-backend/) - Event handling, RestDataProvider, full component example
- [SVAR Next.js Demo Repository](https://github.com/svar-widgets/react-gantt-demo-nextjs) - Official App Router demo with branches for client-only and backend variants

### Secondary (MEDIUM confidence)
- [SVAR React Gantt npm](https://www.npmjs.com/package/@svar-ui/react-gantt) - v2.5.2, latest release Jan 2026
- [SVAR Gantt 2.4 Release Notes](https://dev.to/olga_tash/svar-gantt-24-a-free-modern-gantt-chart-for-react-svelte-2e07) - Dependency management features, click-to-remove links
- [SVAR React Gantt v2.3 Release](https://dev.to/olga_tash/svar-react-gantt-v23-modern-project-timelines-for-react-19-e7f) - React 19 compatibility confirmation
- [Top 5 React Gantt Chart Libraries (2026)](https://svar.dev/blog/top-react-gantt-charts/) - Landscape comparison

### Tertiary (LOW confidence)
- Owner color application method needs validation during implementation (custom field vs template callback)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SVAR is MIT, actively maintained (v2.5.2, Jan 2026), has official Next.js demo, React 19 + TypeScript support confirmed
- Architecture: HIGH - Data adapter pattern is straightforward; event system is well-documented with code examples from official tutorials
- Pitfalls: MEDIUM - SSR guard and date format pitfalls are well-documented; owner coloring and Next.js 16 specific compatibility are educated extrapolations

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable library, 30-day validity)
