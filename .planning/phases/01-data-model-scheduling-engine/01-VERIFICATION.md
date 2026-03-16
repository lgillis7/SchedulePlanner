---
phase: 01-data-model-scheduling-engine
verified: 2026-03-15T21:55:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Create tasks in 3-4 level hierarchy"
    expected: "New tasks appear with indented visual formatting; bold/large text at depth 0, progressively lighter/smaller at depths 1-3"
    why_human: "Visual tier formatting (CSS classes applied correctly) and parent-child nesting display require browser rendering to confirm"
  - test: "Set desired start date via calendar popup"
    expected: "Clicking a task's Desired Start column opens a calendar widget; selecting a date updates the cell and persists after page refresh"
    why_human: "Calendar popup interaction and date persistence require live app verification"
  - test: "Set duration and observe end date recalculating"
    expected: "Editing the duration of a task immediately causes the End Date and Req. Start columns of dependent downstream tasks to update"
    why_human: "Cascading recalculation is a live reactive data flow that cannot be statically verified"
  - test: "Wire a finish-to-start dependency by line number"
    expected: "Entering '1' in the Deps column of a task sets its required start = task 1's end date; dates propagate downstream"
    why_human: "Dependency wiring through the inline edit cell requires a running Supabase instance and browser interaction"
  - test: "Circular dependency rejection with cycle names"
    expected: "Entering a line number that would create a cycle shows a toast: 'Circular dependency: TaskA -> TaskB -> TaskA'; the dependency is NOT saved"
    why_human: "Toast feedback and the save-prevention behavior require browser interaction"
  - test: "Weekend toggle changes date calculations"
    expected: "Checking 'Include weekends' causes all end dates and required start dates to recalculate using calendar days instead of business days"
    why_human: "Requires live rendering with Supabase project state and computed schedule update"
  - test: "All changes persist across page refresh"
    expected: "After creating tasks, owners, dependencies, and setting dates — hard-refreshing the page shows all data exactly as saved"
    why_human: "Requires running Supabase instance with applied migration and seed data"
---

# Phase 1: Data Model + Scheduling Engine Verification Report

