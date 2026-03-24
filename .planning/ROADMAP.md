# Roadmap: SchedulePlanner

## Overview

SchedulePlanner delivers a web-based Gantt chart tool for home renovation scheduling in four phases. Phase 1 builds the data model, scheduling engine (dependency resolution, date arithmetic, cycle detection), and basic task/owner CRUD with Supabase persistence. Phase 2 adds the Gantt chart visualization with SVAR React Gantt -- the core user experience. Phase 3 gates editing behind a shared passcode and enables read-only contractor sharing. Phase 4 adds the progress plot with desired vs actual curves and manual checkpoints.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Model + Scheduling Engine** - Project scaffolding, Supabase schema, task/owner CRUD, dependency engine with cycle detection, date calculations with weekend toggle
- [x] **Phase 2: Gantt Visualization** - Split-pane task list + Gantt chart with owner-colored bars, dependency arrows, completion indicators, and drag-and-drop dependency creation
- [x] **Phase 3: Auth + Sharing** - Shared passcode gate for editing, open read-only view for contractors, session persistence, Supabase RLS enforcement (completed 2026-03-17)
- [x] **Phase 4: Progress Tracking** (completed 2026-03-17) - Progress plot with desired curve, current-state indicator, manual checkpoint snapshots, and as-built curve
- [ ] **Phase 5: Unified Gantt View** - Replace SVAR Gantt library with custom SVG bars in a single scroll container for guaranteed row alignment, unified scrolling, and correct expand/collapse

## Phase Details

### Phase 1: Data Model + Scheduling Engine
**Goal**: Users can create, organize, and edit a complete renovation schedule with hierarchical tasks, owners, and dependencies -- all dates calculate correctly
**Depends on**: Nothing (first phase)
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08, DEP-01, DEP-02, DEP-03, DEP-04, OWN-01, OWN-02, OWN-03, PROG-01, INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. User can create tasks organized in a 3-4 level hierarchy (e.g., Bathroom > Plumbing > Roughing > Drain install) with visual tier formatting
  2. User can set desired start dates via calendar popup, durations, and toggle weekend inclusion -- end dates and required start dates calculate correctly
  3. User can wire finish-to-start dependencies between tasks by ID, and downstream dates automatically recalculate when upstream dates change
  4. System rejects circular dependencies and tells the user which tasks form the cycle
  5. User can create owners with name, color, and contact info, and assign them to tasks
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffolding, Supabase schema, TypeScript domain types
- [x] 01-02-PLAN.md — Scheduling engine TDD (dependency graph, date calculator, forward pass)
- [x] 01-03-PLAN.md — Task/Owner CRUD UI, dependency editing, Supabase persistence

### Phase 2: Gantt Visualization
**Goal**: Users can see their renovation schedule as an interactive Gantt chart with colored bars, dependency arrows, and completion indicators
**Depends on**: Phase 1
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, OWN-04, DEP-05
**Success Criteria** (what must be TRUE):
  1. User sees a split-pane view with hierarchical task list on the left and Gantt timeline on the right, scrolling in sync
  2. Each task displays as a horizontal bar colored by its owner's assigned color, with a fill indicator showing completion percentage
  3. Dependency lines visually connect upstream task bars to downstream task bars
  4. User can create dependencies by dragging from one Gantt bar to another
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Install SVAR React Gantt, adapter layer, GanttView component, split-pane page layout
- [x] 02-02-PLAN.md — Drag-and-drop dependency creation with cycle detection and visual verification

### Phase 3: Auth + Sharing
**Goal**: Homeowner and wife can edit behind a passcode while contractors view the full schedule via a shared link without any login
**Depends on**: Phase 2
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. Visiting the schedule URL shows the full read-only view without any login prompt
  2. Editing requires entering a shared passcode; incorrect passcode is rejected
  3. After entering the correct passcode once, the user stays authenticated across browser sessions without re-entering it
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Auth backend: API routes, JWT infrastructure, RLS migration, slug routing, editor Supabase client
- [x] 03-02-PLAN.md — Auth UI: AuthProvider context, passcode modal, edit toggle, read-only mode enforcement

### Phase 4: Progress Tracking
**Goal**: Users can see at a glance whether the renovation is ahead or behind schedule, with a visual plot comparing planned vs actual progress over time
**Depends on**: Phase 3
**Requirements**: PROG-02, PROG-03, PROG-04, PROG-05, PROG-06
**Success Criteria** (what must be TRUE):
  1. User sees a progress plot with time on the x-axis and work-days-completed on the y-axis
  2. The plot displays a desired progress curve derived from each task's planned start date and duration
  3. The plot shows a glowing data point representing today's actual progress (sum of each task's completion % times its duration)
  4. User can click a checkpoint button to snapshot current progress, and saved checkpoints appear as an as-built curve on the plot
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Progress data layer: curve calculator, checkpoint type, Supabase queries, useCheckpoints hook
- [x] 04-02-PLAN.md -- Progress plot: Recharts ProgressPlot component, collapsible panel, Save Checkpoint button

### Phase 5: Unified Gantt View
**Goal**: Table rows and Gantt bars are perfectly aligned in a single scroll container with unified vertical scrolling, correct expand/collapse, and no dependency on SVAR
**Depends on**: Phase 4
**Requirements**: None (architectural improvement, no new user-facing requirements)
**Success Criteria** (what must be TRUE):
  1. Every table row aligns pixel-perfectly with its corresponding Gantt bar at any scroll position
  2. Vertical scrolling in either pane moves both panes in lockstep (single scroll container)
  3. Expanding/collapsing a parent task correctly shows/hides bars and rows together with no alignment drift
  4. Dependency arrows visually connect upstream bar ends to downstream bar starts
  5. All existing editing features (inline edit, date pickers, owner selects, drag-to-reorder, deps) continue to work
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md -- Build custom SVG Gantt components (bars, timescale, arrows, today marker, utils)
- [ ] 05-02-PLAN.md -- Integrate into ScheduleClient, remove SVAR, visual verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Model + Scheduling Engine | 3/3 | Complete | 2026-03-16 |
| 2. Gantt Visualization | 2/2 | Complete | 2026-03-16 |
| 3. Auth + Sharing | 2/2 | Complete | 2026-03-17 |
| 4. Progress Tracking | 2/2 | Complete | 2026-03-17 |
| 5. Unified Gantt View | 0/2 | Planning | - |
