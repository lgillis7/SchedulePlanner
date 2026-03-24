---
phase: 05-unified-gantt-view
verified: 2026-03-23T00:00:00Z
status: human_needed
score: 9/10 must-haves verified
re_verification: false
human_verification:
  - test: "Open schedule page, scroll down in the table/Gantt and confirm table rows and SVG bars stay aligned through the full scroll range"
    expected: "Every row center aligns exactly with its Gantt bar center at every scroll offset — no drift"
    why_human: "Pixel alignment under scroll is a visual/spatial property that cannot be verified by static code inspection"
  - test: "Click a parent task collapse toggle. Verify the child rows AND their bars disappear together. Expand again and confirm they reappear perfectly aligned."
    expected: "No misalignment between row index and bar Y position after expand/collapse cycle"
    why_human: "React re-render after state change and resulting DOM layout cannot be asserted without a browser"
  - test: "Scroll right past the frozen table column — verify the task table stays pinned to the left while the Gantt timeline scrolls horizontally beneath it"
    expected: "Table column is sticky-left; Gantt SVG scrolls right"
    why_human: "CSS sticky behavior requires browser rendering to confirm; the style is present in code but needs visual confirmation"
  - test: "Verify dependency arrows draw correctly: right-angle path from upstream bar right-edge to downstream bar left-edge with arrowhead"
    expected: "Arrows visually connect upstream and downstream bars with no off-center or missing arrows"
    why_human: "SVG path coordinates depend on runtime dateToX values computed from actual task dates"
  - test: "As editor, test: inline title edit, date picker, duration edit, owner select, deps entry, completion % — confirm all still save correctly. Also drag a row to reorder it."
    expected: "All editing features work with no regressions; drag-to-reorder moves rows in both table and Gantt"
    why_human: "Functional correctness of UI interactions requires browser testing"
---

# Phase 5: Unified Gantt View Verification Report

**Phase Goal:** Table rows and Gantt bars are perfectly aligned in a single scroll container with unified vertical scrolling, correct expand/collapse, and no dependency on SVAR
**Verified:** 2026-03-23
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Every table row aligns pixel-perfectly with its Gantt bar at any scroll position | ? UNCERTAIN | `rowIndex * ROW_HEIGHT` is the shared constant (34px) used by both `GanttBar` (via `HEADER_HEIGHT + rowIndex * ROW_HEIGHT + BAR_Y_OFFSET`) and `TaskRow` (via `style={{ height: rowHeight }}`). Math is correct; visual confirmation needed. |
| 2  | Vertical scrolling moves both table and Gantt bars together (single scroll container) | ✓ VERIFIED | ScheduleClient.tsx lines 478-516: single `<div style={{ overflow: 'auto' }}>` wraps a flex row containing `<div style={{ position: 'sticky', left: 0 }}>` (table) and `<GanttChart />`. One scrollable ancestor guarantees unified scrollTop. |
| 3  | Horizontal scroll moves only the Gantt timeline while the table stays frozen | ✓ VERIFIED | Table wrapper: `position: 'sticky', left: 0, zIndex: 10, flexShrink: 0`. The inner flex container uses `minWidth: 'fit-content'`, so horizontal overflow goes to the SVG side while the table stays stuck. |
| 4  | Expanding/collapsing a parent task shows/hides bars and rows together | ✓ VERIFIED | `visibleTasks` is computed in ScheduleClient from `treeSchedule.filter(t => !hiddenIds.has(t.id))` (lines 151-154). The same array is passed to both `TaskTable` (line 493) and `GanttChart` (line 510). Collapse state change propagates identically to both. Visual alignment confirmation needed. |
| 5  | Dependency arrows connect upstream bar ends to downstream bar starts | ✓ VERIFIED | `GanttDependencyArrow.tsx`: right-angle SVG path from `sourceEndX,sourceCenterY` to `targetStartX,targetCenterY` via midX. `GanttChart.tsx` lines 71-93 compute sourceEndX as `dateToX(srcTask.endDate, ...)` and targetStartX as `dateToX(tgtTask.effectiveStartDate, ...)`. Logic is correct. |
| 6  | All existing editing features continue to work | ? UNCERTAIN | All edit handlers (`handleUpdateTask`, `handleDeleteTask`, `handleAddTask`, `handleAddSubtask`, `handleReorderTask`) are present and wired to the same callbacks. TaskRow contains all editing UI (inline cells, date picker, owner select, deps, completion). Code shows no regressions; browser test required. |
| 7  | Drag-to-reorder still works | ? UNCERTAIN | `TaskTable.tsx` lines 117-131: drag handlers present. `handleReorderTask` in ScheduleClient (lines 257-309) is substantive. `onReorder` is passed when `isEditor` (line 504). Cannot confirm drag behavior without browser. |
| 8  | Read-only mode hides edit controls while preserving Gantt view | ✓ VERIFIED | `isEditor` prop gates all edit UI in TaskRow (drag handle, EditableCell, date picker, owner select, deps, delete button). GanttChart receives no `isEditor` prop — it always renders bars/arrows/timescale regardless. |
| 9  | Progress plot panel still toggles correctly | ✓ VERIFIED | ScheduleClient lines 518-531: `{showProgress && (<div>...<ProgressPlot /></div>)}`. Toggle button on line 414. Logic unchanged from pre-phase code. |
| 10 | SVAR library fully removed from project | ✓ VERIFIED | No `@svar-ui` in package.json. No SVAR imports in `src/`. `GanttView.tsx` and `gantt-config.ts` absent. `gantt-adapter.ts` exports only `treeSortTasks`. TypeScript compiles clean. |

