# Phase 5: Unified Gantt View - Research

**Researched:** 2026-03-23
**Domain:** Custom SVG Gantt bar rendering, single-container scroll architecture, CSS sticky positioning
**Confidence:** HIGH

## Summary

This phase replaces the SVAR React Gantt library (`@svar-ui/react-gantt`) with custom SVG bars rendered inside the same scroll container as the existing TaskTable. The core insight is that row alignment, scroll sync, and expand/collapse problems all stem from having two independent rendering systems. By placing both the HTML table and an SVG element inside a single `overflow: auto` container, alignment becomes structurally guaranteed rather than maintained through fragile bidirectional sync.

The implementation is straightforward: React SVG rendering with `date-fns` for date math (already in the project), CSS `position: sticky` for the frozen table columns (already working), and standard SVG `<rect>`, `<path>`, `<line>`, and `<text>` elements for bars, arrows, grid lines, and labels. No new libraries are needed. The existing `treeSortTasks`, `computeSchedule`, and date calculator utilities provide all the data the SVG layer needs.

**Primary recommendation:** Build the SVG Gantt as a pure React component that takes the same `ComputedTask[]` + `Owner[]` + `Dependency[]` data and renders positioned SVG elements. Use a shared `ROW_HEIGHT = 34` constant and compute bar Y positions as `rowIndex * ROW_HEIGHT`. The table and SVG sit side-by-side in a flex row inside a single scrollable div.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace SVAR React Gantt with custom SVG bars in a single scroll container
- Custom table (TaskTable/TaskRow) stays as-is for left pane
- Right pane becomes custom SVG rendering (no third-party Gantt library)
- Single scroll container architecture: outer div `overflow: auto`, table `sticky left`, SVG flows naturally
- ROW_HEIGHT = 34px for all data rows
- Header height must match between table header and time scale header
- Time scale: top row = month+year, bottom row = day numbers
- Configurable DAY_WIDTH (e.g., 30-40px per day)
- Weekend columns can be shaded differently
- Must build: time scale header, SVG bar rendering, completion fills, dependency arrows, today marker
- Must preserve: all inline editing, hierarchical IDs, frozen columns, drag-to-reorder, expand/collapse, owner colors, read-only/editor modes
- Dependency creation stays text-based in Deps column (no drag-to-link on bars)
- Progress plot panel unchanged

### Claude's Discretion
- SVG vs Canvas for bar rendering (SVG preferred for DOM interactivity and simpler implementation)
- Exact bar padding/margins within the 34px row
- Dependency arrow path shape (straight lines, bezier curves, or right-angle connectors)
- Whether to add bar hover tooltips in this phase
- Whether to support horizontal scroll via mouse wheel / shift+wheel
- Time scale date range calculation (auto-fit to task date range with padding)

### Deferred Ideas (OUT OF SCOPE)
- Click-to-link dependency creation on Gantt bars
- Drag to resize bar duration
- Drag to move bar (change start date)
- Critical path highlighting
- Bar hover tooltips with task details
- Zoom in/out (change DAY_WIDTH)
- Mini-map / overview panel
</user_constraints>

## Standard Stack

### Core (Already in project -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | SVG component rendering | Already used; SVG elements are first-class JSX |
| date-fns | 4.1.0 | Date arithmetic for bar positioning | Already used for scheduling engine |
| Tailwind CSS | 4.x | Styling for container, table, headers | Already used throughout project |

### Supporting (Already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.577.0 | Icons if needed in Gantt (e.g., today marker) | Optional |

### Removed
| Library | Version | Why Removed |
|---------|---------|-------------|
| @svar-ui/react-gantt | 2.5.2 | Replaced by custom SVG -- source of alignment/scroll problems |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom SVG | Canvas | Canvas is faster for 1000+ bars but loses DOM interactivity, harder to implement hover/click, accessibility issues. SVG is correct for <200 tasks. |
| Custom SVG | Another Gantt lib (dhtmlx, bryntum) | Same two-system alignment problem. The point is eliminating the second rendering system. |

