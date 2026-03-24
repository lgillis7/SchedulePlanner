# Phase 5: Unified Gantt View - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current two-system architecture (custom HTML table + SVAR React Gantt library) with a single unified scroll container. The custom table stays as-is for the left pane; the right pane replaces SVAR with custom SVG Gantt bars rendered inside the same scroll container. This guarantees pixel-perfect row alignment, unified vertical scrolling, and correct expand/collapse behavior.

</domain>

<decisions>
## Implementation Decisions

### Why we're replacing SVAR
The current architecture uses two independent rendering systems:
- **Left pane**: Custom `<table>` with TaskTable/TaskRow components (inline editing, selects, calendars, drag-to-reorder)
- **Right pane**: SVAR React Gantt library (`@svar-ui/react-gantt`) with `columns={false}` (bars + dependency arrows only)
- **Scroll sync**: Bidirectional via SVAR's `scroll-chart` event and `exec('scroll-chart', { top })` API

**Problems observed:**
1. **Row misalignment** -- SVAR's internal row rendering drifts from the table despite matching `cellHeight=34px` and `scaleHeight=20px`. By ~10 rows, bars no longer correspond to their table rows.
2. **Scroll only works on left pane** -- Scrolling the right (Gantt) pane doesn't reliably sync back to the table. The bidirectional scroll sync via 100ms timeout is fragile.
3. **Expand/collapse breaks alignment** -- SVAR manages its own tree state (`open` property on summary tasks). When the custom table collapses a group, the SVAR Gantt may not collapse in sync, causing row count divergence.
4. **Header height mismatch** -- The SVAR Gantt header (month + day scales) doesn't exactly match our table header height of 40px, introducing an initial offset that compounds down the rows.

### Architecture: Option A - Single scroll container with custom SVG bars

**Selected approach:**
```
<div style="overflow: auto">          -- ONE scroll container
  <div style="display: flex">
    <table style="position: sticky; left: 0">  -- frozen task table
    <svg>                                        -- Gantt bars + dependency arrows
  </div>
</div>
```

**Why this approach wins:**
- Alignment is **guaranteed** -- both panes share the same DOM flow and scroll position
- Vertical scroll naturally moves both sides (single scrollTop)
- Horizontal scroll only moves the SVG timeline (table is sticky-left)
- Expand/collapse just adds/removes rows in both panes simultaneously
- Full control over every pixel -- no third-party rendering to match
- Dependency arrows can be rendered as SVG `<path>` elements with precise positioning

**What we lose from SVAR:**
- SVAR's click-to-link dependency creation UI (drag from one bar to another)
- SVAR's built-in time scale rendering
- SVAR's bar hover/selection styling

**What we must build:**
1. Time scale header (month + day rows) matching table header height
2. SVG bar rendering: colored rectangles positioned by (effectiveStartDate, endDate) with owner colors
3. Completion fill indicator on each bar
4. Dependency arrows as SVG paths connecting upstream bar ends to downstream bar starts
5. Horizontal scrollbar for the timeline
6. Today marker (vertical line)

### Existing features to preserve
- All inline editing in the table (titles, dates, durations, owners, deps, completion %)
- Hierarchical display IDs (1, 1.1, 1.2, etc.) in the # column
- Frozen # and Task columns (sticky positioning)
- Drag-to-reorder via grip handle
- Expand/collapse parent tasks
- Owner-colored bars
- Read-only vs editor mode
- Dependency link creation (keep the text-based approach in the Deps column -- no need to replicate SVAR's drag-to-link)
- Progress plot panel (unchanged -- separate component below the split pane)
- Weekend exclusion in date calculations (unchanged -- scheduling engine)

### Row height contract
- `ROW_HEIGHT = 34px` for all data rows (both table and SVG bars)
- Header height = table header height = time scale header height (must match exactly)
- SVG bar vertical position = `rowIndex * ROW_HEIGHT + headerHeight + verticalPadding`

### Time scale rendering
- Top row: month + year (e.g., "Mar 2026")
- Bottom row: day numbers (e.g., "23", "24", "25")
- Column width: configurable `DAY_WIDTH` (e.g., 30-40px per day)
- Weekend columns can be shaded differently

### Claude's Discretion
- SVG vs Canvas for bar rendering (SVG preferred for DOM interactivity and simpler implementation)
- Exact bar padding/margins within the 34px row
- Dependency arrow path shape (straight lines, bezier curves, or right-angle connectors)
- Whether to add bar hover tooltips in this phase
- Whether to support horizontal scroll via mouse wheel / shift+wheel
- Time scale date range calculation (auto-fit to task date range with padding)

</decisions>

<specifics>
## Specific Ideas

### Bar rendering
- Each bar is an SVG `<rect>` with `rx` for rounded corners
- Bar color from `owner.color`, with a semi-transparent overlay for the completion portion
- Bar height ~20-24px centered within the 34px row
- Task title optionally rendered inside the bar if it fits, otherwise tooltip on hover

### Dependency arrows
- SVG `<path>` elements connecting the right edge of upstream bars to the left edge of downstream bars
- Right-angle connector style (horizontal out, vertical, horizontal in) for clarity
- Color: muted gray, with highlight on hover (future enhancement)

### Scroll container structure
- Outer div: `overflow-y: auto; overflow-x: hidden` (vertical scroll for both panes)
- Table: `position: sticky; left: 0; z-index: 10` (frozen during horizontal scroll)
- SVG/timeline wrapper: natural flow, horizontally scrollable
- Timeline horizontal scroll: separate scrollbar below the SVG, or overflow-x on the SVG container

</specifics>

<deferred>
## Deferred Ideas

- Click-to-link dependency creation on Gantt bars (can be added later; text-based deps in table column is sufficient for now)
- Drag to resize bar duration
- Drag to move bar (change start date)
- Critical path highlighting
- Bar hover tooltips with task details
- Zoom in/out (change DAY_WIDTH)
- Mini-map / overview panel

</deferred>

---

*Phase: 05-unified-gantt-view*
*Context gathered: 2026-03-23*