**Score:** 7/10 truths fully verified programmatically, 3/10 need human confirmation

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/gantt/gantt-utils.ts` | Date-to-pixel math, constants | ✓ VERIFIED | Exports `DAY_WIDTH=34`, `ROW_HEIGHT=34`, `BAR_HEIGHT=22`, `BAR_Y_OFFSET=6`, `HEADER_HEIGHT=40`, `DateRange`, `computeDateRange`, `dateToX`. 64 lines, substantive. |
| `src/components/gantt/GanttChart.tsx` | Main SVG container | ✓ VERIFIED | 121 lines. Composes all 4 sub-components. Uses `useMemo` for `ownerMap`, `range`, `taskIndexMap`, `weekendRects`, `arrows`. Accepts correct props. |
| `src/components/gantt/GanttBar.tsx` | SVG bar with owner color + completion fill | ✓ VERIFIED | 54 lines. Background rect (opacity 0.35) + conditional completion fill rect (opacity 0.85). Uses `dateToX`, `ROW_HEIGHT`, `BAR_HEIGHT`, `BAR_Y_OFFSET`, `HEADER_HEIGHT`. |
| `src/components/gantt/GanttTimescale.tsx` | Month+day header rows | ✓ VERIFIED | 107 lines. Top row: month+year labels with grouped rects. Bottom row: day numbers, weekend cells highlighted. Correct border/text CSS variables. |
| `src/components/gantt/GanttDependencyArrow.tsx` | Right-angle SVG path with arrowhead | ✓ VERIFIED | 50 lines. Path: `M sourceEndX sourceCenterY H midX V targetCenterY H targetStartX`. 4px arrowhead triangle at target. Stroke `#94A3B8`, strokeWidth 1.5. |
| `src/components/gantt/GanttTodayMarker.tsx` | Dashed red vertical line | ✓ VERIFIED | 28 lines. Computes `dateToX(today)`, returns null if `x < 0`, renders `<line>` with `stroke="#EF4444" strokeDasharray="4 3"`. |
| `src/app/schedule/[slug]/ScheduleClient.tsx` | Unified scroll container with sticky table + SVG Gantt | ✓ VERIFIED | Single `overflow:auto` div, flex row, sticky-left table div, GanttChart SVG. Both table and chart receive same `visibleTasks`. 535 lines, fully substantive. |
| `src/components/task-list/TaskTable.tsx` | Accepts `visibleTasks` prop from parent | ✓ VERIFIED | `visibleTasks?: ComputedTask[]` prop added (line 10). When provided, `hiddenIds` short-circuits to empty set (line 87). Internal `visibleTasks` falls back to prop-or-computed (line 106). |
| `src/components/gantt/gantt-adapter.ts` | Only `treeSortTasks` export (SVAR functions removed) | ✓ VERIFIED | 26 lines. Exports only `treeSortTasks`. No SVAR types, no `toSvarTasks`, no `toSvarLinks`. |
| `src/app/globals.css` | SVAR CSS overrides removed | ✓ VERIFIED | 131 lines of Tailwind/CSS variable configuration only. No `.wx-willow`, `.wx-gantt`, or other SVAR class rules present. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ScheduleClient.tsx` | `GanttChart.tsx` | `import { GanttChart } from '@/components/gantt/GanttChart'` | ✓ WIRED | Import on line 27. Rendered at line 509-514 with `visibleTasks`, `allTasks`, `owners`, `dependencies`. |
| `ScheduleClient.tsx` | `TaskTable.tsx` | `visibleTasks={visibleTasks}` prop pass | ✓ WIRED | `visibleTasks` prop passed at line 493. Both `TaskTable` and `GanttChart` receive the same reference. |
| `ScheduleClient scroll container` | sticky table + SVG | Single `overflow:auto` div with flex row | ✓ WIRED | `overflow: 'auto'` outer div (line 481). Inner `display: 'flex', minWidth: 'fit-content'` (line 487). Sticky wrapper `position: 'sticky', left: 0` (line 489). |
| `GanttChart.tsx` | `gantt-utils.ts` | `import { computeDateRange, dateToX, DAY_WIDTH, ... }` | ✓ WIRED | Lines 8-13. All layout constants used in SVG dimension calculations. |
| `GanttBar.tsx` | `gantt-utils.ts` | `dateToX`, `ROW_HEIGHT`, `BAR_HEIGHT`, `HEADER_HEIGHT` | ✓ WIRED | Lines 4-9. All constants drive pixel positioning: `x`, `width`, `y`, `height`. |

### Requirements Coverage

Both plans declare `requirements: []`. Phase 5 is an architectural improvement (replacing SVAR with custom SVG + unified scroll container) with no new user-facing requirements. It reinforces several previously-completed requirements:

| Requirement | Description | Status |
|-------------|-------------|--------|
| VIS-01 | Split-pane list + Gantt chart view | Still satisfied (table + SVG side by side) |
| VIS-02 | Gantt chart displays horizontal time bars with owner-colored fills | Satisfied by `GanttBar.tsx` |
| VIS-03 | Gantt chart displays dependency lines | Satisfied by `GanttDependencyArrow.tsx` |
| VIS-04 | Completion % indicator on Gantt bar | Satisfied by `GanttBar.tsx` completion fill rect |

No orphaned requirements — REQUIREMENTS.md contains no phase 5 specific entries.

Note: DEP-05 ("create dependencies via drag-and-drop on Gantt chart") was a v1 requirement that SVAR handled previously. The new custom SVG has no drag-to-link UI. This functionality was not listed in Phase 5 plan requirements, and the plan explicitly states "dependency creation stays text-based in the Deps column." DEP-05 appears to have been deferred/accepted as a regression — flagging for awareness but this was a conscious decision per 05-02-PLAN.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `GanttTodayMarker.tsx` | 15 | `return null` | ℹ️ Info | Intentional: only renders today marker when today falls within the chart range. Not a stub. |

No TODO, FIXME, placeholder comments, or empty implementations found in any phase files.

### Human Verification Required

#### 1. Row-to-Bar Pixel Alignment

**Test:** Open the schedule page (e.g., `http://localhost:3000/schedule/[project-slug]`). Compare the vertical center of each table row to the vertical center of its corresponding Gantt bar. Check the first row, a middle row, and the last row. Then scroll down halfway and check again.