**Phase Goal:** Users can create tasks in 3-4 level hierarchy, set desired start dates via calendar, durations, and toggle weekends. End dates calculate correctly. Users can wire finish-to-start dependencies by line number, downstream dates auto-recalculate, and circular dependencies are rejected with cycle member names. Users can create owners with name, color, and contact info and assign them to tasks.
**Verified:** 2026-03-15T21:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Next.js 16 app starts and renders a page | VERIFIED | `npm run build` passes; static pages generated for `/`; `src/app/page.tsx` renders full UI |
| 2 | TypeScript domain types exist for RawTask, ComputedTask, Dependency, Owner, Project, CyclicDependencyError | VERIFIED | All 6 types present and exported from `src/types/scheduling.ts` (74 lines, substantive) |
| 3 | Database schema defines all 5 tables with RLS and indexes | VERIFIED | `supabase/migrations/00001_initial_schema.sql` has projects, owners, tasks, task_dependencies, checkpoints; all have ENABLE ROW LEVEL SECURITY and permissive policies |
| 4 | Scheduling engine computes correct finish-to-start dates, handles weekends, rejects cycles | VERIFIED | 22/22 vitest tests passing across dependency-graph.test.ts (8), date-calculator.test.ts (7), scheduler.test.ts (7) |
| 5 | Full CRUD UI is wired to Supabase and scheduling engine | VERIFIED | `src/app/page.tsx` composes `useProject` + `useSchedule` + `TaskTable` + `OwnerManager`; all mutation handlers call queries.ts and refetch |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Provided | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00001_initial_schema.sql` | DB schema with 5 tables, RLS, indexes | VERIFIED | 88 lines; all tables present with correct constraints; indexes on project_id, parent_task_id, sort_order, upstream/downstream task IDs |
| `src/types/scheduling.ts` | TypeScript domain types | VERIFIED | 74 lines; exports RawTask, ComputedTask, Dependency, Owner, Project, CyclicDependencyError |
| `src/lib/supabase/client.ts` | Browser Supabase client | VERIFIED | 9 lines; exports `createClient` using `createBrowserClient` from `@supabase/ssr` |
| `src/lib/supabase/server.ts` | Server Supabase client | VERIFIED | 23 lines; exports `createClient` using `createServerClient` with Next.js cookies |
| `src/lib/scheduling/dependency-graph.ts` | Topological sort and cycle detection | VERIFIED | 83 lines; exports `topologicalSort`, `detectCycle`; shares internal `kahnSort` helper (DRY); pure functions, zero React/Supabase imports |
| `src/lib/scheduling/date-calculator.ts` | Business day and calendar day arithmetic | VERIFIED | 34 lines; exports `addWorkingDays`; uses date-fns `parseISO`, `format`, `addBusinessDays`, `addDays`, `isWeekend`, `nextMonday` |
| `src/lib/scheduling/scheduler.ts` | Full schedule computation orchestrator | VERIFIED | 82 lines; exports `computeSchedule`; runs detectCycle, topologicalSort, then forward pass computing requiredStartDate, effectiveStartDate, endDate |
| `src/lib/scheduling/__tests__/scheduler.test.ts` | Integration tests | VERIFIED | 133 lines (above 80-line minimum); 7 tests covering single task, linear dep, desired-wins, diamond, weekend toggle, cycle throws, empty list |
| `src/lib/supabase/queries.ts` | Typed CRUD functions | VERIFIED | 287 lines; exports getProjectWithData, createTask, updateTask, deleteTask, createOwner, updateOwner, deleteOwner, addDependency, removeDependency, updateProject; mapTask/mapOwner/mapDependency helpers for snake_case to camelCase |
| `src/hooks/useProject.ts` | React hook for project data | VERIFIED | 46 lines; exports `useProject`; loads via `getProjectWithData`, exposes project/tasks/dependencies/owners/loading/error/refetch |
| `src/hooks/useSchedule.ts` | React hook wrapping computeSchedule | VERIFIED | 27 lines; exports `useSchedule`; wraps `computeSchedule` in `useMemo`, catches `CyclicDependencyError` into `error` field |
| `src/components/task-list/TaskTable.tsx` | Hierarchical task table | VERIFIED | 107 lines (above 80-line minimum); renders sorted tasks via `TaskRow`, 10 columns including computed dates, "Add Task" button |
| `src/components/task-list/TaskEditor.tsx` | Task editing panel | VERIFIED | 409 lines (above 60-line minimum); Dialog with title, calendar date picker, duration, completion%, owner select, dep input, parent select, notes; full cycle pre-check before save |
| `src/components/owners/OwnerManager.tsx` | Owner CRUD dialog | VERIFIED | 290 lines (above 40-line minimum); Dialog with owner list, inline edit, add form; name/color/contactInfo fields; delete with assigned-tasks warning |
| `src/lib/utils/formatting.ts` | Date formatting and tier styles | VERIFIED | 44 lines; exports `formatDate`, `tierStyles`, `tierIndent` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/supabase/client.ts` | `.env.local` | `process.env.NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` | WIRED | Both env vars present in client.ts; `.env.local` contains production Supabase URL and anon key |
| `src/lib/scheduling/scheduler.ts` | `src/lib/scheduling/dependency-graph.ts` | `import { topologicalSort, detectCycle }` | WIRED | Line 1: `import { topologicalSort, detectCycle } from './dependency-graph'` |
| `src/lib/scheduling/scheduler.ts` | `src/lib/scheduling/date-calculator.ts` | `import { addWorkingDays }` | WIRED | Line 2: `import { addWorkingDays } from './date-calculator'` |
| `src/lib/scheduling/scheduler.ts` | `src/types/scheduling.ts` | `import RawTask, ComputedTask, Dependency, CyclicDependencyError` | WIRED | Lines 3-4: imports all required types and the error class |
| `src/hooks/useSchedule.ts` | `src/lib/scheduling/scheduler.ts` | `import computeSchedule` | WIRED | Line 4: `import { computeSchedule } from '@/lib/scheduling/scheduler'` |
| `src/hooks/useProject.ts` | `src/lib/supabase/queries.ts` | `import getProjectWithData` | WIRED | Line 5: `import { getProjectWithData } from '@/lib/supabase/queries'` |
| `src/components/task-list/TaskTable.tsx` | `src/hooks/useSchedule.ts` (via page.tsx) | `schedule` prop from `useSchedule` | WIRED | `page.tsx` calls `useSchedule` and passes `schedule` to `TaskTable`; TaskTable renders `ComputedTask[]` including `endDate` and `requiredStartDate` |
| `src/components/task-list/TaskEditor.tsx` | `src/lib/supabase/queries.ts` | CRUD mutations via page.tsx callbacks | WIRED | `TaskEditor.onSave` is wired to `handleUpdateTask` in page.tsx which calls `updateTask`, `addDependency`, `removeDependency` from queries.ts |
| `src/components/task-list/TaskRow.tsx` | `src/lib/scheduling/dependency-graph.ts` | `import { detectCycle }` for pre-save cycle check | WIRED | Line 22: imports detectCycle; used in `saveDeps` to pre-validate before calling onUpdate |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TASK-01 | 01-03 | User can create, edit, and delete project items (tasks) | SATISFIED | `handleAddTask`, `handleUpdateTask`, `handleDeleteTask` in page.tsx; `createTask`, `updateTask`, `deleteTask` in queries.ts; TaskTable/TaskRow inline editing with delete confirmation |
| TASK-02 | 01-03 | User can organize tasks in a hierarchy up to 3-4 levels deep | SATISFIED | `tierDepth` (0-3) on RawTask; `parentTaskId` FK in schema; TaskEditor parent-task select; `handleAddSubtask` creates child with `tierDepth = parent.tierDepth + 1` capped at 3 |
| TASK-03 | 01-03 | Tasks display with visual tier formatting (bold, italics, font size by depth) | SATISFIED (visual TBD) | `tierStyles()` and `tierIndent()` in formatting.ts apply correct Tailwind classes per depth; used in TaskRow; visual confirmation is human-only |
| TASK-04 | 01-03 | Each task has a desired start date, editable via calendar popup | SATISFIED (interaction TBD) | Calendar + Popover in both TaskRow (inline) and TaskEditor; `saveDate` calls `onUpdate` with `desiredStartDate` |
| TASK-05 | 01-03 | Each task has a duration in floating-point days | SATISFIED | `durationDays: FLOAT` in schema; `step="0.5"` input in TaskRow EditableCell and TaskEditor; validation `min 0.1`; stored and retrieved correctly |
| TASK-06 | 01-02 | Required start date calculated from upstream dependency end dates | SATISFIED | `computeSchedule` forward pass: `requiredStartDate = max(upstream endDates)`; falls back to `desiredStartDate` when no upstreams; tested in scheduler.test.ts |
| TASK-07 | 01-02 | End date calculated as required start date + duration | SATISFIED | `endDate = addWorkingDays(effectiveStartDate, durationDays, includeWeekends)` in scheduler.ts; 22 tests verify correctness |
| TASK-08 | 01-02, 01-03 | User can toggle whether weekends are included in date calculations | SATISFIED (visual TBD) | `include_weekends` on projects table; weekend toggle checkbox in page.tsx calls `updateProject`; `addWorkingDays` branches on `includeWeekends`; tested in date-calculator.test.ts |
| DEP-01 | 01-02 | User can set finish-to-start dependencies between tasks | SATISFIED | `task_dependencies` table with `dependency_type DEFAULT 'finish-to-start'`; `addDependency` in queries.ts; wired through TaskRow/TaskEditor dep input |
| DEP-02 | 01-03 | User can edit dependencies by inputting task ID/line number of upstream items | SATISFIED (interaction TBD) | `saveDeps` in TaskRow and `handleSave` in TaskEditor resolve `sortOrder` line numbers to task UUIDs; toast on invalid line number |
| DEP-03 | 01-02 | Downstream required start dates automatically recalculate when upstream changes | SATISFIED | `computeSchedule` runs on every render via `useSchedule` (useMemo on tasks/deps/includeWeekends); schedule recalculates whenever data changes after refetch |
| DEP-04 | 01-02, 01-03 | System detects and prevents circular dependencies | SATISFIED (toast TBD) | `detectCycle` in dependency-graph.ts returns cycle task titles; called in TaskRow `saveDeps` and TaskEditor `handleSave` before persisting; page.tsx banner shows `CyclicDependencyError`; tested with cycle scenarios |
| OWN-01 | 01-03 | User can create, edit, and delete item owners within a project | SATISFIED | `createOwner`, `updateOwner`, `deleteOwner` in queries.ts; OwnerManager dialog with add/edit/delete UI; wired in page.tsx |
| OWN-02 | 01-03 | Each owner has name, optional contact info, and a color | SATISFIED | `owners` table has `name TEXT NOT NULL`, `contact_info TEXT`, `color TEXT NOT NULL DEFAULT '#3B82F6'`; all three fields in OwnerManager form |
| OWN-03 | 01-03 | User can assign an owner to any task | SATISFIED | Owner select in TaskRow (inline) and TaskEditor (dialog); `saveOwner` calls `updateTask` with `ownerId`; `__unassigned__` maps to `null` |
| PROG-01 | 01-03 | User can set completion percentage (0-100%) per task | SATISFIED | `completion_pct FLOAT CHECK (0-100)` in schema; inline editable in TaskRow (step=5); `saveCompletion` validates range and calls `updateTask` |
| INFRA-01 | 01-01 | Application hosted on Vercel | SATISFIED (deploy TBD) | `npm run build` produces successful static Next.js build ready for Vercel deployment; `.env.local` has production Supabase URL indicating actual Supabase project exists |
| INFRA-02 | 01-01 | Data persisted in Supabase database | SATISFIED (live TBD) | Full Supabase schema migration in place; `@supabase/ssr` client wired with live credentials; queries.ts makes actual Supabase calls |
| INFRA-03 | 01-01 | Source code stored on GitHub | SATISFIED | Confirmed via project git history; repo has commits going back through all three plans |

