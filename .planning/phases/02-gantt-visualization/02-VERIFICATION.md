---
phase: 02-gantt-visualization
verified: 2026-03-16T16:55:00Z
status: human_needed
score: 8/8 must-haves verified
re_verification: false
human_verification:
  - test: "Owner-colored bars render with correct colors in browser"
    expected: "Task bars display in the owner's assigned color; unassigned tasks show #94A3B8 slate-400 neutral"
    why_human: "$color is passed as a custom field on ITask via open [key: string]: any — SVAR may or may not apply it automatically to bar fill color. Cannot verify visual rendering programmatically."
  - test: "Completion percentage renders as a progress fill inside bars"
    expected: "A bar set to 50% completion shows a visually distinct half-filled indicator within the bar"
    why_human: "progress field is wired to SVAR's ITask.progress — cannot verify visual fill rendering programmatically."
  - test: "Dependency arrows visually connect upstream to downstream bars"
    expected: "Tasks with finish-to-start dependencies show connecting arrows between their bars on the timeline"
    why_human: "Links are passed to SVAR as SvarLink objects with type 'e2s'. Arrow rendering is a SVAR internal visual concern."
  - test: "Scroll sync between task table and Gantt timeline"
    expected: "Scrolling the left task table vertically causes the Gantt to scroll in sync, and vice versa"
    why_human: "Bidirectional scroll sync uses scroll-chart events + scrollTop DOM manipulation — only verifiable interactively."
  - test: "Drag-and-drop link creation end-to-end"
    expected: "Hovering a task bar reveals a link handle; dragging to another bar creates a dependency arrow and a success toast appears"
    why_human: "SVAR link circle visibility and drag gesture are browser-interactive behaviors; API intercept wiring is verified programmatically but the UX gesture itself requires human testing."
  - test: "Circular dependency rejection on drag-and-drop"
    expected: "Dragging to create a cycle (e.g., B -> A when A -> B exists) shows an error toast and no arrow is created"
    why_human: "Pre-flight cycle detection is code-verified, but the interplay between SVAR's add-link event returning false and the absence of a visual arrow requires browser confirmation."
---

# Phase 2: Gantt Visualization Verification Report

**Phase Goal:** Users can see their renovation schedule as an interactive Gantt chart with colored bars, dependency arrows, and completion indicators
**Verified:** 2026-03-16T16:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees a split-pane view with hierarchical task list on left and Gantt timeline on right, scrolling in sync | ? NEEDS HUMAN | `page.tsx` lines 396-442: flex container, TaskTable at 55% width, GanttView at 45% with `showGrid={false}`. Scroll sync via `handleGanttInit`/`handleTableScroll` refs wired at lines 57-83. Visual confirmation required. |
| 2 | Each task displays as a horizontal bar colored by its owner's assigned color | ? NEEDS HUMAN | `gantt-adapter.ts` lines 59-62: `$color` field set to `ownerMap.get(t.ownerId)?.color` or `DEFAULT_NEUTRAL_COLOR`. Passed to SVAR via ITask open interface. Whether SVAR applies `$color` to bar fill needs visual confirmation. |
| 3 | Each task bar shows a fill indicator reflecting the task's completion percentage | ? NEEDS HUMAN | `gantt-adapter.ts` line 53: `progress: t.completionPct`. SVAR's ITask.progress is the standard progress field. Visual rendering must be confirmed. |
| 4 | Dependency lines visually connect upstream task bars to downstream task bars | ? NEEDS HUMAN | `gantt-adapter.ts` lines 70-77: `toSvarLinks` maps Dependency to SvarLink with `type: 'e2s'`. Links passed to `<Gantt links={svarLinks}>` in `GanttView.tsx` line 95. Arrow rendering is SVAR-internal. |
| 5 | Tasks without an owner display with a default neutral color | ✓ VERIFIED | `gantt-adapter.ts` line 60: `$color: t.ownerId ? (ownerMap.get(t.ownerId)?.color ?? DEFAULT_NEUTRAL_COLOR) : DEFAULT_NEUTRAL_COLOR`. Constant `'#94A3B8'` at line 30. Logic is correct for both null ownerId and missing owner lookup. |
| 6 | User can create a dependency by dragging from one Gantt bar to another | ? NEEDS HUMAN | `GanttView.tsx` lines 49-55: `api.intercept('add-link', ...)` wired, calls `onAddLink(String(ev.link.source), String(ev.link.target))` and returns false. `page.tsx` line 434: `onAddLink={handleAddLink}`. Code path is complete; gesture must be confirmed in browser. |
| 7 | The new dependency persists to Supabase and survives page refresh | ✓ VERIFIED | `page.tsx` lines 127-133: `handleAddLink` calls `addDependency(client, {...})` then `refetch()`. Full persistence chain code-verifiable. `addDependency` imported from `@/lib/supabase/queries` at line 17. |
| 8 | Circular dependency attempts show error toast and no link is created | ✓ VERIFIED | `page.tsx` lines 109-124: `detectCycle` imported at line 31, proposedDeps array constructed, `detectCycle(tasks, proposedDeps)` called, `toast.error(...)` and early return on non-null result. Guard fires before `addDependency`. |

