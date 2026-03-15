# Pitfalls Research

**Domain:** Web-based Gantt chart / scheduling tool (home renovation)
**Researched:** 2026-03-15
**Confidence:** HIGH (well-documented domain with known failure modes)

## Critical Pitfalls

### Pitfall 1: Dependency Graph Becomes Circular Without Detection

**What goes wrong:**
Users create task A depending on B, and later B depending on A (or longer chains: A->B->C->A). Without cycle detection, the date calculation engine enters an infinite loop or produces nonsensical dates. This is the single most common Gantt chart implementation bug.

**Why it happens:**
Developers implement dependency resolution as simple recursive date propagation without first validating the graph structure. The dependency network is a directed graph, and any cycle makes it impossible to compute a valid topological ordering -- meaning no valid schedule exists.

**How to avoid:**
Model dependencies as a directed acyclic graph (DAG). Before every recalculation, run Kahn's algorithm (BFS-based topological sort) to detect cycles. Kahn's is preferred over DFS for this use case because it naturally identifies which nodes are in the cycle (they remain with unresolved in-degrees when the queue empties early). Reject the dependency addition that would create a cycle and show the user which tasks form the loop.

**Warning signs:**
- Date calculations produce dates far in the future or past
- Browser tab hangs during recalculation
- "Maximum call stack exceeded" errors in console
- Users report tasks with impossible dates

**Phase to address:**
Phase 1 (Core Data Model) -- the dependency graph validation must be designed into the data model from day one, not bolted on later. Every mutation to dependencies must pass cycle detection before persisting.

---

### Pitfall 2: Date Arithmetic Ignores Edge Cases (Weekends, DST, Off-by-One)

**What goes wrong:**
Three interrelated bugs that plague every Gantt implementation:

1. **Business days vs calendar days confusion:** A 3-day task starting Friday ends Monday (calendar) or Wednesday (business days). Mixing these in the same calculation produces wrong end dates for every downstream task.

2. **Daylight Saving Time shifts:** JavaScript `Date` objects silently shift by an hour during DST transitions. A task ending at midnight on the DST boundary can appear to end on the wrong day. This is a [documented bug in frappe/gantt](https://github.com/frappe/gantt/issues/110) -- when the Gantt start date is in a different timezone offset than a task date (due to DST), all time calculations drift by 1 hour, causing dates to display as the day after intended.

3. **Off-by-one on duration:** Does a 1-day task starting Monday end Monday or Tuesday? The convention matters, and inconsistency between display and calculation creates cascading errors.

**Why it happens:**
JavaScript's `Date` is notoriously bad for date-only arithmetic. Developers use `new Date()` and add milliseconds, which breaks at DST boundaries. The "weekend toggle" feature (present in this project's requirements) means every date calculation has a conditional branch, doubling the surface area for bugs.

**How to avoid:**
Use `date-fns` for all date arithmetic -- it handles date-only operations without timezone drift. Store dates as ISO date strings (`YYYY-MM-DD`), never as timestamps. Define duration convention explicitly: "duration N means the task occupies N working periods, end date = start date + N - 1 working days." Build a `WorkCalendar` abstraction that encapsulates the weekend toggle, so all date math flows through one tested path. Write exhaustive unit tests covering: Friday + 1 business day = Monday, DST transition dates, zero-duration milestones, and the weekend toggle in both states.

**Warning signs:**
- Tasks near DST transitions (March/November in US) show wrong dates
- Weekend toggle changes dates by wrong amounts
- Tasks show 1 day longer or shorter than expected
- End dates differ between list view and Gantt bar positions

**Phase to address:**
Phase 1 (Core Data Model) -- the date calculation engine is foundational. Every feature built on top (Gantt rendering, progress tracking, critical path) depends on correct dates. Build it first, test it exhaustively.

---

### Pitfall 3: Rendering Hundreds of DOM Elements Kills Performance

**What goes wrong:**
Each Gantt bar, dependency arrow, grid line, and label is a separate DOM element. A renovation project with 50-100 tasks at 4 levels deep, each with dependency arrows, grid lines, and labels, can easily produce 2,000+ DOM nodes. Scrolling becomes janky, drag interactions lag, and the page feels sluggish -- especially on mobile devices contractors might use to view the read-only schedule.

