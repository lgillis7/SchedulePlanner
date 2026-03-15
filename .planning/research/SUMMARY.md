# Project Research Summary

**Project:** SchedulePlanner — Home Renovation Gantt Tool
**Domain:** Web-based Gantt chart / home renovation project scheduling tool
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

SchedulePlanner is a well-scoped personal project management tool for home renovation scheduling. It sits in a well-understood problem space with clear constraints already defined: Vercel hosting, Supabase database, a shared passcode edit gate, and a read-only contractor view. The technology ecosystem for this type of application is mature and well-documented. The core technical challenge is not framework or library selection — those are settled — but rather implementing a correct scheduling engine (dependency graph resolution + date arithmetic) and successfully integrating a Gantt chart rendering library. Get these two pieces right, and the rest of the feature surface follows naturally.

The recommended stack is modern, current, and entirely free for this use case: Next.js 16 (stable Oct 2025, React 19.2, Turbopack), Supabase for PostgreSQL persistence, SVAR React Gantt 2.5 (MIT licensed, Jan 2026, native React) as the Gantt rendering library, Tailwind CSS 4.2, shadcn/ui, date-fns 4, and Zustand 5. The Gantt library decision is the single most important stack choice. SVAR React Gantt is the clear winner — the previously popular gantt-task-react is abandoned (last commit 2021, 129 open issues), frappe-gantt has no native React support, and commercial options (Bryntum, DHTMLX, SVAR PRO) are unnecessary for a personal tool. SVAR's free edition covers every feature in the project spec.

The dominant architectural risk is correctness, not scale. A renovation project will have under 200 tasks — performance is not the concern. The two failure modes that kill Gantt implementations are: (1) circular dependency detection not built in from the start, causing infinite loops or garbage dates when a user creates a dependency cycle, and (2) date arithmetic bugs at DST transitions and business-day boundaries that silently corrupt every downstream task's calculated dates. Both must be addressed in Phase 1, with exhaustive unit tests, before any UI work begins. Auth is simpler than it looks: a passcode cookie verified server-side with Supabase RLS for write protection is all that is needed — full Supabase Auth is overkill.

## Key Findings

### Recommended Stack

The full stack is Next.js 16 + Supabase + SVAR React Gantt (MIT) + Tailwind 4.2 + shadcn/ui + date-fns 4 + Zustand 5 + Zod 3. All packages are current stable versions, all run on Vercel without configuration, and all are free. The stack is coherent: Next.js 16 App Router with Server Components handles initial data load; the client scheduling engine computes derived dates; SVAR renders the Gantt chart in the browser; Supabase persists raw data. Zustand handles UI state (selected task, zoom level, view mode) without the re-render overhead of React Context — critical when the Gantt has hundreds of tasks.