**Expected:** Each row's center (at `rowHeight/2 = 17px` from the row top) matches the bar center (`BAR_Y_OFFSET + BAR_HEIGHT/2 = 6 + 11 = 17px` from the row's SVG band top). No visual drift at any scroll offset.

**Why human:** Pixel alignment under scrolling is a rendered DOM layout property. Static analysis confirms the math is consistent but cannot substitute for visual inspection.

#### 2. Expand/Collapse Alignment

**Test:** Open a project with parent tasks that have children. Click the collapse chevron on a parent row. Verify the child rows and their bars both disappear. Click expand. Verify they reappear with correct row-to-bar alignment.

**Expected:** After collapse/expand cycle, no row-bar misalignment. `visibleTasks` array reindexes correctly and both table and SVG update in lockstep.

**Why human:** React re-render timing and DOM layout after state change cannot be tested statically.

#### 3. Horizontal Sticky Behavior

**Test:** Scroll right on the unified container. Verify the task table (ID, title columns) stays pinned to the left edge while the Gantt timeline scrolls underneath it.

**Expected:** Table is sticky-left; the SVG Gantt timeline scrolls horizontally.

**Why human:** CSS `position: sticky` behavior depends on browser rendering and scroll container semantics that cannot be confirmed without a browser.

#### 4. Dependency Arrows Visual Accuracy

**Test:** Find two tasks with a finish-to-start dependency. Verify the dependency arrow starts at the right edge of the upstream bar and ends at the left edge of the downstream bar, connected by a right-angle path with an arrowhead.

**Expected:** Arrow is correctly anchored and not offset or missing.

**Why human:** Arrow coordinate correctness depends on runtime `dateToX()` values and specific task dates.

#### 5. Editing Features Regression Check

**Test (as editor):** (a) Click a task title and edit it inline. (b) Click a desired start date and change it via calendar picker. (c) Change duration. (d) Change owner via select. (e) Enter a dep ID in the Deps column. (f) Change completion %. (g) Drag a row using the grip handle to reorder it.

**Expected:** All 7 operations succeed and persist. No console errors.

**Why human:** User interaction flows and API calls cannot be verified statically.

### Summary

Phase 5 successfully replaces the dual-system architecture (custom table + SVAR Gantt with bidirectional scroll sync) with a unified single-scroll-container layout. All code-verifiable criteria pass:

- Six new SVG Gantt components built from scratch with correct math
- SVAR fully excised: package uninstalled, `GanttView.tsx` and `gantt-config.ts` deleted, no remaining imports
- Single `overflow:auto` container with sticky-left table and inline SVG — the architectural fix that guarantees scroll unification
- `visibleTasks` lifted to ScheduleClient and fed to both table and chart identically — the fix that guarantees expand/collapse synchronization
- TypeScript compiles clean with zero errors
- No anti-patterns, stubs, or placeholder implementations found

Five human verification items remain covering visual alignment, sticky scroll behavior, and editing feature regression — all of which require a browser to confirm.

One notable observation: DEP-05 (Gantt drag-to-create-dependencies) was previously satisfied by SVAR and is not implemented in the new custom SVG. This appears to be an accepted regression per the plan's explicit statement that "dependency creation stays text-based in the Deps column."

---

_Verified: 2026-03-23_
_Verifier: Claude (gsd-verifier)_