**Score:** 8/8 truths have complete code implementations — 3 verified purely programmatically, 5 require visual/interactive human confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/gantt/gantt-adapter.ts` | Pure functions mapping ComputedTask/Dependency/Owner to SVAR ITask/ILink format; exports `toSvarTasks`, `toSvarLinks` | ✓ VERIFIED | 105 lines. Exports `toSvarTasks`, `toSvarLinks`, `treeSortTasks`. Uses `parseISO` for Date conversion. Owner color lookup via Map. Neutral default `#94A3B8`. |
| `src/components/gantt/gantt-config.ts` | SVAR scales, columns, and static Gantt configuration; exports `scales`, `columns` | ✓ VERIFIED | 18 lines. Exports `scales: IScaleConfig[]` (month+day) and `columns: IGanttColumn[]` (text column). Uses SVAR types. |
| `src/components/gantt/GanttView.tsx` | Client-only SVAR Gantt wrapper with SSR guard and Willow theme; min 30 lines | ✓ VERIFIED | 105 lines (exceeds min_lines 30). `'use client'` directive, `useState(false)` + `useEffect` SSR guard, `<Willow>` theme wrapper, `<Gantt>` with all required props, `api.intercept` for add-link, delete-link, and 5 task mutation blocks. |
| `src/app/page.tsx` | Restructured layout with GanttView, memoized transforms, link handlers | ✓ VERIFIED | 447 lines. Imports GanttView, toSvarTasks, toSvarLinks. Memoized `svarTasks`/`svarLinks`. `handleAddLink`/`handleDeleteLink` callbacks. Split-pane flex layout at lines 396-442. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `GanttView.tsx` | `@svar-ui/react-gantt` | `import Gantt, Willow` | ✓ WIRED | Line 4: `import { Gantt, Willow } from '@svar-ui/react-gantt'` |
| `gantt-adapter.ts` | `src/types/scheduling.ts` | `import ComputedTask, Dependency, Owner` | ✓ WIRED | Line 2: `import type { ComputedTask, Dependency, Owner } from '@/types/scheduling'` |
| `page.tsx` | `GanttView.tsx` | `import GanttView` | ✓ WIRED | Line 20: `import { GanttView } from '@/components/gantt/GanttView'`. Used at lines 431-441. |
| `page.tsx` | `gantt-adapter.ts` | `import toSvarTasks, toSvarLinks` | ✓ WIRED | Lines 21-25: `import { toSvarTasks, toSvarLinks, treeSortTasks }`. Used in useMemo at lines 94-101. |
| `GanttView.tsx` | `page.tsx` | `onAddLink callback -> addDependency -> refetch` | ✓ WIRED | `GanttView` calls `onAddLink` prop at line 52. `page.tsx` passes `handleAddLink` at line 434. `handleAddLink` calls `addDependency` at line 127. |
| `page.tsx` | `src/lib/supabase/queries.ts` | `addDependency call in handleAddLink` | ✓ WIRED | Line 17: `addDependency` imported from `@/lib/supabase/queries`. Called at line 127 inside `handleAddLink`. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VIS-01 | 02-01-PLAN | User can view tasks in a split-pane list + Gantt chart view | ? NEEDS HUMAN | Split-pane flex container code-verified in page.tsx lines 396-442; visual confirmation needed |
| VIS-02 | 02-01-PLAN | Gantt chart displays horizontal time bars for each task with owner-colored fills | ? NEEDS HUMAN | `$color` field wired through adapter into SVAR ITask; visual bar coloring needs browser confirmation |
| VIS-03 | 02-01-PLAN | Gantt chart displays dependency lines between connected tasks | ? NEEDS HUMAN | SvarLink objects passed to Gantt; arrow rendering is SVAR-internal visual concern |
| VIS-04 | 02-01-PLAN | Each task shows a completion % indicator on its Gantt bar | ? NEEDS HUMAN | `progress: t.completionPct` wired; visual fill indicator needs browser confirmation |
| OWN-04 | 02-01-PLAN | Task color on the Gantt chart is determined by its owner's color | ? NEEDS HUMAN | Color lookup logic code-verified; visual rendering needs browser confirmation |
| DEP-05 | 02-02-PLAN | User can create dependencies via drag-and-drop on the Gantt chart | ? NEEDS HUMAN | Full add-link intercept chain code-verified; drag gesture needs interactive testing |

