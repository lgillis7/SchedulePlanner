---
phase: quick-2
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/supabase/queries.ts
  - src/app/page.tsx
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "Visiting http://localhost:3000/ shows a list of all projects in the database"
    - "Each project is a clickable link that navigates to /schedule/{slug}"
    - "No more hardcoded redirect to a stale slug"
  artifacts:
    - path: "src/lib/supabase/queries.ts"
      provides: "getAllProjects query function"
      exports: ["getAllProjects"]
    - path: "src/app/page.tsx"
      provides: "Project listing home page"
      min_lines: 20
  key_links:
    - from: "src/app/page.tsx"
      to: "src/lib/supabase/queries.ts"
      via: "getAllProjects server call"
      pattern: "getAllProjects"
---

<objective>
Replace the hardcoded redirect on the home page with a project selection page that lists all projects from the database as clickable cards linking to their schedule view.

Purpose: The root URL currently redirects to `/schedule/kitchen-reno` which no longer exists (slug changed to `home-renovation`), causing a 404. Users need a way to discover available projects.
Output: A working home page at `/` that lists all projects with links to `/schedule/{slug}`.
</objective>

<context>
@src/lib/supabase/queries.ts
@src/app/page.tsx
@src/app/layout.tsx
@src/app/globals.css
</context>

<interfaces>
<!-- Existing query patterns from src/lib/supabase/queries.ts -->
```typescript
// Project type (from src/types/scheduling.ts)
export interface Project {
  id: string;
  name: string;
  includeWeekends: boolean;
}

// Existing pattern for server-side Supabase usage:
import { createClient } from '@/lib/supabase/server';
// const client = await createClient();

// Existing mapper:
function mapProject(row: Record<string, unknown>): Project { ... }
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add getAllProjects query and build project home page</name>
  <files>src/lib/supabase/queries.ts, src/app/page.tsx</files>
  <action>
1. In `src/lib/supabase/queries.ts`, add a new exported function `getAllProjects` that:
   - Accepts a `SupabaseClient` parameter (same pattern as other query functions)
   - Queries `projects` table: `client.from('projects').select('*').order('name')`
   - Maps results through existing `mapProject` function
   - Returns `Promise<(Project & { slug: string })[]>` -- NOTE: the existing `Project` type does NOT include `slug`. Rather than modifying the shared type (which would ripple), return a local extended type. Add a `mapProjectWithSlug` helper or extend inline:
     ```typescript
     export async function getAllProjects(client: SupabaseClient): Promise<Array<Project & { slug: string }>> {
       const { data, error } = await client.from('projects').select('*').order('name');
       if (error) throw new Error(`Failed to load projects: ${error.message}`);
       return (data as Record<string, unknown>[]).map(row => ({
         ...mapProject(row),
         slug: row.slug as string,
       }));
     }
     ```

2. Replace `src/app/page.tsx` entirely. Remove the hardcoded redirect. Make it a server component that:
   - Imports `createClient` from `@/lib/supabase/server` and `getAllProjects` from `@/lib/supabase/queries`
   - Imports `Link` from `next/link`
   - Calls `getAllProjects` to fetch all projects
   - Renders a centered page with:
     - Title "SchedulePlanner" using text-3xl font-semibold with the project's primary color
     - Subtitle "Select a project" in muted-foreground
     - A list/grid of project cards, each being a `Link` to `/schedule/${project.slug}`
     - Each card shows the project name, styled as a card with border, rounded corners, padding, hover:shadow-md transition
     - If no projects exist, show "No projects found" in muted text
   - Use Tailwind classes consistent with the existing design system (bg-card, text-card-foreground, border, etc.)
   - Keep it simple -- no client-side interactivity needed, pure server component
  </action>
  <verify>
    Run `npx next build 2>&1 | tail -20` -- build succeeds with no errors.
    Then verify manually: `npm run dev` and visit http://localhost:3000/ -- should show project list with "Home Renovation" linking to /schedule/home-renovation.
  </verify>
  <done>Root URL shows a project listing page. "Home Renovation" card links to /schedule/home-renovation. No more 404 from stale hardcoded slug.</done>
</task>

</tasks>

<verification>
- `npx next build` completes without errors
- Visiting http://localhost:3000/ renders a project selection page (not a redirect)
- Clicking a project card navigates to /schedule/{slug} and loads the Gantt view
</verification>

<success_criteria>
- Home page lists all projects from the database
- Each project links to its correct /schedule/{slug} URL
- The hardcoded kitchen-reno redirect is removed
- Page matches existing design system (Inter font, shadcn color tokens)
</success_criteria>
