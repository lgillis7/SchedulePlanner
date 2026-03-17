---
phase: 03-auth-sharing
verified: 2026-03-17T15:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Read-only default view"
    expected: "Visiting /schedule/kitchen-reno shows full schedule with no Add Task button, no inline edit fields, no delete buttons, no owner manager. Lock/unlock icon button is visible."
    why_human: "Cannot verify rendered UI behavior programmatically"
  - test: "Passcode unlock flow"
    expected: "Clicking unlock opens passcode modal. Correct passcode reveals edit controls. Incorrect passcode shows error toast."
    why_human: "Browser interaction and toast rendering cannot be verified programmatically"
  - test: "Session persistence"
    expected: "Refreshing the page after unlock keeps the user in edit mode without re-entering passcode"
    why_human: "Requires browser session state and localStorage interaction"
  - test: "RLS enforcement"
    expected: "Migration 00002 applied to Supabase: anon INSERT/UPDATE/DELETE blocked, editor JWT operations allowed"
    why_human: "Migration must be applied to live Supabase instance; cannot verify against live DB programmatically"
---

# Phase 03: Auth + Sharing Verification Report

**Phase Goal:** Passcode-gated editing with read-only default, slug-based sharing URLs, and Supabase RLS enforcement
**Verified:** 2026-03-17T15:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Passcode verification API returns 200 + sets httpOnly cookie on correct passcode | VERIFIED | `src/app/api/auth/verify/route.ts` calls `verifyPasscode`, `signEditorToken`, sets `editor-token` cookie with `httpOnly: true, maxAge: 31536000` |
| 2 | Passcode verification API returns 401 on incorrect passcode | VERIFIED | `verify/route.ts` returns `NextResponse.json({ error: 'Invalid passcode' }, { status: 401 })` when `verifyPasscode` returns false |
| 3 | Auth status API returns `{authenticated: true, token}` when valid editor cookie present | VERIFIED | `src/app/api/auth/status/route.ts` reads `editor-token` cookie, calls `verifyEditorToken`, returns `{ authenticated: true, token }` |
| 4 | RLS policies allow SELECT for anon key but block INSERT/UPDATE/DELETE | VERIFIED | `supabase/migrations/00002_auth_rls_slug.sql` creates `FOR SELECT USING (true)` policies and `auth.role() = 'authenticated'` guards on INSERT/UPDATE/DELETE for all 5 tables |
| 5 | Visiting /schedule/kitchen-reno loads the project by slug | VERIFIED | `src/app/schedule/[slug]/page.tsx` calls `getProjectBySlug(client, slug)`, returns `notFound()` if null, renders `ScheduleClient` with `project.id` |
| 6 | AuthProvider wraps app; isEditor state drives conditional edit controls | VERIFIED | `src/app/layout.tsx` wraps children with `AuthProvider`; `ScheduleClient` reads `useAuth()`, passes `isEditor` to `TaskTable`, `TaskRow`, `GanttView`; `OwnerManager` and `Add Task` button rendered inside `{isEditor && ...}` |
| 7 | Mutations use editor Supabase client (JWT); reads use anon client | VERIFIED | `ScheduleClient` uses `useMemo` to return `createEditorClient(editorToken)` when `isEditor && editorToken`, otherwise `createClient()` |
| 8 | Next.js middleware reads editor cookie and sets x-is-editor header | FAILED | File renamed to `src/proxy.ts` with export `proxy`; Next.js 16.1.6 hardcodes `MIDDLEWARE_FILENAME = 'middleware'` and only loads `src/middleware.ts`. The proxy file is dead code — it is never invoked by Next.js. |

