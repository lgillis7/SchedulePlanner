---
phase: 01-data-model-scheduling-engine
plan: 02
subsystem: scheduling
tags: [topological-sort, date-arithmetic, date-fns, vitest, tdd, dependency-graph]

# Dependency graph
requires:
  - phase: 01-data-model-scheduling-engine
    plan: 01
    provides: "Domain types (RawTask, ComputedTask, Dependency, CyclicDependencyError)"
provides:
  - "topologicalSort and detectCycle for dependency DAG processing"
  - "addWorkingDays for business/calendar day arithmetic"
  - "computeSchedule orchestrator producing ComputedTask arrays"
  - "vitest test infrastructure with path alias support"
affects: [02-gantt-chart-ui, 03-supabase-integration]

# Tech tracking
tech-stack:
  added: [vitest]
  patterns: [tdd-red-green-refactor, pure-functions, kahn-bfs-topological-sort]

key-files:
  created:
    - src/lib/scheduling/dependency-graph.ts
    - src/lib/scheduling/date-calculator.ts
    - src/lib/scheduling/scheduler.ts
    - src/lib/scheduling/__tests__/dependency-graph.test.ts
    - src/lib/scheduling/__tests__/date-calculator.test.ts
    - src/lib/scheduling/__tests__/scheduler.test.ts
    - vitest.config.ts
  modified:
    - package.json

key-decisions:
  - "Kahn's BFS for topological sort -- O(V+E), iterative (no stack overflow on deep graphs)"
  - "Shared kahnSort helper returns {sorted, remaining} for DRY between topologicalSort and detectCycle"
  - "date-fns parseISO + format for timezone-safe date arithmetic (no raw Date constructor)"
  - "Fractional durations ceiled to whole days (Math.ceil) -- convention for milestone/partial tasks"

patterns-established:
  - "Pure function modules: no side effects, no React/Next/Supabase imports in scheduling lib"
  - "TDD workflow: RED failing tests first, GREEN minimal implementation, REFACTOR shared helpers"
  - "ISO string date comparison via lexicographic ordering (YYYY-MM-DD format)"

requirements-completed: [TASK-06, TASK-07, TASK-08, DEP-01, DEP-03, DEP-04]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 1 Plan 2: Scheduling Engine Summary

**TDD scheduling engine with Kahn's topological sort, business/calendar day arithmetic, and full schedule computation -- 22 tests passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T04:13:48Z
- **Completed:** 2026-03-16T04:17:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Dependency graph module with topological sort (Kahn's BFS) and cycle detection -- 8 tests
- Date calculator with business day and calendar day arithmetic, weekend handling, fractional duration ceiling -- 7 tests
- Schedule computation orchestrator that chains dependency ordering with date math -- 7 integration tests
- Vitest test infrastructure configured with path aliases matching tsconfig

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD dependency graph** - `ddf889b` (feat)
2. **Task 2: TDD date calculator and scheduler** - `aadae7b` (feat)

_TDD: Each task includes RED (failing tests) and GREEN (implementation) in a single commit._

## Files Created/Modified
- `src/lib/scheduling/dependency-graph.ts` - Topological sort and cycle detection using Kahn's BFS
- `src/lib/scheduling/date-calculator.ts` - Business day and calendar day arithmetic via date-fns
- `src/lib/scheduling/scheduler.ts` - Full schedule computation orchestrator
- `src/lib/scheduling/__tests__/dependency-graph.test.ts` - 8 tests for DAG operations
- `src/lib/scheduling/__tests__/date-calculator.test.ts` - 7 tests for date arithmetic
- `src/lib/scheduling/__tests__/scheduler.test.ts` - 7 integration tests for schedule computation
- `vitest.config.ts` - Test runner config with @/ path alias
- `package.json` - Added vitest dev dependency and test script

## Decisions Made
- Used Kahn's BFS (not DFS) for topological sort -- iterative, no stack overflow risk on deep graphs
- Shared `kahnSort` internal helper returns `{sorted, remaining}` to avoid duplicating algorithm between topologicalSort and detectCycle
- Used date-fns `parseISO` and `format` for timezone-safe date handling (avoids `new Date()` timezone drift)
- Fractional durations ceiled to whole days via `Math.ceil` -- convention that partial days occupy at least one full day
- ISO date strings compared lexicographically (valid for YYYY-MM-DD format)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Scheduling engine complete and tested, ready for Gantt chart UI integration (Phase 2)
- All three modules are pure functions with zero framework dependencies
- Phase 1 Plan 3 (barrel exports / index module) can proceed

---
*Phase: 01-data-model-scheduling-engine*
*Completed: 2026-03-15*