**Why it happens:**
The natural React approach (map tasks to `<div>` elements) creates real DOM nodes for every element. SVG-based rendering hits the same wall around 5,000 nodes. Developers build the happy path with 10 tasks and never test with realistic data volumes.

**How to avoid:**
For this project's scale (likely under 200 tasks), full Canvas rendering is overkill. Instead: virtualize the task list (only render rows visible in the viewport using a library like `@tanstack/react-virtual`), and use SVG for the Gantt bars (SVG performs well under 1,000 elements and supports CSS styling, click handlers, and accessibility better than Canvas). If dependency arrows become numerous, consider drawing them on a single Canvas overlay. Test with 150+ tasks early in development to catch performance issues before the architecture is locked in.

**Warning signs:**
- Scrolling stutters on the Gantt view
- React DevTools shows 500+ components rendering on scroll
- Lighthouse performance score drops below 70 on the Gantt page
- Contractor read-only view loads slowly on mobile

**Phase to address:**
Phase 2 (Gantt Visualization) -- when building the chart renderer, virtualization must be the architecture, not an optimization added later. Retrofitting virtualization into a non-virtualized renderer is essentially a rewrite.

---

### Pitfall 4: Cascade Recalculation Storms on Every Edit

**What goes wrong:**
Changing one task's duration triggers recalculation of all downstream dependents. Each dependent's date change triggers its own dependents. In a naive implementation, this causes O(n^2) or worse recalculation -- the entire dependency graph recalculates for every keystroke in a duration field. The UI freezes while dates cascade.

**Why it happens:**
Developers wire up reactive state (React state or Supabase real-time subscriptions) so that each task watches its predecessors. When one changes, all watchers fire, each one updating state and triggering another round of watchers. Without batching, a single edit can cause dozens of re-renders.

**How to avoid:**
Implement recalculation as a single synchronous pass using topological order: after any edit, sort all tasks topologically, then walk the sorted list once, computing each task's dates from its (already-computed) predecessors. This is O(V + E), guaranteed single-pass, and produces a single state update. Debounce recalculation during active editing (e.g., while the user is typing a duration, recalculate on blur or after 300ms idle, not on every keystroke). Batch the resulting state update into one React render.

**Warning signs:**
- UI freezes for 100ms+ after editing a task
- React Profiler shows cascading re-renders
- Multiple Supabase writes triggered by a single user edit
- Network tab shows rapid sequential database updates

**Phase to address:**
Phase 1 (Core Data Model) -- the recalculation engine design determines whether the system is O(n) or O(n^2). This is an architectural choice, not an optimization.

---

### Pitfall 5: Shared Passcode Auth Exposes Edit Access Too Broadly

**What goes wrong:**
The project spec calls for a single shared passcode for edit access. If this passcode is stored in a cookie or localStorage and the read-only link is shared with contractors, a contractor who inspects the page source or guesses the passcode gains edit access. There is no audit trail of who changed what, and no way to revoke a single person's access without changing the passcode for everyone.

**Why it happens:**
The project deliberately chose simplicity over security ("brittle passcode only"). This is a reasonable trade-off for a personal renovation tool, but the implementation can still go wrong if the passcode check is client-side only, or if Supabase RLS policies don't enforce the read-only vs. edit distinction at the database level.

**How to avoid:**
Enforce the passcode check server-side via a Next.js API route that issues a short-lived session token (stored in an httpOnly cookie). Use Supabase RLS policies that check for this token on write operations -- never rely on client-side checks alone. The read-only view should use Supabase's anon key with SELECT-only RLS policies. Even though this is a personal tool, treat the passcode as a write gate at the database level so that a compromised client cannot modify data.

**Warning signs:**
- Supabase dashboard shows RLS is disabled on tables
- Write operations succeed from the browser console without the passcode
- Passcode is visible in URL parameters or client-side JavaScript
- No distinction between read and write API calls

