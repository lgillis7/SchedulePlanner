# Stack Research

**Domain:** Web-based Gantt chart / project scheduling tool
**Researched:** 2026-03-15
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.x (latest) | Full-stack React framework | Already deploying to Vercel (first-class support), App Router with Server Components for fast initial loads, Turbopack default for 5-10x faster dev builds. Next.js 16 is stable as of Oct 2025 with React 19.2 support. |
| React | 19.2 | UI library | Ships with Next.js 16. View Transitions API for smooth navigation, useEffectEvent for cleaner effect logic. |
| TypeScript | 5.x | Type safety | Required by Next.js 16 (minimum 5.1). Essential for a data-heavy app with dependency graphs and date calculations. |
| Tailwind CSS | 4.2.x | Styling | Zero-config with Next.js 16, 5x faster builds than v3, cascade layers for clean component styling. No tailwind.config needed -- uses CSS-first configuration. |
| Supabase | supabase-js 2.99.x | Database, auth, realtime | Already has account. PostgreSQL under the hood -- perfect for relational project/task/dependency data. Realtime subscriptions for live updates if needed later. |

### Database Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @supabase/supabase-js | ^2.99 | Database client | Official client, isomorphic (works in Server Components and client). |
| @supabase/ssr | ^0.9 | Server-side auth/cookies | Required for Next.js App Router integration. Handles cookie-based auth in Server Components and proxy.ts (replaces middleware in Next.js 16). |
| Supabase PostgreSQL | (managed) | Relational database | Hierarchical tasks with dependencies is a graph problem -- PostgreSQL handles recursive CTEs, foreign keys, and computed columns natively. |

### Gantt Chart Rendering

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @svar-ui/react-gantt | ^2.5 | Gantt chart component | **Best open-source option for this project.** MIT licensed, native React (no wrapper), supports React 18/19, works with Next.js. Free edition includes: task dependencies (all 4 types), drag-and-drop scheduling, progress editing, hierarchical sub-tasks, zoom levels, context menus, and in-cell editing. This covers every Gantt requirement in the PROJECT.md. |

**Why SVAR over alternatives -- see Alternatives Considered below.**

### UI Components

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | latest | Pre-built accessible components | Buttons, dialogs, popovers, forms, toasts. Copy-paste model means no dependency bloat. |
| react-day-picker | ^9.x | Calendar/date picker | Used by shadcn/ui Calendar component. For the "desired start date" calendar popup. |
| lucide-react | latest | Icons | Default icon set for shadcn/ui. Consistent, tree-shakeable. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.x | Date arithmetic | Business day calculations, duration math, weekend toggle logic. Lightweight, tree-shakeable, no moment.js bloat. |
| zustand | ^5.x | Client state management | Lightweight store for UI state (selected task, view mode, zoom level). No Redux boilerplate. |
| zod | ^3.x | Schema validation | Validate task data, dependency constraints, form inputs. Works with Server Actions. |
| sonner | ^2.x | Toast notifications | Used by shadcn/ui for success/error feedback on CRUD operations. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Turbopack | Bundler | Default in Next.js 16. No configuration needed. |
| ESLint | Linting | Note: `next lint` removed in Next.js 16. Use ESLint directly with `@next/eslint-plugin-next`. |
| Prettier | Formatting | Pair with prettier-plugin-tailwindcss for class sorting. |
| Supabase CLI | Local dev DB | `supabase init` + `supabase start` for local PostgreSQL with migrations. Essential for testing RLS policies. |

## Installation

```bash
# Initialize Next.js 16 project
npx create-next-app@latest schedule-planner --ts --tailwind --app --turbopack

# Core dependencies
npm install @supabase/supabase-js @supabase/ssr @svar-ui/react-gantt

# UI components (shadcn/ui - init then add components as needed)
npx shadcn@latest init
npx shadcn@latest add button dialog popover calendar input label

# Supporting libraries
npm install date-fns zustand zod sonner lucide-react

# Dev dependencies
npm install -D prettier prettier-plugin-tailwindcss supabase
```

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| **@svar-ui/react-gantt** | gantt-task-react (MaTeMaTuK) | Last commit March 2021, 129 open issues, stuck at v0.3.9. Effectively abandoned. Would require forking to fix bugs. |
| **@svar-ui/react-gantt** | frappe-gantt | SVG-based, hard to customize styling. React wrappers are third-party and unmaintained. No native React component -- requires DOM manipulation wrappers that conflict with React's rendering model. |
| **@svar-ui/react-gantt** | dhtmlxGantt (free) | GPL license -- your app must also be GPL. Commercial license starts ~$599/dev. Heavy CSS that is hard to theme. Overkill for a personal renovation tool. |
| **@svar-ui/react-gantt** | Bryntum Gantt | Commercial only, $940+/dev. Way overkill for a personal project. |
| **@svar-ui/react-gantt** | Custom SVG/Canvas Gantt | Weeks of development for basic features. Dependency arrows, drag-and-drop resize, zoom levels -- each is a major undertaking. SVAR gives all of this out of the box in the free tier. |
| **@svar-ui/react-gantt** | SVAR Gantt PRO | $524/dev. PRO adds auto-scheduling, critical path, undo/redo, MS Project import. Nice-to-have but not needed for a renovation tracker. Start with free, upgrade only if auto-scheduling becomes essential. |
| **Next.js 16** | Next.js 15 | 15 still works but 16 is stable and current. Turbopack default, proxy.ts, Cache Components are all improvements. No reason to start a new project on 15. |
| **Tailwind CSS 4** | CSS Modules | Tailwind ships with create-next-app, zero config in v4. CSS Modules require more boilerplate for a data-heavy app with many small UI states. |
| **date-fns** | dayjs | dayjs is smaller but date-fns has better tree-shaking and TypeScript support. For business day calculations, date-fns has `eachWeekendOfInterval`, `isWeekend`, `addBusinessDays` built in. |
| **zustand** | React Context | Context causes re-renders of all consumers. Zustand uses external stores with selectors -- critical when the Gantt chart has hundreds of tasks and UI state changes frequently. |
| **zustand** | Redux Toolkit | Overkill for a single-user personal app. Zustand is ~1KB, Redux Toolkit is ~12KB. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| gantt-task-react | Abandoned since 2021. 129 open issues. Will hit bugs with no upstream fixes. | @svar-ui/react-gantt |
| frappe-gantt in React | SVG-based with DOM manipulation that fights React. All React wrappers are unmaintained third-party forks. | @svar-ui/react-gantt |
| @supabase/auth-helpers-nextjs | Deprecated. Replaced by @supabase/ssr. | @supabase/ssr |
| moment.js | Massive bundle size (300KB+), mutable API, officially in maintenance mode. | date-fns |
| middleware.ts | Deprecated in Next.js 16. Still works but will be removed. | proxy.ts |
| tailwind.config.js | Tailwind v4 uses CSS-first config (@theme in CSS). Config file approach is v3 legacy. | @import "tailwindcss" with @theme in CSS |