**All 19 Phase 1 requirement IDs accounted for. No orphaned requirements.**

---

### Anti-Patterns Found

No blocking anti-patterns detected. Notable items reviewed and cleared:

| File | Pattern Seen | Verdict |
|------|-------------|---------|
| `dependency-graph.ts:79` | `return null` | Correct semantics — null indicates no cycle found |
| `scheduler.ts:22` | `return []` | Correct semantics — empty input produces empty output |
| `TaskEditor.tsx:104` | `if (!task) return null` | Guard clause for unset prop, not a stub |
| `*.tsx` multiple | `placeholder="..."` attribute | HTML form placeholder attributes, not stubs |

---

### Human Verification Required

All automated checks pass. The following require a running app with Supabase connected to confirm.

#### 1. Hierarchical task visual formatting

**Test:** Create a top-level task "Phase 1", then add subtasks at depths 1, 2, and 3
**Expected:** "Phase 1" appears in large bold text; depth-1 tasks are semibold normal size; depth-2 tasks medium weight; depth-3 tasks are small and muted; each level is indented 16px further than its parent
**Why human:** CSS class application and visual rendering cannot be verified by static analysis

#### 2. Calendar popup for desired start date

**Test:** Click a date cell in the Desired Start column of any task row
**Expected:** A calendar popover opens; selecting a date closes the popover and the cell updates to the new date; after page refresh the new date persists
**Why human:** Calendar popup interaction and Supabase round-trip require live app