**Installation:**
```bash
# No new packages needed. After implementation:
npm uninstall @svar-ui/react-gantt
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/gantt/
  GanttChart.tsx        # NEW: Main SVG Gantt component (replaces GanttView.tsx)
  GanttBar.tsx          # NEW: Individual bar (rect + completion fill + label)
  GanttTimescale.tsx    # NEW: Month/day header rows rendered as SVG
  GanttDependencyArrow.tsx  # NEW: SVG path for dependency arrows
  GanttTodayMarker.tsx  # NEW: Vertical line for today's date
  gantt-utils.ts        # NEW: Date-to-pixel math, range calculation
  gantt-adapter.ts      # KEEP treeSortTasks; REMOVE toSvarTasks/toSvarLinks
  gantt-config.ts       # REPLACE with DAY_WIDTH, BAR_HEIGHT constants
  GanttView.tsx         # DELETE (SVAR wrapper)
```

### Pattern 1: Single Scroll Container with Sticky Table
**What:** One `div` with `overflow: auto` contains both the `<table>` and `<svg>`. The table uses `position: sticky; left: 0` to freeze during horizontal scroll.
**When to use:** Always -- this is the core architectural pattern.
**Example:**
```tsx
// Source: CSS spec for position: sticky + standard flex layout
const HEADER_HEIGHT = 40; // Must match table header
const ROW_HEIGHT = 34;
const DAY_WIDTH = 34; // pixels per calendar day

function UnifiedGanttContainer({ visibleTasks, ... }) {
  const totalHeight = HEADER_HEIGHT + visibleTasks.length * ROW_HEIGHT;
  const { startDate, totalDays } = computeDateRange(visibleTasks);
  const svgWidth = totalDays * DAY_WIDTH;

  return (
    <div style={{ overflow: 'auto', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', minWidth: tableWidth + svgWidth }}>
        {/* Frozen task table */}
        <div style={{ position: 'sticky', left: 0, zIndex: 10, flexShrink: 0 }}>
          <TaskTable ... />
        </div>
        {/* SVG timeline */}
        <svg
          width={svgWidth}
          height={totalHeight}
          style={{ flexShrink: 0 }}
        >
          <GanttTimescale ... />
          {visibleTasks.map((task, idx) => (
            <GanttBar key={task.id} task={task} rowIndex={idx} ... />
          ))}
          {dependencies.map(dep => (
            <GanttDependencyArrow key={dep.id} ... />
          ))}
          <GanttTodayMarker ... />
        </svg>
      </div>
    </div>
  );
}
```

### Pattern 2: Date-to-Pixel Coordinate Mapping
**What:** Pure function converting ISO date strings to X pixel positions relative to the SVG origin.
**When to use:** Every bar, arrow, grid line, and today marker.
**Example:**
```tsx
// Source: standard Gantt rendering math
import { differenceInCalendarDays, parseISO } from 'date-fns';

function dateToX(dateISO: string, rangeStartISO: string, dayWidth: number): number {
  const diff = differenceInCalendarDays(parseISO(dateISO), parseISO(rangeStartISO));
  return diff * dayWidth;
}

function barProps(task: ComputedTask, rangeStart: string, dayWidth: number, rowIndex: number) {
  const x = dateToX(task.effectiveStartDate, rangeStart, dayWidth);
  const width = dateToX(task.endDate, rangeStart, dayWidth) - x;
  const BAR_HEIGHT = 22; // within 34px row
  const BAR_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2;
  const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT + BAR_PADDING;
  return { x, y, width: Math.max(width, dayWidth), height: BAR_HEIGHT };
}
```