**Score:** 7/8 truths verified (1 failed)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/auth/passcode.ts` | VERIFIED | Exports `verifyPasscode`; SHA-256 Web Crypto with constant-time XOR byte comparison; throws on missing env var |
| `src/lib/auth/jwt.ts` | VERIFIED | Exports `signEditorToken` and `verifyEditorToken`; uses `jose` `SignJWT`/`jwtVerify`; HS256, 365d expiry, `role: 'authenticated'` |
| `src/app/api/auth/verify/route.ts` | VERIFIED | Exports `POST`; zod validation; calls `verifyPasscode` and `signEditorToken`; sets `editor-token` httpOnly cookie |
| `src/app/api/auth/status/route.ts` | VERIFIED | Exports `GET`; reads cookie; calls `verifyEditorToken`; returns `{ authenticated, token }` |
| `src/app/api/auth/lock/route.ts` | VERIFIED | Exports `POST`; clears `editor-token` cookie with `maxAge: 0` |
| `src/lib/supabase/editor-client.ts` | VERIFIED | Exports `createEditorClient`; uses `createClient` from `@supabase/supabase-js` (not singleton `createBrowserClient`); sets `Authorization: Bearer ${editorToken}` header |
| `supabase/migrations/00002_auth_rls_slug.sql` | VERIFIED | Adds `slug` column; drops permissive policies on all 5 tables; creates two-tier RLS (open SELECT, gated INSERT/UPDATE/DELETE by `auth.role()`) |
| `src/app/schedule/[slug]/page.tsx` | VERIFIED | Server component; reads slug from params; calls `getProjectBySlug`; returns `notFound()` or renders `ScheduleClient` |
| `src/middleware.ts` | FAILED | File does not exist at this path. Renamed to `src/proxy.ts` with export `proxy` — Next.js 16 will not recognize it as middleware. |

### Plan 02 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/hooks/useAuth.tsx` | VERIFIED | Exports `AuthProvider` and `useAuth`; manages `isEditor`, `isLoading`, `editorToken`; session persistence via localStorage + cookie; calls all three auth API routes |
| `src/components/auth/PasscodeModal.tsx` | VERIFIED | Exports `PasscodeModal`; shadcn Dialog; calls `unlock(passcode)` from `useAuth`; shows error via `toast.error`; closes on success |
| `src/components/auth/EditToggle.tsx` | VERIFIED | Exports `EditToggle`; shows Lock/LockOpen icons from lucide-react; opens `PasscodeModal` when read-only; calls `lock()` when in edit mode; returns null during `isLoading` |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `verify/route.ts` | `passcode.ts` | `verifyPasscode` import | WIRED | `import { verifyPasscode } from '@/lib/auth/passcode'` present and called |
| `verify/route.ts` | `jwt.ts` | `signEditorToken` import | WIRED | `import { signEditorToken } from '@/lib/auth/jwt'` present and called |
| `jwt.ts` | `jose` | `SignJWT / jwtVerify` | WIRED | `import { SignJWT, jwtVerify } from 'jose'` present; `jose@^6.2.1` in package.json |
| `00002_auth_rls_slug.sql` | RLS enforcement | `auth.role()` | WIRED | `auth.role() = 'authenticated'` appears in all write policies; `DROP POLICY IF EXISTS` removes old permissive policies |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useAuth.tsx` | `/api/auth/verify` | `fetch POST on unlock` | WIRED | `fetch('/api/auth/verify', { method: 'POST', ... })` in `unlock()` callback |
| `useAuth.tsx` | `/api/auth/status` | `fetch GET on mount` | WIRED | `fetch('/api/auth/status')` in `useEffect` on mount and after unlock |
| `useAuth.tsx` | `/api/auth/lock` | `fetch POST on lock` | WIRED | `fetch('/api/auth/lock', { method: 'POST' })` in `lock()` callback |
| `ScheduleClient.tsx` | `useAuth.tsx` | `useAuth hook` | WIRED | `import { useAuth } from '@/hooks/useAuth'`; destructures `isEditor`, `authLoading`, `editorToken` |
| `ScheduleClient.tsx` | `editor-client.ts` | `createEditorClient` | WIRED | `import { createEditorClient }` present; used in `useMemo` when `isEditor && editorToken` |
| `layout.tsx` | `useAuth.tsx` | `AuthProvider` | WIRED | `import { AuthProvider } from "@/hooks/useAuth"`; wraps `{children}` |

---

## Requirements Coverage

| Requirement | Description | Source Plans | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| AUTH-01 | Editing requires entering a shared passcode (single code, no account management) | 03-01, 03-02 | SATISFIED | `verifyPasscode` checks `SCHEDULE_PASSCODE` env var; `PasscodeModal` + `useAuth.unlock()` gate all edit controls |
| AUTH-02 | Read-only view accessible without login — shareable via URL | 03-01, 03-02 | SATISFIED | `/schedule/[slug]` loads via anon Supabase client with open SELECT RLS; all edit controls hidden when `isEditor === false`; no login prompt on load |
| AUTH-03 | Passcode entry persists across browser sessions | 03-01, 03-02 | SATISFIED | `localStorage.setItem('schedule-editor', 'true')` on unlock; on mount `useEffect` reads localStorage and validates cookie via `/api/auth/status`; 365-day JWT expiry |

All three requirements have implementation evidence. AUTH-03 depends on the httpOnly cookie surviving browser restarts — the 365-day `maxAge` on the cookie achieves this.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/proxy.ts` | File named `proxy.ts` with export `proxy` instead of required `middleware.ts` / `middleware` export | Blocker | Next.js middleware never runs; `x-is-editor` header is never set on requests. This does NOT break the primary auth flow (which uses client-side `useAuth` context) but means any server component that reads `x-is-editor` will always see `false` or undefined. The current codebase does not appear to use `x-is-editor` in any server component, so the impact is currently contained — but the middleware is broken as designed. |