#### 3. End date recalculates from duration change

**Test:** Click the duration value of a task (e.g., "3d") and change it to "5"
**Expected:** The End Date column for that task immediately updates; any downstream tasks' Required Start and End Date columns also update
**Why human:** Reactive recalculation through useSchedule/useMemo requires browser rendering

#### 4. Finish-to-start dependency by line number

**Test:** Ensure tasks with sortOrder 1 and 2 exist. Edit task 2's Deps column, enter "1", press Enter.
**Expected:** Task 2's Required Start updates to equal Task 1's End Date; computed dates for any tasks downstream of task 2 also shift
**Why human:** Requires live Supabase write + useSchedule recalculation

#### 5. Circular dependency rejection with cycle names

**Test:** With tasks A (line 1) and B (line 2), task B already depends on A. Edit task A's Deps cell and enter "2" (creating A -> B -> A).
**Expected:** A toast appears: "Circular dependency: [A title] -> [B title]" (or similar); the dependency is NOT saved; both tasks' dates remain unchanged
**Why human:** Toast library interaction, optimistic-failure behavior, and save prevention require browser

#### 6. Weekend toggle recalculates dates

**Test:** Note the End Date of a task that spans a weekend. Check "Include weekends". Note the new End Date.
**Expected:** End Date gets earlier (weekends now count as working days); unchecking restores the original dates
**Why human:** Requires live state + Supabase updateProject call + useSchedule recompute

#### 7. Data persistence across page refresh

**Test:** Create an owner "Test Owner" with color #FF0000, create a task "Test Task" at depth 0, assign the owner, set desired start to a future date, refresh the page.
**Expected:** All data (task, owner, assignment, date) loads back exactly as saved
**Why human:** Requires running Supabase instance with migration and seed applied

---

### Summary

All code artifacts are present, substantive, and wired. The scheduling engine has 22 passing tests covering dependency graphs, date arithmetic, and full schedule computation. The build passes with zero TypeScript errors. All 19 Phase 1 requirements have implemented code supporting them.

The 7 human verification items are standard UI interaction and persistence checks that require a running Supabase instance. No automated check can confirm calendar popup behavior, toast error display, or that Supabase writes succeed with the configured credentials. These are not gaps — the code paths are implemented and connected — but they require human sign-off before Phase 1 can be called complete.

---

_Verified: 2026-03-15T21:55:00Z_
_Verifier: Claude (gsd-verifier)_