### Pattern 3: Right-Angle Dependency Arrows
**What:** SVG `<path>` with horizontal-out, vertical, horizontal-in segments connecting bar endpoints.
**When to use:** For all finish-to-start dependency arrows.
**Example:**
```tsx
// Source: standard Gantt arrow pattern
function dependencyPath(
  sourceEndX: number, sourceY: number,
  targetStartX: number, targetY: number,
  barHeight: number
): string {
  const sourceCenterY = sourceY + barHeight / 2;
  const targetCenterY = targetY + barHeight / 2;
  const midX = (sourceEndX + targetStartX) / 2;

  // Right-angle connector: horizontal out -> vertical -> horizontal in
  return `M ${sourceEndX} ${sourceCenterY}
          H ${midX}
          V ${targetCenterY}
          H ${targetStartX}`;
}
```

### Pattern 4: Shared Visibility Between Table and SVG
**What:** Both table rows and SVG bars use the same `visibleTasks` array (filtered by collapse state). The row index in the array directly maps to the Y position.
**When to use:** Always -- this is what guarantees alignment.
**Example:**
```tsx
// The SAME filtered+sorted array feeds both components
const visibleTasks = useMemo(() => {
  const sorted = treeSortTasks(schedule);
  return sorted.filter(t => !hiddenIds.has(t.id));
}, [schedule, hiddenIds]);

// Table renders: visibleTasks.map(task => <TaskRow ... />)
// SVG renders: visibleTasks.map((task, idx) => <GanttBar rowIndex={idx} ... />)
// idx === visual row position in both
```

### Anti-Patterns to Avoid
- **Separate scroll containers:** The entire point of this phase is eliminating the two-container architecture. Never wrap the table and SVG in separate scrollable divs.
- **Absolute positioning for bars:** Use the rowIndex from the shared visibleTasks array, not task IDs or sort orders, to compute Y positions. The array index IS the visual row number.
- **Recreating SVAR's tree management:** The TaskTable already handles collapse/expand and tree sorting. The SVG layer just reads the filtered result.
- **Inline SVG styles for colors:** Use the owner color from the data, but keep structural styles (padding, sizing) as constants to maintain the height contract.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic | Custom day counting | `date-fns` differenceInCalendarDays, addDays, eachDayOfInterval | Timezone edge cases, DST, leap years |
| Tree sorting | New sort algorithm | Existing `treeSortTasks()` from `gantt-adapter.ts` | Already works, tested, used by TaskTable |
| Collapse visibility | New hidden-task logic | Existing `hiddenIds` useMemo in `TaskTable.tsx` | Already works; extract to shared hook |
| Weekend detection | Manual day-of-week check | `date-fns` isWeekend() | Already imported |

**Key insight:** The scheduling engine, tree sort, and collapse logic already exist and work. The SVG layer is a pure rendering concern -- it reads computed data and draws rectangles. Do not duplicate any scheduling or tree logic.

## Common Pitfalls

### Pitfall 1: Table Header and SVG Timescale Height Mismatch
**What goes wrong:** The table header renders at a different height than the SVG timescale, causing every row below to be offset by the difference.
**Why it happens:** Table header height is determined by content/CSS while SVG timescale is positioned by explicit Y coordinates.
**How to avoid:** Use a shared `HEADER_HEIGHT` constant (e.g., 40px). Set the table header `height` explicitly via inline style. Start SVG bar rendering at Y = HEADER_HEIGHT.
**Warning signs:** First row is slightly off; misalignment is constant (not cumulative).

### Pitfall 2: SVG Width Not Matching Date Range
**What goes wrong:** Bars extend beyond the SVG viewport or the horizontal scroll range is wrong.
**Why it happens:** Date range calculation doesn't account for padding days or tasks with zero duration.
**How to avoid:** Compute the date range from `min(effectiveStartDate)` to `max(endDate)` across all tasks (not just visible ones), then add padding (e.g., 7 days before, 14 days after). Set SVG width = totalDays * DAY_WIDTH.
**Warning signs:** Bars clipped on the right, or today marker not visible.