Two important stack notes: (1) Tailwind 4 uses CSS-first configuration — there is no `tailwind.config.js`. All theme customization goes in a CSS file with `@theme`. (2) Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts` and deprecates `next lint` in favor of direct ESLint. Starting a new project on Next.js 15 would be a step backward.

**Core technologies:**
- **Next.js 16:** Full-stack React framework — App Router with Server Components for fast initial loads, Turbopack default for 5-10x faster dev builds
- **Supabase:** Database + auth infrastructure — PostgreSQL handles the relational task/dependency data model natively; RLS enforces read vs. write access
- **SVAR React Gantt 2.5:** Gantt chart rendering — MIT licensed, native React 18/19, free edition includes all 4 dependency types, drag-and-drop, hierarchy, and progress bars
- **Tailwind CSS 4.2:** Styling — zero-config with Next.js 16, CSS-first configuration
- **date-fns 4:** Date arithmetic — handles business day calculations, DST-safe date-only operations, weekend toggle logic
- **Zustand 5:** UI state — lightweight external store with selectors avoids React Context re-render overhead
- **Zod 3:** Schema validation — validates task data, dependency constraints, and form inputs in Server Actions

### Expected Features

SchedulePlanner's feature set divides cleanly into three tiers. The v1 MVP is everything needed to begin planning the actual renovation. The v1.x additions are features that become meaningful only after the schedule exists and the renovation starts. Everything else is deferred.

**Must have (table stakes — v1 MVP):**
- Task CRUD with hierarchy (3-4 levels) — the fundamental data unit
- Owner management with color assignment — contractor coordination from day one
- Duration and date calculation with weekend toggle — the scheduling math engine
- Finish-to-start dependencies with calculated (cascading) start dates — the core value proposition
- Dependency editing by task ID/line number — lightweight UX for wiring tasks
- Gantt chart rendering with owner-colored bars — the primary visualization
- Completion % tracking per task — needed to see where things stand
- Simple passcode auth gate — enables sharing with contractors immediately
- Read-only view (no passcode required) — contractors can view from day one
- Data persistence (Supabase) — survives page reload
- Single project support — multi-project can wait for v1.x

**Should have (differentiators — v1.x after validation):**
- Progress plot (time vs work-days-completed with desired/actual curves) — the killer feature unique to this tool; add once there is enough data to plot
- Manual "as built" checkpoints — snapshots for the progress curve; add alongside progress plot
- Multiple project support — add when/if a second project is needed
- List + Calendar view mode — add once Gantt view is solid
- Drag-and-drop dependency creation on Gantt bars — polish; add once ID-based dependency entry works
- Parent task roll-up of child dates and completion percentages

**Defer (v2+):**
- CSV/PDF export
- Critical path highlighting
- Baseline comparison (save a plan, compare against current)
- Task notes/comments per task
- Gantt zoom level controls (day/week/month)

**Anti-features to avoid:** Real-time collaboration, resource leveling, budget/cost tracking, external integrations (Google Calendar, Jira), user accounts with role-based permissions, undo/redo system, auto-scheduling/AI scheduling, mobile-native app, MS Project import, email notifications.

### Architecture Approach

The architecture follows a client-side scheduling engine pattern. The database stores only raw input data (desired start date, duration, dependencies). All derived dates (required start date, effective start date, end date) are computed in the browser after every data change using topological sort (Kahn's BFS algorithm) followed by a forward pass through the sorted task list. This avoids cascading database writes, eliminates the possibility of stored dates drifting out of sync, and is trivially fast for under 200 tasks (O(V+E), under 1ms). The Gantt chart re-renders from the computed schedule on every change.

Server Components handle the initial page load (fetching project + tasks + dependencies + owners from Supabase in a single server-side call). The data is passed to client components as props. The Gantt chart is always client-rendered (SVAR requires browser APIs). The scheduling engine (`lib/scheduling/`) is pure TypeScript with no React dependency, making it fully unit-testable in isolation.

**Major components:**
1. **Scheduling Engine (`lib/scheduling/`)** — topological sort, forward pass date calculator, cycle detection, weekend toggle logic; pure functions, no UI dependency; the most important code in the project
2. **SVAR React Gantt (`components/gantt/`)** — timeline visualization with dependency arrows, drag-and-drop date editing, owner-colored bars; wraps SVAR library with project-specific configuration
3. **Task List (`components/task-list/`)** — hierarchical table with inline editing; shares `ComputedTask[]` data with the Gantt chart
4. **Supabase Data Layer (`lib/supabase/`)** — typed query functions for all CRUD operations; server client for Server Components, browser client for mutations; all database access goes through these functions, never directly from components
5. **Passcode Gate (`app/[projectId]/edit/`, `proxy.ts`)** — httpOnly cookie checked in Next.js proxy.ts; RLS policies enforce write protection at the database level
6. **Progress Plot (`components/progress/`)** — recharts-based chart showing desired vs actual work-days-completed over time; checkpoint snapshots are manual (user-initiated)

**Data model highlights:** Hierarchical tasks via self-referencing `parent_task_id`. Dependencies as a join table (`task_dependencies`) with upstream/downstream task IDs. Computed dates (required_start, effective_start, end_date) are NOT stored in the database. Checkpoints are simple snapshots of total vs. completed work-days at a point in time.

### Critical Pitfalls

1. **Circular dependency detection absent from day one** — When a user creates task A depending on B and then B depending on A (or longer chains), the scheduling engine enters an infinite loop or produces garbage dates. Prevention: use Kahn's BFS-based topological sort before every recalculation; if `sorted.length < tasks.length` after the sort, a cycle exists — reject the dependency and tell the user which tasks form the loop. This must be in Phase 1, not bolted on later.

2. **Date arithmetic DST bugs and off-by-one errors** — JavaScript `Date` shifts by 1 hour at DST transitions, causing tasks to appear on the wrong day. Business day vs. calendar day confusion produces wrong end dates for every downstream task. Prevention: use `date-fns` for all date math, store dates as ISO date strings (`YYYY-MM-DD`) never as timestamps, define duration convention explicitly ("N days" means N working periods), build a `WorkCalendar` abstraction that centralizes the weekend toggle. Write exhaustive unit tests covering DST transition dates, Friday + 1 business day = Monday, weekend toggle in both states.

3. **Cascade recalculation storms causing UI freeze** — Naive reactive state (each task watching its predecessors) causes O(n²) or worse recalculation on every keystroke. Prevention: recalculate as a single synchronous pass in topological order — sort all tasks, walk the list once, one state update, one React render. Debounce recalculation on active typing (300ms idle or on blur). This is an architectural choice, not an optimization — changing it later requires rewriting the core engine.

4. **DOM rendering performance collapse at scale** — Each Gantt bar, arrow, grid line, and label is a DOM/SVG node. A 150-task renovation project can produce 2,000+ nodes. Prevention: use SVAR React Gantt (handles internal virtualization), virtualize the task list with `@tanstack/react-virtual`, test with 150+ tasks early before the architecture is locked in.

5. **Passcode auth enforced client-side only** — If RLS policies are missing on Supabase tables, anyone with the anon key can write data regardless of whether they have the passcode. Prevention: enable RLS on every table at creation time; use anon key with SELECT-only policies for the read-only view; validate passcode server-side and issue an httpOnly cookie; use service role key only in Server Actions behind passcode validation. Never trust client-side auth checks alone.

## Implications for Roadmap

Based on combined research, a 5-phase structure is recommended. The critical insight from architecture research is that the scheduling engine (Phase 1) must be correct and tested before any visualization (Phase 2) is attempted — wrong dates mean wrong bar positions, which poisons every test of the UI. Auth (Phase 3) must be established before the app is shared with contractors. Progress tracking (Phase 4) is meaningless until the project is actively underway.

### Phase 1: Foundation — Data Model + Scheduling Engine

**Rationale:** Everything depends on correct date calculations and a sound data model. The scheduling engine is the riskiest code in the project. Build and test it first, in isolation, before any UI complexity is added. Every feature in every subsequent phase depends on this being correct.

**Delivers:** Working PostgreSQL schema, TypeScript types, and a fully-tested scheduling engine that resolves dependencies, detects cycles, and calculates dates correctly for all edge cases (DST, business days, weekend toggle, zero-duration milestones).

**Addresses from FEATURES.md:** Task data model with hierarchy, owner data model, duration and date calculation, finish-to-start dependencies, weekend toggle, Supabase persistence, TypeScript foundation.

**Avoids from PITFALLS.md:** Circular dependency infinite loops (cycle detection built in from the start), DST date arithmetic bugs (date-fns + ISO strings from day one), cascade recalculation storms (topological sort engine designed correctly from the start), auth gaps (RLS policies established before any data is written).

**Stack elements:** Supabase CLI (local dev DB), `@supabase/supabase-js`, `@supabase/ssr`, `date-fns 4`, `zod 3`, TypeScript 5.

### Phase 2: Gantt Visualization + Task List

**Rationale:** Visualization is the core user experience and the second most complex piece. It depends on the scheduling engine from Phase 1. SVAR React Gantt needs to be integrated and proven working with Next.js App Router before auth and sharing are layered on.

**Delivers:** Working split-pane view (hierarchical task list on the left, Gantt chart on the right) with owner-colored bars, dependency arrows, completion fill, and basic task editing. Read-only by default, edit mode not yet gated.

**Addresses from FEATURES.md:** Gantt bar visualization, task list with visual tier formatting, owner color-coding on bars, completion % display, editable task properties (inline or panel), dependency display.

**Avoids from PITFALLS.md:** DOM rendering performance collapse (SVAR handles virtualization; test with 150+ tasks before signing off on Phase 2), Gantt scroll sync issues (task list and bars must scroll vertically in lock-step).

**Stack elements:** `@svar-ui/react-gantt 2.5`, `@tanstack/react-virtual`, `zustand 5`, `shadcn/ui` (dialogs, forms), `lucide-react`.

**Research flag:** SVAR React Gantt + Next.js 16 App Router integration needs validation. Verify `"use client"` behavior, SVAR's data binding API, event handler patterns, and Tailwind 4 CSS coexistence. Run `/gsd:research-phase` for Phase 2.

### Phase 3: Auth + Sharing + Deployment

**Rationale:** Once the core visualization works, make it shareable. Passcode auth and read-only contractor links are core to the product's purpose — the homeowner needs to share the schedule from day one of actual construction. Deploy to Vercel as part of this phase so real-world usage can begin.

**Delivers:** Passcode gate on edit routes (proxy.ts + httpOnly cookie + bcrypt), fully open read-only view (no auth), Supabase RLS policies enforcing write protection, Vercel deployment with environment variables.

**Addresses from FEATURES.md:** Simple passcode auth gate, read-only sharing via URL, data security at the database level.

**Avoids from PITFALLS.md:** RLS gaps where writes succeed without passcode (server-side enforcement, not client-side), service role key exposure in client-side code, passcode stored in plaintext (bcrypt hash in DB).

**Stack elements:** `@supabase/ssr` (cookie handling), `bcryptjs`, Next.js `proxy.ts`, Vercel environment variables.

**Research flag:** Supabase RLS with custom passcode auth (not standard Supabase Auth) is not officially documented. The pattern of anon key for reads + service_role behind server-side passcode validation for writes needs validation during implementation. Run `/gsd:research-phase` for Phase 3.

### Phase 4: Progress Tracking

**Rationale:** The progress plot is the killer differentiator — the feature no simple Gantt tool offers. It is meaningless until the renovation has actually started and completion percentages have been entered over several weeks. Build it after the core tool is deployed and in active use.

**Delivers:** Progress plot showing desired work-days-completed curve vs. actual as-built curve over time. Manual checkpoint button that snapshots current progress. The "are we ahead or behind" health check at a glance.

**Addresses from FEATURES.md:** Progress plot (time vs. work-days-completed), manual "as built" checkpoints, completion percentage roll-up.

**Avoids from PITFALLS.md:** Progress tracking accuracy issues (validate parent aggregation, boundary values 0%/100%, checkpoint data points on curve).

**Stack elements:** `recharts` (add in this phase, not before), Supabase `checkpoints` table.

### Phase 5: Polish + Secondary Views

**Rationale:** Refinements and secondary features that improve the tool once the core workflow is validated through actual renovation use.

**Delivers:** Calendar view mode (list + month grid alternative to Gantt), drag-and-drop dependency creation on Gantt bars, multiple project support, mobile responsiveness of read-only view, UX refinements (toast feedback when dependency changes cascade, minimum bar width, tree lines for hierarchy depth).

**Addresses from FEATURES.md:** Dual view modes (list+Gantt / list+Calendar), drag-and-drop dependency creation, multiple projects, mobile contractor view.

**Avoids from PITFALLS.md:** Calendar view UX uncertainty (not well-defined — research during this phase), mobile rendering failure on contractor's phone (375px viewport test).

**Research flag:** Calendar view mode implementation is not defined in existing research. Run `/gsd:research-phase` for Phase 5 when the time comes.

### Phase Ordering Rationale

- Phase 1 before Phase 2: The scheduling engine must produce correct dates before any bar is rendered at the correct pixel position. A rendering bug and a date bug look identical from the UI.
- Phase 2 before Phase 3: Need a working UI to validate end-to-end before adding auth gates. Testing auth on a broken UI wastes time.
- Phase 3 before Phase 4: The app must be deployed and shareable before progress tracking has meaning. Progress tracking is a feature for active construction, not planning.
- Phase 4 and Phase 5 can be reordered based on usage feedback. If the homeowner is actively renovating and needs the progress curve, do Phase 4 first. If the Gantt view feels incomplete, do Phase 5 refinements first.
- Multiple project support (Phase 5) is deferred because a single renovation is the immediate use case. Add only when actually needed.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2:** SVAR React Gantt integration with Next.js 16 App Router — verify `"use client"` behavior, data binding API, Tailwind 4 CSS coexistence, event handler patterns. SVAR is new (Jan 2026); integration details may differ from docs.
- **Phase 3:** Supabase RLS with custom passcode auth (not standard Supabase Auth) — the anon key + service_role + server-side passcode pattern is sound but not officially documented for this exact use case.
- **Phase 5:** Calendar view implementation — not researched. When building the list + calendar view, research what component approach to use (custom month grid vs. a lightweight calendar library).

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1:** Topological sort (Kahn's algorithm) and business day date arithmetic are canonical algorithms with extensive documentation and reference implementations.
- **Phase 4:** Recharts integration is straightforward and well-documented. Checkpoint data model is a simple INSERT pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified via official docs and release notes. Next.js 16 stable Oct 2025, SVAR 2.5 Jan 2026, Supabase 2.99.x, Tailwind 4.2 — all current. No version conflicts identified. |
| Features | HIGH | Requirements are explicit in PROJECT.md. Feature landscape mapped against competitor tools (TeamGantt, Instagantt, enterprise tools). MVP scope is well-defined and appropriately constrained. |
| Architecture | HIGH | Client-side scheduling engine is the standard pattern for sub-500-task Gantt tools. Data model is straightforward relational. Topological sort + forward pass is a canonical, well-tested algorithm. |
| Pitfalls | HIGH | Gantt chart failure modes are extensively documented across open-source issue trackers, production engineering blogs, and algorithm references. DST bug in frappe/gantt is a documented real-world example of the pattern to avoid. |
| SVAR Gantt Integration | MEDIUM | SVAR is relatively new (v2.5, Jan 2026). Features verified via official docs. Real integration with Next.js 16 App Router and Tailwind 4 CSS needs validation in Phase 2. Vendor blog used as a source (moderate bias). |

**Overall confidence:** HIGH

### Gaps to Address

- **SVAR React Gantt + Next.js 16 App Router:** SVAR docs confirm Next.js support, but the specific behavior with App Router SSR (SVAR will need `"use client"`), Server Component props passing, and hydration needs hands-on validation in Phase 2. If SVAR proves difficult to integrate, the fallback is custom SVG rendering (significant effort but doable for finish-to-start only).
- **Supabase RLS with custom passcode auth:** The recommended pattern (anon key for reads, service_role behind server-side passcode for writes) is architecturally sound but not an officially documented Supabase recipe. Validate the exact RLS policy syntax and cookie handling during Phase 3.
- **SVAR styling with Tailwind 4:** SVAR ships its own CSS. How it coexists with Tailwind 4's cascade layers needs investigation during Phase 2. May require scoped CSS overrides.
- **date-fns v4 API surface:** Major version bump from v3. Business day functions (`addBusinessDays`, `isWeekend`, `eachWeekendOfInterval`) need to be verified as available and working as expected in v4 before the date calculator is built.
- **Calendar view mode (Phase 5):** Not researched. Implementation approach (custom month grid vs. react-day-picker vs. another library) is undefined. Defer to Phase 5 planning.

## Sources

### Primary (HIGH confidence)
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) — Verified features, breaking changes, React 19.2 support, proxy.ts, Turbopack default
- [SVAR React Gantt Docs](https://docs.svar.dev/react/gantt/overview/) — Free vs PRO feature matrix, data API, React 18/19 support
- [SVAR React Gantt Homepage](https://svar.dev/react/gantt/) — Version 2.5, MIT license, Jan 2026 release
- [gantt-task-react GitHub](https://github.com/MaTeMaTuK/gantt-task-react) — Abandonment confirmed: last commit 2021, 129 open issues, v0.3.9
- [Supabase SSR Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — @supabase/ssr replaces deprecated auth-helpers
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — v2.99.1 current
- [Tailwind CSS v4.0 Blog](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first config, performance improvements, no tailwind.config needed
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policy syntax and patterns
- [Topological Sorting — Wikipedia](https://en.wikipedia.org/wiki/Topological_sorting) — Kahn's algorithm canonical reference
- [Use Supabase with Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) — Official quickstart

### Secondary (MEDIUM confidence)
- [SVAR Gantt Pricing](https://svar.dev/react/gantt/pricing/) — PRO at $524/dev
- [Top React Gantt Chart Libraries Compared 2026](https://svar.dev/blog/top-react-gantt-charts/) — Ecosystem overview (vendor blog, factually accurate)
- [shadcn/ui Date Picker](https://ui.shadchat.com/docs/components/radix/date-picker) — Calendar component on react-day-picker
- [Celoxis Gantt Chart Software Tools](https://www.celoxis.com/article/gantt-chart-software-tools) — Enterprise feature landscape
- [DST Timezone Bug in frappe/gantt — GitHub Issue #110](https://github.com/frappe/gantt/issues/110) — Real-world DST bug documentation
- [Next.js + Supabase: What I'd Do Differently](https://catjam.fi/articles/next-supabase-what-do-differently) — Production experience
- [SVG vs Canvas vs WebGL Benchmarks — SVG Genie](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025) — Rendering performance data
- [Gantt Chart UX Best Practices — Netronic](https://blog.netronic.com/how-to-improve-your-gantt-chart-user-experience) — UX pitfall patterns

### Tertiary (LOW confidence)
- [eJS Chart Gantt Comparison](https://www.ejschart.com/i-tried-three-open-source-javascript-gantt-charts-heres-what-actually-worked/) — Real-world usage comparison, single source

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
