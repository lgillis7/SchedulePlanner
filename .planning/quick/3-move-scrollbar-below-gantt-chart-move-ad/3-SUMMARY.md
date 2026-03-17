---
phase: quick-3
plan: 1
subsystem: ui
tags: [drag-and-drop, gantt, ux, html5-dnd]

requires:
  - phase: 01-data-model-scheduling
    provides: "Task table, sortOrder field, updateTask query"
provides:
  - "Inline add-subtask button next to task name (hover-visible)"
  - "Drag-to-reorder rows with sibling-only constraint"
  - "SVAR Gantt horizontal scrollbar always visible"
affects: [schedule-view, task-list]

tech-stack:
  added: []
  patterns:
    - "HTML5 drag-and-drop for row reordering (no external library)"
    - "group/row hover pattern for progressive disclosure of controls"

key-files:
  created: []
  modified:
    - src/components/task-list/TaskRow.tsx
    - src/components/task-list/TaskTable.tsx
    - src/app/schedule/[slug]/ScheduleClient.tsx
    - src/app/globals.css

key-decisions:
  - "HTML5 native drag-and-drop instead of external library (keeps bundle small)"
  - "Sibling-only reorder constraint -- cross-parent drops are silently ignored"

patterns-established:
  - "group/row hover class on tr for showing inline action buttons"

requirements-completed: []

duration: 3min
completed: 2026-03-17
---

# Quick Task 3: Move Scrollbar, Inline Add-Subtask, Drag-to-Reorder Summary

**Inline add-subtask button next to task names, SVAR Gantt scrollbar always visible, and HTML5 drag-to-reorder for sibling task ordering**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T18:26:58Z
- **Completed:** 2026-03-17T18:30:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Moved add-subtask (+) button from Actions column to inline next to task name, visible on row hover in editor mode
- Added CSS override to keep SVAR Gantt horizontal scrollbar always visible at bottom of chart pane
- Implemented drag-to-reorder with GripVertical handle, visual drop indicator, and sibling-only constraint
- Sort order persists to database via sequential sortOrder updates on all affected siblings

## Task Commits

Each task was committed atomically:

1. **Task 1: Move add-subtask button inline and relocate horizontal scrollbar** - `1bfbed9` (feat)
2. **Task 2: Add drag-to-reorder rows for task ordering** - `f213f1d` (feat)

## Files Created/Modified
- `src/components/task-list/TaskRow.tsx` - Inline + button, group/row hover, drag handle, drag event props
- `src/components/task-list/TaskTable.tsx` - Drag state management, onReorder prop, drag handle column header
- `src/app/schedule/[slug]/ScheduleClient.tsx` - handleReorderTask callback with sibling-only logic, flex-col right pane
- `src/app/globals.css` - SVAR .wx-scroll-x overflow-x: scroll override

## Decisions Made
- Used HTML5 native drag-and-drop instead of adding a library like dnd-kit (zero bundle cost, sufficient for row reorder)
- Sibling-only reorder constraint: cross-parent drops silently ignored to prevent accidental hierarchy changes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- All three UX improvements shipped and verified via build
- No blockers

---
*Quick Task: 3*
*Completed: 2026-03-17*