### Pitfall 3: Sticky Positioning Breaks in Nested Scroll Contexts
**What goes wrong:** `position: sticky` on the table doesn't freeze it during horizontal scroll.
**Why it happens:** Sticky positioning requires the correct containing block. If there are intermediate elements with `overflow: hidden` or unexpected `position` values, sticky breaks.
**How to avoid:** The table's sticky container must be a direct child of the scrollable flex container. Do not nest additional divs with overflow between the scroll container and the sticky element. Test with minimal markup first.
**Warning signs:** Table scrolls horizontally with the timeline instead of staying fixed.

### Pitfall 4: Expand/Collapse Causes Flash of Misaligned Content
**What goes wrong:** When collapsing a parent, the table updates before the SVG (or vice versa), causing a brief visual mismatch.
**Why it happens:** If table and SVG consume different state or re-render at different times.
**How to avoid:** Both table and SVG must derive from the exact same `visibleTasks` array computed in the parent component. A single `useState` for `collapsedIds` (already exists) drives both. No separate state in the SVG layer.
**Warning signs:** Brief flicker when toggling expand/collapse.

### Pitfall 5: Horizontal Scrollbar Only Appears at Bottom of Content
**What goes wrong:** User must scroll all the way to the bottom to access the horizontal scrollbar.
**Why it happens:** The horizontal scrollbar is at the bottom of the scroll container, which can be very tall if there are many rows.
**How to avoid:** Consider `overflow-x: auto` on an inner wrapper that only contains the SVG width, while the outer container handles vertical scroll. Alternatively, keep the current approach (single scroll container) and accept that the horizontal scrollbar lives at the bottom -- this is standard behavior for Gantt charts and the user already has this pattern from SVAR.
**Warning signs:** User complaints about not being able to scroll the timeline horizontally.

### Pitfall 6: SVG Re-renders on Every Scroll Event
**What goes wrong:** Performance degrades with many tasks because the entire SVG re-renders when the container scrolls.
**Why it happens:** If scroll position is stored in React state, it triggers re-renders.
**How to avoid:** Do NOT store scroll position in React state. The single container handles scroll natively via CSS overflow. React only re-renders when task data or collapse state changes. For <200 tasks, SVG performance is not a concern.
**Warning signs:** Laggy scrolling, profiler shows re-renders on scroll.

## Code Examples

### Computing the Timeline Date Range
```tsx
// gantt-utils.ts
import { parseISO, min, max, addDays, subDays, differenceInCalendarDays,
         eachDayOfInterval, format, isWeekend, startOfMonth, getMonth, getYear } from 'date-fns';
import type { ComputedTask } from '@/types/scheduling';

export const DAY_WIDTH = 34;
export const ROW_HEIGHT = 34;
export const BAR_HEIGHT = 22;
export const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
export const HEADER_HEIGHT = 40; // two-row timescale

export interface DateRange {
  startDate: Date;   // first day of the timeline
  endDate: Date;     // last day of the timeline
  totalDays: number;
}

export function computeDateRange(tasks: ComputedTask[], paddingBefore = 7, paddingAfter = 14): DateRange {
  if (tasks.length === 0) {
    const today = new Date();
    return { startDate: subDays(today, 7), endDate: addDays(today, 30), totalDays: 37 };
  }
  const starts = tasks.map(t => parseISO(t.effectiveStartDate));
  const ends = tasks.map(t => parseISO(t.endDate));
  const earliest = subDays(min(starts), paddingBefore);
  const latest = addDays(max(ends), paddingAfter);
  const totalDays = differenceInCalendarDays(latest, earliest) + 1;
  return { startDate: earliest, endDate: latest, totalDays };
}

export function dateToX(dateISO: string, rangeStart: Date): number {
  return differenceInCalendarDays(parseISO(dateISO), rangeStart) * DAY_WIDTH;
}
```