**Phase to address:**
Phase 1 (Core Data Model / Auth) -- RLS policies and auth flow must be established before any data is written. Retrofitting auth onto an app with existing data and no RLS is dangerous.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store dates as JS timestamps instead of ISO strings | Slightly easier date math | DST bugs, timezone confusion, display inconsistencies | Never -- use ISO date strings from day one |
| Client-side-only dependency validation | Faster to implement, no API calls | Data corruption if two users edit simultaneously or client is modified | MVP only, with plan to add server-side validation in Phase 2 |
| Hardcoded weekend days (Sat/Sun) | Simpler date calculation | Cannot support renovation scenarios where weekend work is normal for some tasks | Acceptable for MVP since the spec has a global weekend toggle, not per-task |
| Single database table for all task data | Simple schema, fast queries | Hierarchical queries become complex; moving subtrees requires updating many rows | Acceptable -- renovation projects are small enough that a flat table with parent_id works fine |
| No undo/redo system | Saves significant implementation effort | Users accidentally delete tasks or break dependencies with no recovery | Acceptable for MVP -- add undo in a later phase |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase RLS | Forgetting to enable RLS on new tables, leaving data publicly writable | Enable RLS on every table at creation time; use a migration that fails if RLS is not enabled |
| Supabase Realtime | Subscribing to entire table changes instead of filtered rows; hitting concurrent connection limits | Subscribe only to the current project's rows using filters; unsubscribe on unmount |
| Vercel + Supabase | Exposing `SUPABASE_SERVICE_ROLE_KEY` in client-side code via Next.js public env vars | Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client, service role key only in API routes/server components |
| Next.js App Router | Using `"use client"` on the Gantt page and losing SSR benefits; or trying to SSR a Canvas/SVG chart that requires browser APIs | SSR the task list/metadata, client-render only the Gantt visualization component |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-rendering entire task list on any task change | Visible stutter when editing, slow typing in input fields | Memoize task row components; use React.memo with stable keys; lift Gantt bar rendering out of list render cycle | 30+ tasks with dependencies |
| Unvirtualized task list | Initial page load takes 2+ seconds, scroll jank | Use @tanstack/react-virtual for the task list from the start | 50+ tasks (likely for a full renovation) |
| Recalculating all dates on Supabase realtime subscription | Every remote change triggers full recalc even if unrelated tasks changed | Diff incoming changes, only recalculate affected subgraph (tasks downstream of changed task) | 20+ tasks with dependencies |
| SVG dependency arrows with complex path calculations | Arrows lag behind bars during drag operations | Pre-calculate arrow paths, update only affected arrows on drag, use requestAnimationFrame | 30+ dependency relationships |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Passcode stored in plaintext in Supabase | Database breach exposes edit access | Hash the passcode with bcrypt; compare hashes server-side |
| RLS policies missing on task/project tables | Anyone with the Supabase URL and anon key can read/write all data | Write RLS policies before creating any application code; test with Supabase's SQL editor |
| Service role key in NEXT_PUBLIC_ env var | Full database access from any browser | Audit .env files; use `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix) only in server-side code |
| No rate limiting on passcode attempts | Brute-force passcode guessing | Add rate limiting in the Next.js API route (e.g., 5 attempts per minute per IP) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback when dependency creates a conflict | User adds dependency, dates silently shift, they don't understand why | Highlight affected tasks, show a toast: "Moving Task X pushed Task Y from Mar 5 to Mar 8" |
| Gantt bars too small to interact with at zoom levels | Users can't click or drag short-duration tasks | Enforce minimum visual width for bars (e.g., 20px); provide list-view editing as alternative |
| No indication of critical path | User doesn't know which tasks to prioritize | Highlight critical path tasks in a distinct color; show total project duration impact |
| Hierarchical indent unclear beyond 2 levels | 3-4 level nesting looks like a wall of slightly different text | Use visual connectors (tree lines), distinct background colors per level, and collapsible sections |
| Dependency lines overlap and become unreadable | Users can't trace which task depends on which | Route arrows with orthogonal paths, use color coding, highlight connected tasks on hover |
| Date picker doesn't respect business day settings | User picks a Saturday as start date when weekends are excluded | Grey out non-working days in the calendar picker when weekend exclusion is on |

## "Looks Done But Isn't" Checklist

- [ ] **Dependency calculation:** Often missing circular dependency detection -- verify by creating A->B->A and confirming it's rejected with a clear error message
- [ ] **Date calculation:** Often wrong at DST boundaries -- verify by creating a task spanning the March DST transition and checking end date
- [ ] **Business day toggle:** Often only affects display, not calculation -- verify by toggling and checking that downstream task dates actually shift
- [ ] **Progress percentage:** Often stored but not validated -- verify that completion % is 0-100, that parent tasks aggregate children, and that 100% tasks show visually distinct
- [ ] **Read-only view:** Often only hides UI controls but still allows API writes -- verify by opening browser console on read-only view and attempting a Supabase insert
- [ ] **Gantt scroll sync:** Often the task list and Gantt bars scroll independently -- verify by scrolling vertically in both panels and checking they stay aligned
- [ ] **Mobile rendering:** Often broken because Gantt bars assume desktop width -- verify contractor read-only view on a phone-sized viewport
- [ ] **Dependency arrows after reorder:** Often arrows point to wrong positions after tasks are reordered or filtered -- verify by collapsing a parent and checking arrows still connect correctly

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Circular dependency in database (no detection) | MEDIUM | Add cycle detection, write migration to scan existing data, break cycles by removing newest dependency |
| Wrong dates from DST bug | LOW | Fix date library usage, recalculate all dates in a single pass, verify with DST-spanning test cases |
| Performance collapse from DOM overload | HIGH | Requires architectural change to virtualization; essentially rewrite the Gantt renderer |
| Missing RLS policies (data exposed) | MEDIUM | Enable RLS, write policies, audit access logs for unauthorized access, rotate keys if compromised |
| Cascade recalculation O(n^2) | HIGH | Requires rewriting the recalculation engine to use topological sort; touches core architecture |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Circular dependencies | Phase 1: Core Data Model | Unit test: adding A->B->A returns error; A->B->C->A returns error with cycle path |
| Date arithmetic bugs | Phase 1: Core Data Model | Unit tests for DST transitions, weekend toggle, off-by-one, zero-duration milestones |
| DOM rendering performance | Phase 2: Gantt Visualization | Performance test: render 150 tasks, measure FPS during scroll, must stay above 30fps |
| Cascade recalculation storms | Phase 1: Core Data Model | Performance test: edit task with 50 downstream dependents, recalculation completes in < 50ms |
| Auth/RLS gaps | Phase 1: Core Data Model | Security test: unauthenticated client cannot write; read-only view cannot modify data via API |
| UX feedback on dependency changes | Phase 2: Gantt Visualization | Usability test: add dependency, verify toast/highlight shows which tasks moved and by how much |
| Mobile read-only view | Phase 3: Sharing & Polish | Test on 375px viewport; all task names visible; horizontal scroll for Gantt bars |
| Progress tracking accuracy | Phase 2 or 3: Progress Features | Verify parent aggregation, boundary values (0%, 100%), and progress curve data points |

## Sources

- [Gantt Chart Dependencies Guide - Teamhood](https://teamhood.com/project-management-resources/gantt-chart-dependencies/)
- [Common Gantt Chart Mistakes - TeamBoard](https://teamboard.cloud/common-mistakes-in-gantt-charts-project-management/)
- [Gantt Chart Pitfalls - LinkedIn](https://www.linkedin.com/advice/0/what-common-pitfalls-challenges-using-gantt-charts)
- [SVG vs Canvas vs WebGL Benchmarks - SVG Genie](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)
- [DST Timezone Bug in frappe/gantt - GitHub Issue #110](https://github.com/frappe/gantt/issues/110)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Security Retro 2025](https://supabase.com/blog/supabase-security-2025-retro)
- [Designing Timeline: Lessons from Asana - Medium](https://medium.com/asana-design/designing-timeline-lessons-learned-from-our-journey-beyond-gantt-charts-645e80177aaa)
- [Gantt Chart UX Best Practices - Netronic](https://blog.netronic.com/how-to-improve-your-gantt-chart-user-experience)
- [Topological Sorting - Wikipedia](https://en.wikipedia.org/wiki/Topological_sorting)
- [Critical Path Method - Asana](https://asana.com/resources/critical-path-method)
- [Virtualization for Large Lists - DEV Community](https://dev.to/maurya-sachin/virtualization-for-large-lists-in8)
- [React Gantt with Virtualization - GitHub](https://github.com/jaeungkim/gantt-chart)
- [Supabase Best Practices - Leanware](https://www.leanware.co/insights/supabase-best-practices)

---
*Pitfalls research for: Web-based Gantt chart / home renovation scheduling tool*
*Researched: 2026-03-15*
