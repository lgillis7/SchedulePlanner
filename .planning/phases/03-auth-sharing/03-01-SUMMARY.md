---
phase: 03-auth-sharing
plan: 01
subsystem: auth
tags: [jwt, jose, supabase-rls, passcode, middleware, slug-routing]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Supabase schema, types, query layer, project data model
  - phase: 02-gantt-viz
    provides: Page layout, GanttView, TaskTable, OwnerManager components
provides:
  - Passcode verification API (POST /api/auth/verify)
  - Auth status check API (GET /api/auth/status)
  - Lock/logout API (POST /api/auth/lock)
  - JWT signing/verification with jose (signEditorToken, verifyEditorToken)
  - Two-tier RLS migration (read open, write gated by auth.role())
  - Editor Supabase client factory (createEditorClient)
  - Slug-based project routing (/schedule/[slug])
  - Next.js middleware with x-is-editor header
  - getProjectBySlug query function
affects: [03-auth-sharing]

# Tech tracking
tech-stack:
  added: [jose]
  patterns: [two-tier-rls, custom-jwt-supabase, httponly-cookie-auth, slug-routing]

key-files:
  created:
    - src/lib/auth/passcode.ts
    - src/lib/auth/jwt.ts
    - src/app/api/auth/verify/route.ts
    - src/app/api/auth/status/route.ts
    - src/app/api/auth/lock/route.ts
    - src/lib/supabase/editor-client.ts
    - src/app/schedule/[slug]/page.tsx
    - src/app/schedule/[slug]/ScheduleClient.tsx
    - src/middleware.ts
    - supabase/migrations/00002_auth_rls_slug.sql
  modified:
    - src/app/page.tsx
    - src/lib/supabase/queries.ts

key-decisions:
  - "Constant-time byte comparison for passcode verification (XOR all bytes, no short-circuit)"
  - "JWT role: 'authenticated' (not custom 'editor' role) to match Supabase auth.role() expectations"
  - "365-day JWT expiry matching user requirement for persistent auth"
  - "Root / redirects to /schedule/kitchen-reno as canonical URL"

patterns-established:
  - "Two-tier RLS: SELECT open for all, INSERT/UPDATE/DELETE gated by auth.role() = 'authenticated'"
  - "Editor client pattern: createEditorClient(token) overrides Authorization header on anon client"
  - "Middleware sets x-is-editor header for server component auth state without re-verification"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 03 Plan 01: Auth Backend Summary

**Passcode-gated JWT auth with jose, three API routes, two-tier Supabase RLS migration, and slug-based project routing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T13:51:39Z
- **Completed:** 2026-03-17T13:55:07Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Auth infrastructure: passcode verification with Web Crypto SHA-256, JWT signing/verification with jose
- Three API routes: POST /verify (set httpOnly cookie), GET /status (check cookie), POST /lock (clear cookie)
- Supabase migration dropping permissive policies, creating two-tier RLS (SELECT open, writes gated by auth.role())
- Slug routing: /schedule/[slug] server page with ScheduleClient extraction, root redirect to /schedule/kitchen-reno
- Editor Supabase client factory and Next.js middleware with x-is-editor header

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth helpers, API routes, and Supabase migration** - `03d9b3b` (feat)
2. **Task 2: Editor Supabase client, slug routing, and middleware** - `a4c5c2f` (feat)

## Files Created/Modified
- `src/lib/auth/passcode.ts` - Passcode hash comparison using Web Crypto SHA-256
- `src/lib/auth/jwt.ts` - JWT signing and verification for editor tokens using jose
- `src/app/api/auth/verify/route.ts` - POST endpoint: verify passcode, issue JWT cookie
- `src/app/api/auth/status/route.ts` - GET endpoint: check if editor cookie is valid
- `src/app/api/auth/lock/route.ts` - POST endpoint: clear editor cookie
- `supabase/migrations/00002_auth_rls_slug.sql` - RLS policy update + slug column on projects
- `src/lib/supabase/editor-client.ts` - Supabase client factory using editor JWT for write access
- `src/lib/supabase/queries.ts` - Added getProjectBySlug query
- `src/app/schedule/[slug]/page.tsx` - Dynamic route server component for slug-based project access
- `src/app/schedule/[slug]/ScheduleClient.tsx` - Extracted page logic as client component with projectId prop
- `src/app/page.tsx` - Simplified to redirect to /schedule/kitchen-reno
- `src/middleware.ts` - Reads editor-token cookie and sets x-is-editor header

## Decisions Made
- Used constant-time XOR comparison for passcode hashing (not `===` on hash strings) for timing attack resistance
- JWT uses `role: 'authenticated'` to match Supabase's `auth.role()` function behavior with custom JWTs
- 365-day JWT expiry matches user requirement for persistent auth (no re-entry every visit)
- Root `/` redirects to `/schedule/kitchen-reno` as the canonical shareable URL

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

The following environment variables must be set before the auth system works:

- `SUPABASE_JWT_SECRET` - From Supabase Dashboard > Settings > API > JWT Secret
- `SCHEDULE_PASSCODE` - User-chosen passcode string (e.g., 'myReno2026')

The migration `00002_auth_rls_slug.sql` must be applied to the Supabase database.

## Issues Encountered

None

## Next Phase Readiness
- Auth backend complete, ready for Plan 02 to wire UI controls (passcode modal, edit toggle, auth context)
- Editor Supabase client factory available for Plan 02 to use for write operations
- Middleware sets x-is-editor header for server-side auth state detection

## Self-Check: PASSED

All 12 files verified present. Both task commits (03d9b3b, a4c5c2f) verified in git log. TypeScript compiles with zero errors.

---
*Phase: 03-auth-sharing*
*Completed: 2026-03-17*