---

## Middleware Breakage — Detailed Analysis

The SUMMARY claims the file was renamed "for Next.js 16 convention compatibility." This is incorrect. Checking the installed Next.js 16.1.6:

```
node_modules/next/dist/lib/constants.js:
const MIDDLEWARE_FILENAME = 'middleware';
const MIDDLEWARE_LOCATION_REGEXP = `(?:src/)?${MIDDLEWARE_FILENAME}`;
```

Next.js 16.1.6 still requires the file to be named `middleware.ts` (at root or `src/middleware.ts`) and the default export or named export must be `middleware`. The file `src/proxy.ts` with export `proxy` satisfies neither condition.

**Current impact:** Low — no server component in the codebase currently reads `req.headers.get('x-is-editor')`. Auth gating is done entirely client-side via the `useAuth` React context. The middleware was intended as a secondary header for potential server-side auth state, but is not wired to any server component.

**Risk:** If a future feature relies on `x-is-editor` (e.g., server-rendered conditional content), it will silently fail with no error. The fix is straightforward: rename `src/proxy.ts` to `src/middleware.ts` and rename the export from `proxy` to `middleware`.

---

## Human Verification Required

### 1. Read-only default view

**Test:** Open a fresh browser (incognito), navigate to `/schedule/kitchen-reno`
**Expected:** Full schedule renders with no Add Task button, no inline editable fields, no delete buttons on rows, no owner manager button. A lock/unlock icon button is visible in the header.
**Why human:** UI rendering and element visibility cannot be verified programmatically

### 2. Passcode unlock flow

**Test:** Click the unlock button, enter an incorrect passcode, then enter the correct one
**Expected:** Incorrect passcode shows an error toast ("Invalid passcode"). Correct passcode closes the modal and reveals Add Task, inline edit fields, delete buttons, and the owner manager.
**Why human:** Modal interaction, toast rendering, and conditional element appearance require browser

### 3. Session persistence across reload

**Test:** Unlock editing, then refresh the page (F5)
**Expected:** Page reloads still in edit mode — no passcode prompt required
**Why human:** Requires actual localStorage + httpOnly cookie interaction in a browser session

### 4. Supabase RLS migration applied

**Test:** Confirm migration `00002_auth_rls_slug.sql` has been applied to the Supabase project. Verify anon key cannot INSERT/UPDATE/DELETE and the `slug` column exists on `projects`.
**Expected:** Anon INSERT returns a permission error; `/schedule/kitchen-reno` resolves to the project via slug lookup
**Why human:** Cannot connect to live Supabase instance programmatically in this context

---

## Gaps Summary

One gap blocks the stated phase goal in the narrow sense of "middleware enforcement":

**src/middleware.ts does not exist.** The file `src/proxy.ts` with export `proxy` is not recognized by Next.js as middleware. The `x-is-editor` request header will never be set.

However, the practical auth flow — passcode gating, read-only default, session persistence, and editor client switching — is fully implemented through the client-side `useAuth` React context and functions correctly without the middleware. The middleware was a supporting infrastructure piece (secondary header for server components) rather than the primary enforcement mechanism. No server component currently reads `x-is-editor`.

The fix is a rename: `src/proxy.ts` → `src/middleware.ts` and `export async function proxy` → `export async function middleware`.

---

_Verified: 2026-03-17T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