### SVG Bar Component
```tsx
// GanttBar.tsx
import type { ComputedTask, Owner } from '@/types/scheduling';
import { dateToX, BAR_HEIGHT, BAR_Y_OFFSET, ROW_HEIGHT, HEADER_HEIGHT } from './gantt-utils';

interface GanttBarProps {
  task: ComputedTask;
  rowIndex: number;
  rangeStart: Date;
  ownerColor: string;
}

const DEFAULT_COLOR = '#94A3B8';

export function GanttBar({ task, rowIndex, rangeStart, ownerColor }: GanttBarProps) {
  const x = dateToX(task.effectiveStartDate, rangeStart);
  const endX = dateToX(task.endDate, rangeStart);
  const width = Math.max(endX - x, 4); // minimum 4px width
  const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT + BAR_Y_OFFSET;
  const color = ownerColor || DEFAULT_COLOR;
  const completionWidth = width * (task.completionPct / 100);

  return (
    <g>
      {/* Background bar */}
      <rect x={x} y={y} width={width} height={BAR_HEIGHT} rx={3}
            fill={color} opacity={0.35} />
      {/* Completion fill */}
      {task.completionPct > 0 && (
        <rect x={x} y={y} width={completionWidth} height={BAR_HEIGHT} rx={3}
              fill={color} opacity={0.85} />
      )}
    </g>
  );
}
```

