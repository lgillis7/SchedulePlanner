---
phase: 03-auth-sharing
plan: 02
subsystem: auth
tags: [react-context, passcode-modal, edit-toggle, read-only-mode, supabase-editor-client]

# Dependency graph
requires:
  - phase: 03-auth-sharing
    provides: JWT auth, API routes (verify/status/lock), editor Supabase client, slug routing, RLS policies
  - phase: 02-gantt-viz
    provides: GanttView, TaskTable, TaskRow, OwnerManager components
provides:
  - AuthProvider context with isEditor, isLoading, unlock, lock state management
  - PasscodeModal dialog for passcode entry with error handling
  - EditToggle lock/unlock button always visible in header
  - Read-only mode enforcement across all edit controls (TaskTable, TaskRow, OwnerManager, GanttView)
  - Editor Supabase client switching for mutations when authenticated
  - Session persistence via localStorage + httpOnly cookie
affects: [04-progress-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns: [auth-context-provider, conditional-edit-controls, dual-supabase-client]

key-files:
  created:
    - src/hooks/useAuth.tsx
    - src/components/auth/PasscodeModal.tsx
    - src/components/auth/EditToggle.tsx
  modified:
    - src/app/layout.tsx
    - src/app/api/auth/status/route.ts
    - src/app/schedule/[slug]/ScheduleClient.tsx
    - src/components/task-list/TaskTable.tsx
    - src/components/task-list/TaskRow.tsx
    - src/components/gantt/GanttView.tsx
    - src/lib/supabase/editor-client.ts
    - src/proxy.ts

key-decisions:
  - "AuthProvider wraps entire app in layout.tsx for global auth state access"
  - "Editor Supabase client created via createClient (not createBrowserClient) to avoid singleton caching"
  - "Middleware renamed to proxy for Next.js 16 convention compatibility"
  - "Read-only mode hides all edit controls while preserving scroll, hover, and expand/collapse interactivity"

patterns-established:
  - "Auth context pattern: useAuth() hook provides isEditor boolean for conditional UI rendering"
  - "Dual client pattern: anon client for reads, editor client with JWT for mutations"
  - "isEditor prop drilling: parent passes boolean to child components for edit/read-only gating"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 12min
completed: 2026-03-17
---

# Phase 03 Plan 02: Auth UI Summary

**Passcode-gated editing UI with AuthProvider context, lock/unlock toggle, read-only mode enforcement across all components, and editor Supabase client switching**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-17T14:01:19Z
- **Completed:** 2026-03-17T14:13:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- AuthProvider context managing isEditor state with session persistence via localStorage + httpOnly cookie validation
- PasscodeModal dialog with error handling and EditToggle always-visible lock/unlock button in header
- Read-only mode enforcement: hides Add Task, inline edit fields, delete buttons, owner manager, and Gantt drag handles
- Editor Supabase client switching for mutations when authenticated (JWT-backed writes)
- Human-verified end-to-end auth flow: read-only default, passcode unlock, edit mode, lock button, session persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: AuthProvider, PasscodeModal, and EditToggle components** - `f3cc4f4` (feat)
2. **Task 2: Wire auth state into ScheduleClient and existing components** - `54d0e68` (feat)
3. **Task 3: Verify auth flow end-to-end** - checkpoint:human-verify (approved)

Post-checkpoint fix: `9064bd5` (fix) - middleware rename and editor client singleton fix

## Files Created/Modified
- `src/hooks/useAuth.tsx` - AuthProvider context with isEditor, isLoading, unlock, lock state
- `src/components/auth/PasscodeModal.tsx` - Modal dialog for passcode entry with error handling
- `src/components/auth/EditToggle.tsx` - Lock/unlock button always visible in header
- `src/app/layout.tsx` - Wrapped children with AuthProvider
- `src/app/api/auth/status/route.ts` - Updated to return token value for editor client creation
- `src/app/schedule/[slug]/ScheduleClient.tsx` - Conditional edit controls, editor client switching, EditToggle in header
- `src/components/task-list/TaskTable.tsx` - isEditor prop gating for add/delete buttons
- `src/components/task-list/TaskRow.tsx` - isEditor prop gating for inline edit fields and delete button
- `src/components/gantt/GanttView.tsx` - isEditor prop gating for drag handles and link creation
- `src/lib/supabase/editor-client.ts` - Switched from createBrowserClient to createClient to avoid singleton
- `src/proxy.ts` - Renamed from middleware.ts for Next.js 16 convention

## Decisions Made
- AuthProvider wraps entire app in layout.tsx for global auth state access
- Editor Supabase client uses createClient (not createBrowserClient) to avoid singleton caching that prevented client switching
- Middleware renamed to proxy with export name change for Next.js 16 compatibility
- Read-only mode hides all edit controls while preserving interactive features (scroll, hover, expand/collapse)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed middleware.ts to proxy.ts**
- **Found during:** Post-Task 2 testing
- **Issue:** Next.js 16 changed middleware convention; the export name `middleware` was not recognized
- **Fix:** Renamed file to `src/proxy.ts` and export from `middleware` to `proxy`
- **Files modified:** src/proxy.ts (renamed from src/middleware.ts)
- **Verification:** Build succeeds, auth header propagation works
- **Committed in:** 9064bd5

**2. [Rule 1 - Bug] Fixed editor client singleton behavior**
- **Found during:** Post-Task 2 testing
- **Issue:** `createBrowserClient` from `@supabase/ssr` uses singleton pattern, preventing client switching between anon and editor
- **Fix:** Switched to `createClient` from `@supabase/supabase-js` which creates fresh instances
- **Files modified:** src/lib/supabase/editor-client.ts
- **Verification:** Editor client correctly uses JWT for mutations
- **Committed in:** 9064bd5

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct auth flow operation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## Next Phase Readiness
- Auth + Sharing phase fully complete -- all 3 requirements (AUTH-01, AUTH-02, AUTH-03) satisfied
- Ready for Phase 4: Progress Tracking
- No blockers or concerns for next phase

## Self-Check: PASSED

All 11 key files verified present. All 3 task commits (f3cc4f4, 54d0e68, 9064bd5) verified in git log.

---
*Phase: 03-auth-sharing*
*Completed: 2026-03-17*