All 6 requirements declared in plans are accounted for. No orphaned requirements — REQUIREMENTS.md traceability table maps exactly VIS-01 through VIS-04, OWN-04, and DEP-05 to Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

Scanned all 4 key files for: TODO/FIXME/HACK/PLACEHOLDER comments, empty implementations (`return null`, `return {}`, `return []`), console.log-only handlers, and stub patterns. None detected.

The two deferred items in `TODO-post-phase.md` (link circle UX refinement, Delete key for dependency deletion) are intentional post-phase deferrals documented by the user, not implementation gaps. They do not block any requirement in scope.

### Human Verification Required

#### 1. Owner-colored bars

**Test:** Create an owner with a vivid color (e.g., red `#EF4444`) via the Owner Manager. Assign that owner to a task. Inspect the task's Gantt bar.
**Expected:** The task bar fills with red. Unassigned tasks show a neutral slate-gray color.
**Why human:** The `$color` field is passed to SVAR via the open `[key: string]: any` interface on ITask. The SUMMARY notes SVAR honors this; visual confirmation required since color application is a SVAR internal CSS concern.

#### 2. Completion percentage fill indicator

**Test:** Open the task editor for any task and set completion to 50%. Return to the Gantt view.
**Expected:** The task bar shows a half-filled progress indicator (lighter vs darker fill or a distinct progress stripe inside the bar).
**Why human:** The `progress` field maps to SVAR's standard ITask.progress. Visual rendering is SVAR-internal.

#### 3. Dependency arrows on the timeline

**Test:** Ensure at least two tasks exist with a finish-to-start dependency. Inspect the Gantt timeline.
**Expected:** An arrow connects the end of the upstream task bar to the start of the downstream task bar.
**Why human:** SvarLink objects with `type: 'e2s'` are passed to SVAR. Arrow rendering is SVAR-internal.

#### 4. Split-pane scroll sync

**Test:** Add enough tasks to overflow the viewport. Scroll the left task table downward.
**Expected:** The Gantt timeline scrolls vertically in sync. Scrolling the Gantt also syncs the table.
**Why human:** Bidirectional scroll sync uses `api.on('scroll-chart')` + direct `scrollTop` DOM manipulation. The scroll event name and payload shape (`ev.top`) need live confirmation.

#### 5. Drag-and-drop dependency creation

**Test:** Hover over the right edge of a task bar. A circular handle should appear. Drag from that handle to a different task bar.
**Expected:** A dependency arrow appears between the two bars, and a "Dependency created" success toast appears.
**Why human:** The link circle CSS and drag gesture are browser-interactive. SVAR's `add-link` event firing and the `return false` suppression of SVAR's internal state update need live confirmation.

#### 6. Circular dependency rejection

**Test:** With tasks A and B where A depends on B, attempt to drag-create a dependency from B to A.
**Expected:** An error toast appears ("Circular dependency: ...") and no arrow is created.
**Why human:** The pre-flight `detectCycle` guard is code-verified, but whether SVAR visually suppresses the arrow (due to `return false` in the intercept) requires browser confirmation.

### Gaps Summary

No code gaps were found. All artifacts exist at full implementation depth, all key links are wired, all 6 requirements are covered by substantive code. The 5 "NEEDS HUMAN" truths are not defects — they are visual and interactive behaviors that cannot be verified programmatically. The underlying code paths are complete and correctly wired for each.

One implementation note worth flagging for the human verifier: the original plan called for the Gantt's built-in left pane (SVAR columns grid) to display task names, replacing TaskTable in the view. The final implementation deviates intentionally — TaskTable remains as the left pane with `showGrid={false}` on GanttView so SVAR renders timeline-only on the right. This is a correct and verified deviation documented in the SUMMARY. It satisfies VIS-01 (split-pane list + Gantt) while preserving TaskTable CRUD functionality.

---

_Verified: 2026-03-16T16:55:00Z_
_Verifier: Claude (gsd-verifier)_
