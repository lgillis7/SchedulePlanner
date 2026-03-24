---
phase: 05-unified-gantt-view
plan: 02
subsystem: ui
tags: [svg, gantt, scroll-container, svar-removal, react]

requires:
  - phase: 05-unified-gantt-view
    provides: "Custom SVG Gantt components (GanttChart, bars, timescale, arrows, today marker)"
  - phase: 02-gantt-integration
    provides: "SVAR Gantt integration patterns and gantt-adapter.ts"
provides:
  - "Unified single-scroll-container layout with sticky table and SVG Gantt"
  - "SVAR library fully removed from project"
  - "visibleTasks lifted to ScheduleClient for shared state between table and chart"
affects: []

tech-stack:
  added: []
  removed: ["@svar-ui/react-gantt"]
  patterns: ["Single scroll container with sticky-left table and inline SVG Gantt", "Lifted visibleTasks computation to parent component"]

key-files:
  created: []
  modified:
    - src/app/schedule/[slug]/ScheduleClient.tsx
    - src/components/task-list/TaskTable.tsx
    - src/components/gantt/gantt-adapter.ts
    - src/app/globals.css
  deleted:
    - src/components/gantt/GanttView.tsx
    - src/components/gantt/gantt-config.ts

key-decisions:
  - "Single overflow:auto container with sticky-left table eliminates all scroll-sync complexity"
  - "visibleTasks lifted from TaskTable to ScheduleClient so both table and GanttChart share identical row sets"
  - "SVAR fully removed -- no incremental migration, clean cut"

patterns-established:
  - "Parent component owns visibility state, children receive pre-filtered task arrays"

requirements-completed: []

duration: 3min
completed: 2026-03-23
---

# Phase 5 Plan 2: Unified Scroll Integration and SVAR Removal Summary

**Replaced SVAR Gantt with custom SVG in a single scroll container -- pixel-aligned rows, unified scrolling, SVAR fully removed**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T01:50:00Z
- **Completed:** 2026-03-24T01:53:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 6 (4 modified, 2 deleted)

## Accomplishments
- Wired GanttChart SVG into ScheduleClient inside a single scroll container with sticky-left table
- Lifted visibleTasks/hiddenIds computation from TaskTable to ScheduleClient for shared state
- Removed all SVAR imports, scroll sync refs/handlers, and SVAR CSS overrides
- Uninstalled @svar-ui/react-gantt package and deleted GanttView.tsx and gantt-config.ts
- Visual verification confirmed pixel-aligned rows, unified scrolling, dependency arrows, and owner colors

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire GanttChart into unified scroll container** - `9457687` (feat)
2. **Task 2: Remove SVAR package and delete obsolete files** - `e70f1b6` (chore)
3. **Task 3: Visual verification** - checkpoint (approved by user)

## Files Created/Modified
- `src/app/schedule/[slug]/ScheduleClient.tsx` - Unified scroll container with sticky table + SVG Gantt, lifted visibleTasks
- `src/components/task-list/TaskTable.tsx` - Accepts optional visibleTasks prop from parent
- `src/components/gantt/gantt-adapter.ts` - Removed toSvarTasks/toSvarLinks, kept only treeSortTasks
- `src/app/globals.css` - Removed SVAR CSS overrides
- `src/components/gantt/GanttView.tsx` - DELETED (SVAR wrapper replaced by GanttChart)
- `src/components/gantt/gantt-config.ts` - DELETED (SVAR config replaced by gantt-utils constants)

## Decisions Made
- Single overflow:auto container with sticky-left table eliminates all bidirectional scroll-sync complexity
- visibleTasks lifted from TaskTable to ScheduleClient so both table and GanttChart consume identical row sets
- Clean-cut SVAR removal rather than incremental migration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Reported by User (Post-Verification)

The following issues were noted during visual verification and should be addressed in future work:

1. **Progress button position:** Move the progress toggle button to the bottom of the page
2. **Gantt chart width:** Chart occupies too small a portion of the screen -- should default to approximately half the screen width; table columns should be collapsible while row ID numbers always remain visible
3. **Dependency input bug:** Entering "1.1, 2.3" in the Deps column produces error "Failed to update task: Cannot coerce the result to a single JSON object"
4. **Delete button relocation:** Move delete button from Actions column to a hover icon just left of the task name, then remove the Actions column entirely

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 is the final planned phase -- all milestone phases complete
- The 4 user-reported issues above are candidates for quick-task execution
- No new phases or dependencies introduced

## Self-Check: PASSED

All 5 modified/created files verified present. Both deleted files confirmed absent. Both task commits (9457687, e70f1b6) confirmed in git log.

---
*Phase: 05-unified-gantt-view*
*Completed: 2026-03-23*