## Stack Patterns by Variant

**For the passcode auth pattern (this project):**
- Do NOT use Supabase Auth (email/password, OAuth). It's overkill for a shared passcode.
- Instead: Store a hashed passcode in a Supabase table. Validate client-side, set a cookie/session token. Use RLS policies that check for a valid session header or use the Supabase service role key in Server Actions behind passcode validation.
- Simplest approach: Use Supabase `anon` key for read-only access (contractor view), and validate passcode server-side in Next.js Server Actions before using `service_role` key for writes.

**For the progress plot (time vs work-days-completed):**
- Use a lightweight chart library. Recharts (~45KB) or chart.js with react-chartjs-2 are both solid choices.
- Recommendation: Add recharts when building the progress plot phase. Do not install upfront.

**If drag-and-drop dependency creation is needed:**
- SVAR Gantt free edition supports dependency management via task editing form and directly on the timeline. This likely covers the "drag-and-drop dependency creation" desirement without additional libraries.
- If more complex DnD is needed for list reordering: @dnd-kit/core (~15KB).

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 16.x | React 19.2, Node.js 20.9+ | Turbopack is default bundler. TypeScript 5.1+ required. |
| @svar-ui/react-gantt 2.5.x | React 18 and 19 | Works with Next.js App Router. Released Jan 2026. |
| @supabase/ssr 0.9.x | @supabase/supabase-js ^2.x | Use proxy.ts (not middleware.ts) for cookie refresh in Next.js 16. |
| Tailwind CSS 4.2.x | Next.js 16 | Zero-config. Uses CSS-first approach, no tailwind.config.js needed. |
| shadcn/ui | Tailwind CSS 4, React 19 | Check shadcn/ui docs for Tailwind v4 compatibility -- may need specific init flags. |
| date-fns 4.x | TypeScript 5+ | Major version bump from v3. Tree-shakeable ESM imports. |

## Sources

- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) -- Verified features, breaking changes, React 19.2 support (HIGH confidence)
- [SVAR React Gantt Docs](https://docs.svar.dev/react/gantt/overview/) -- Free vs PRO feature matrix (HIGH confidence)
- [SVAR React Gantt Homepage](https://svar.dev/react/gantt/) -- Version 2.5, MIT license, React 18/19 support (HIGH confidence)
- [SVAR Gantt Pricing](https://svar.dev/react/gantt/pricing/) -- PRO at $524/dev (MEDIUM confidence)
- [gantt-task-react GitHub](https://github.com/MaTeMaTuK/gantt-task-react) -- Last commit 2021, 129 issues, v0.3.9 (HIGH confidence)
- [Supabase SSR Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- @supabase/ssr replaces auth-helpers (HIGH confidence)
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) -- v2.99.1 current (HIGH confidence)
- [Tailwind CSS v4.0 Blog](https://tailwindcss.com/blog/tailwindcss-v4) -- CSS-first config, performance improvements (HIGH confidence)
- [Tailwind CSS Releases](https://github.com/tailwindlabs/tailwindcss/releases) -- v4.2.0 latest (HIGH confidence)
- [shadcn/ui Date Picker](https://ui.shadcn.com/docs/components/radix/date-picker) -- Calendar component built on react-day-picker (MEDIUM confidence)
- [Top React Gantt Chart Libraries Compared 2026](https://svar.dev/blog/top-react-gantt-charts/) -- Ecosystem overview (MEDIUM confidence -- vendor blog, but factually accurate)
- [Gantt Library Comparison on npm trends](https://npmtrends.com/dhtmlx-gantt-vs-frappe-gantt-vs-frappe-gantt-react-vs-gantt-task-react-vs-react-gantt-vs-react-google-charts) -- Download comparisons (MEDIUM confidence)
- [eJS Chart Gantt Comparison](https://www.ejschart.com/i-tried-three-open-source-javascript-gantt-charts-heres-what-actually-worked/) -- Real-world usage comparison (LOW confidence -- single source)

---
*Stack research for: SchedulePlanner -- Home Renovation Gantt Tool*
*Researched: 2026-03-15*