### Timescale Header
```tsx
// GanttTimescale.tsx -- renders month row + day row as SVG
import { eachDayOfInterval, format, isWeekend, getMonth, getYear, startOfMonth } from 'date-fns';
import { DAY_WIDTH, HEADER_HEIGHT } from './gantt-utils';
import type { DateRange } from './gantt-utils';

export function GanttTimescale({ range }: { range: DateRange }) {
  const days = eachDayOfInterval({ start: range.startDate, end: range.endDate });
  const halfHeader = HEADER_HEIGHT / 2; // 20px each row

  // Group days by month for the top row
  const months: { label: string; startX: number; width: number }[] = [];
  let currentMonth = -1;
  for (let i = 0; i < days.length; i++) {
    const m = getMonth(days[i]);
    if (m !== currentMonth) {
      currentMonth = m;
      months.push({
        label: format(days[i], 'MMM yyyy'),
        startX: i * DAY_WIDTH,
        width: 0,
      });
    }
    months[months.length - 1].width += DAY_WIDTH;
  }

  return (
    <g>
      {/* Month row */}
      {months.map((m, i) => (
        <g key={i}>
          <rect x={m.startX} y={0} width={m.width} height={halfHeader}
                fill="var(--muted)" stroke="var(--border)" strokeWidth={0.5} />
          <text x={m.startX + 6} y={halfHeader - 5}
                fontSize={11} fill="var(--muted-foreground)">
            {m.label}
          </text>
        </g>
      ))}
      {/* Day row */}
      {days.map((day, i) => (
        <g key={i}>
          <rect x={i * DAY_WIDTH} y={halfHeader} width={DAY_WIDTH} height={halfHeader}
                fill={isWeekend(day) ? 'var(--muted)' : 'transparent'}
                stroke="var(--border)" strokeWidth={0.5} />
          <text x={i * DAY_WIDTH + DAY_WIDTH / 2} y={HEADER_HEIGHT - 5}
                fontSize={10} fill="var(--muted-foreground)" textAnchor="middle">
            {format(day, 'd')}
          </text>
        </g>
      ))}
    </g>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SVAR React Gantt + bidirectional scroll sync | Single scroll container + custom SVG | This phase | Eliminates alignment drift, scroll sync fragility, header mismatch |
| Two independent collapse states (table + SVAR) | Single collapsedIds state drives both | This phase | Collapse always consistent |
| SVAR CSS overrides in globals.css | No third-party CSS to override | This phase | Cleaner CSS, no `!important` hacks |

**Deprecated/outdated after this phase:**
- `@svar-ui/react-gantt` package -- remove from dependencies
- `GanttView.tsx` -- delete entirely
- `gantt-adapter.ts` `toSvarTasks()` and `toSvarLinks()` -- delete (keep `treeSortTasks`)
- `gantt-config.ts` scales/columns -- delete (replace with constants)
- SVAR CSS overrides in `globals.css` (`.wx-willow` rules) -- delete
- All `IApi`, `TID`, SVAR type imports -- delete
- Scroll sync refs in ScheduleClient (`ganttApiRef`, `scrollSourceRef`, `scrollTimeoutRef`, `handleGanttInit`, `handleTableScroll`) -- delete

## Discretion Recommendations

Based on the locked decisions and codebase analysis, here are recommendations for areas marked as Claude's discretion:

| Area | Recommendation | Rationale |
|------|---------------|-----------|
| SVG vs Canvas | **SVG** | <200 tasks, need DOM events for future interactivity, simpler React integration |
| Bar padding | **6px** top/bottom (22px bar in 34px row) | Matches visual density of current SVAR rendering |
| Arrow style | **Right-angle connectors** | Clearest for reading dependencies; matches CONTEXT.md suggestion |
| Bar hover tooltips | **Skip** (deferred) | Listed in deferred ideas; not needed for alignment fix |
| Horizontal scroll | **Native scrollbar** (no shift+wheel) | Keep simple; matches current SVAR behavior |
| Date range | **Auto-fit: min(start)-7d to max(end)+14d** | Shows full project with breathing room; no manual config needed |

## Open Questions

1. **Table width in the unified container**
   - What we know: Currently set to `width: 55%` in ScheduleClient
   - What's unclear: Whether a percentage width works well with sticky positioning in a single scroll container, or if a fixed pixel width is needed
   - Recommendation: Use a fixed width for the table (e.g., `flexShrink: 0, width: 650px`) so sticky behavior is predictable. The SVG takes remaining space.

2. **Weekend column shading in the SVG body**
   - What we know: CONTEXT.md mentions weekend columns "can be shaded differently"
   - What's unclear: Whether to shade full-height vertical bands or just the header
   - Recommendation: Shade full-height vertical bands with a subtle fill (e.g., `var(--muted)` at 30% opacity). Simple to implement as background rects before bars.

3. **Header synchronization approach**
   - What we know: Table header needs `position: sticky; top: 0` and SVG timescale also needs to stay visible when scrolling vertically
   - What's unclear: Whether the SVG timescale should also use CSS sticky or be rendered separately
   - Recommendation: Make the entire header row (table header + SVG timescale) a separate flex row outside the scrollable area, with only the body content scrolling vertically. This avoids complex sticky-in-both-directions issues.

## Sources

### Primary (HIGH confidence)
- Project codebase: Direct analysis of ScheduleClient.tsx, TaskTable.tsx, TaskRow.tsx, GanttView.tsx, gantt-adapter.ts, gantt-config.ts, scheduling types, date-calculator.ts
- CSS `position: sticky` specification -- well-established browser feature, supported in all modern browsers
- SVG `<rect>`, `<path>`, `<text>` elements -- stable web standard

### Secondary (MEDIUM confidence)
- date-fns v4 API: `differenceInCalendarDays`, `eachDayOfInterval`, `isWeekend` -- used in existing project code, verified by current imports

### Tertiary (LOW confidence)
- None -- this phase uses only well-established web standards (SVG, CSS sticky, flexbox)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries; pure SVG + existing React + date-fns
- Architecture: HIGH - Single scroll container with sticky is a well-established CSS pattern; verified the existing table already uses sticky positioning
- Pitfalls: HIGH - Identified from direct codebase analysis of the current two-system problems
- Code examples: MEDIUM - Examples are structurally sound patterns but exact pixel values and CSS variable names should be verified during implementation

**Research date:** 2026-03-23
**Valid until:** Indefinite -- based on stable web standards, not library-specific APIs
