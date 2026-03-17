# Phase 3: Auth + Sharing - Research

**Researched:** 2026-03-16
**Domain:** Passcode-gated editing with public read-only access (Supabase RLS + client-side auth state)
**Confidence:** HIGH

## Summary

Phase 3 adds a passcode gate for editing while keeping the schedule publicly viewable. The current app has no auth layer -- all RLS policies are `USING (true)` and every visitor gets full read/write via the anon key. The core challenge is enforcing read-only at the database level (RLS) while using a non-standard auth mechanism (shared passcode rather than Supabase Auth users).

The recommended approach is a **Next.js API route that verifies the passcode and issues a signed JWT (or sets a secure httpOnly cookie containing a token)**. The Supabase client then uses this token to satisfy RLS policies that distinguish readers from editors. On the client side, a React context tracks auth state, persisting it to localStorage so the passcode survives browser sessions.

**Primary recommendation:** Use a server-side API route to verify the passcode against a hashed env var, set an httpOnly cookie with a signed token, and write RLS policies that check for a custom claim in the JWT to allow mutations. Client-side, store a boolean flag in localStorage for UI state and use the cookie for actual authorization.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Interactive read-only mode: contractors can hover for tooltips, expand/collapse task groups, scroll/zoom the timeline — just can't edit
- Edit controls (input fields, drag handles, delete buttons) are completely hidden in read-only mode — clean, simplified view
- Visible unlock button (lock/edit icon) always present so authenticated users know editing is available
- After unlocking, a lock button allows voluntarily switching back to read-only mode — useful for previewing the contractor view
- Passcode authentication persists forever (localStorage) until user clears browser data or explicitly locks
- Multiple devices can be authenticated simultaneously — anyone with the passcode can edit from any device
- Passcode is set once in Supabase/environment config — no in-app passcode management UI
- Single URL for everyone — read-only by default, unlock button prompts for passcode to edit
- Project-specific path with readable slug (e.g., /schedule/kitchen-reno) rather than root URL or random ID
- Address bar URL is the shareable link — no dedicated share button, just copy the URL

### Claude's Discretion
- Passcode storage mechanism (hash vs token vs other secure approach)
- Supabase RLS policy design and enforcement details
- Passcode entry UI (modal, inline, separate page) — user skipped discussing this
- Error handling for incorrect passcode attempts

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Editing requires entering a shared passcode (single code, no account management) | Passcode verification via API route, JWT/cookie token issuance, RLS policies restricting mutations |
| AUTH-02 | Read-only view is accessible without any login — shareable via URL for contractors | Anon key provides SELECT access, RLS read policies remain open, UI hides edit controls when unauthenticated |
| AUTH-03 | Passcode entry persists across browser sessions (cookie/localStorage) so user doesn't re-enter every visit | httpOnly cookie for server auth + localStorage boolean for client UI state, no expiration |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.6 | API routes for passcode verification, middleware for cookie handling | Already in project, API routes are the standard server-side endpoint pattern |
| @supabase/ssr | 0.9.x | Server-side Supabase client with cookie-based auth | Already in project, handles cookie↔Supabase auth plumbing |
| @supabase/supabase-js | 2.99.x | Client-side Supabase with RLS enforcement | Already in project |
| bcrypt (or Web Crypto API) | N/A | Passcode hashing for comparison | Web Crypto `subtle.digest` available in Next.js edge/server without extra deps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jose | 5.x | JWT signing/verification for custom tokens | If using custom JWT approach for Supabase RLS; lightweight, edge-compatible |
| lucide-react | 0.577.x | Lock/Unlock icons for edit toggle button | Already in project |
| sonner | 2.x | Toast notifications for auth success/failure | Already in project |
| zod | 4.x | Validate passcode input on server | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom JWT + RLS | Supabase signInAnonymously + metadata | Simpler but couples to Supabase Auth, creates phantom user rows |
| jose (JWT library) | jsonwebtoken | jsonwebtoken is not edge-compatible; jose works in all Next.js runtimes |
| httpOnly cookie | localStorage-only token | localStorage alone cannot enforce server-side security; cookie is needed for RLS |

**Installation:**
```bash
npm install jose
```
Only `jose` is new. Everything else is already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── verify/route.ts    # POST: verify passcode, set cookie
│   ├── schedule/
│   │   └── [slug]/
│   │       └── page.tsx           # Dynamic route for project by slug
│   ├── layout.tsx
│   └── page.tsx                   # Redirect to /schedule/kitchen-reno (or keep as-is)
├── components/
│   ├── auth/
│   │   └── PasscodeModal.tsx      # Passcode entry dialog
│   │   └── EditToggle.tsx         # Lock/unlock button in header
│   └── ... (existing)
├── hooks/
│   └── useAuth.ts                 # Auth state context + localStorage persistence
├── lib/
│   ├── auth/
│   │   ├── passcode.ts            # Hash comparison, token creation
│   │   └── middleware.ts           # Cookie validation helper
│   └── supabase/
│       └── ... (existing)
└── middleware.ts                   # Next.js middleware: read cookie, pass auth state
```

### Pattern 1: Two-Tier RLS (Read Open, Write Gated)
**What:** RLS policies that allow SELECT for everyone (anon key) but require a valid auth token for INSERT/UPDATE/DELETE.
**When to use:** This exact phase — public read, passcode-gated write.
**Approach:**

Current policies are `USING (true) WITH CHECK (true)` which allows everything. Replace with:

```sql
-- Read: anyone with anon key can SELECT
CREATE POLICY "Public read" ON tasks FOR SELECT USING (true);

-- Write: only authenticated editors
CREATE POLICY "Editor write" ON tasks FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'editor'
  );

CREATE POLICY "Editor update" ON tasks FOR UPDATE
  USING (
    current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'editor'
  );

CREATE POLICY "Editor delete" ON tasks FOR DELETE
  USING (
    current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'editor'
  );
```

The custom JWT issued after passcode verification includes `"role": "editor"` in its claims. The anon key JWT has `"role": "anon"`.

### Pattern 2: Custom JWT for Supabase Auth
**What:** Sign a JWT with the Supabase JWT secret that contains editor claims, then use it as the Supabase access token.
**When to use:** When you need RLS enforcement without Supabase Auth user accounts.
**Approach:**

```typescript
// Server-side: create a custom Supabase-compatible JWT
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);

const token = await new SignJWT({
  role: 'authenticated',  // Supabase expects this for auth'd users
  iss: 'supabase',
  sub: 'editor',          // No real user ID needed
  aud: 'authenticated',
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365, // 1 year
  editor: true,            // Custom claim for RLS
})
  .setProtectedHeader({ alg: 'HS256' })
  .sign(secret);
```

The client then creates a Supabase client with this token:
```typescript
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});
```

### Pattern 3: Auth Context with Read-Only Mode
**What:** React context that tracks `isEditor` state, controlling which UI elements render.
**When to use:** Throughout the app to toggle between read-only and edit mode.
**Approach:**

```typescript
// useAuth.ts
const AuthContext = createContext<{
  isEditor: boolean;
  unlock: (passcode: string) => Promise<boolean>;
  lock: () => void;
}>({ isEditor: false, unlock: async () => false, lock: () => {} });
```

Components check `isEditor` to show/hide edit controls:
- `isEditor === false`: Hide add/delete buttons, drag handles, inline edit fields; show lock icon
- `isEditor === true`: Show all edit controls; show unlock icon (to switch back)

### Pattern 4: URL Slug Routing
**What:** Dynamic route `/schedule/[slug]` that maps a readable slug to a project UUID.
**When to use:** This phase — user wants `/schedule/kitchen-reno` style URLs.
**Approach:**

Add a `slug` column to the `projects` table. The dynamic route page fetches the project by slug:

```typescript
// src/app/schedule/[slug]/page.tsx
export default async function SchedulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Fetch project by slug, render schedule
}
```

### Anti-Patterns to Avoid
- **Client-side-only auth:** Never rely solely on hiding UI elements for security. RLS must enforce write protection server-side. A user could use the browser console to call Supabase directly with the anon key.
- **Storing plaintext passcode in env:** Hash the passcode. Compare hashes server-side. The raw passcode should never be stored or logged.
- **Using Supabase Auth for this:** Creating anonymous users or email accounts adds complexity with no benefit for a 2-person shared passcode model. Custom JWT is simpler and more appropriate.
- **JWT with short expiry for "persist forever":** User wants auth to persist indefinitely. Use a long-lived token (1 year+) or no expiry, stored in a cookie with no max-age (session) plus localStorage for UI state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing/verification | Custom HMAC implementation | `jose` library | Handles algorithm selection, header encoding, timing-safe comparison |
| Passcode hashing | SHA-256 string comparison | Web Crypto `subtle.digest` with SHA-256 | Constant-time comparison, proper encoding |
| Cookie management in Next.js | Manual Set-Cookie headers | `cookies()` from `next/headers` | Handles httpOnly, secure, sameSite, path attributes correctly |
| Supabase client with custom auth | Manual fetch with auth headers | `createClient` with custom `accessToken` | Maintains all Supabase client features (realtime, type safety) |

**Key insight:** The security boundary is Supabase RLS, not the UI. Every client-side check is a UX convenience; the database policies are the actual enforcement layer. This means getting the JWT + RLS policies right is the critical path.

## Common Pitfalls

### Pitfall 1: Anon Key Still Allows Writes
**What goes wrong:** After adding auth UI, the anon key still has full write access because RLS policies weren't updated.
**Why it happens:** The current schema has `USING (true) WITH CHECK (true)` on all tables. Developers add client-side gating but forget to update RLS.
**How to avoid:** Update RLS policies in the same migration that adds auth. Test by making a direct Supabase call with just the anon key and confirming INSERT/UPDATE/DELETE fail.
**Warning signs:** Auth "works" in the UI but you can still write data from the browser console using the anon key.

### Pitfall 2: Supabase JWT Secret vs Anon Key Confusion
**What goes wrong:** Using the anon key to sign custom JWTs, or using the JWT secret as a client key.
**Why it happens:** Supabase has multiple secrets that look similar.
**How to avoid:** The `SUPABASE_JWT_SECRET` (from Supabase dashboard > Settings > API > JWT Secret) is used to sign custom tokens. The anon key is only for the default anonymous role. Keep them in separate env vars with clear names.
**Warning signs:** JWTs are rejected by Supabase, or RLS policies don't trigger as expected.

### Pitfall 3: Cookie Not Sent on Supabase Requests
**What goes wrong:** httpOnly cookie is set but Supabase client doesn't use it because the client creates its own auth headers.
**Why it happens:** Supabase JS client manages its own auth state. Setting a cookie doesn't automatically make Supabase use it.
**How to avoid:** After verifying the passcode, store the custom JWT in the cookie AND use it to initialize the Supabase client via `createClient` with the `accessToken` option or by passing it in headers.
**Warning signs:** Server-side RLS works but client-side mutations still fail or still use anon permissions.

### Pitfall 4: localStorage Desyncs from Cookie
**What goes wrong:** localStorage says `isEditor: true` but the cookie/token has expired or been cleared, so mutations fail silently.
**Why it happens:** Two separate storage mechanisms can get out of sync.
**How to avoid:** On app load, validate the token (check cookie exists and is valid) before trusting localStorage. If token is invalid, reset localStorage and show read-only mode.
**Warning signs:** User sees edit UI but mutations fail with permission errors.

### Pitfall 5: Slug Column Uniqueness
**What goes wrong:** Two projects created with the same slug, causing routing ambiguity.
**Why it happens:** No unique constraint on the slug column.
**How to avoid:** Add `UNIQUE` constraint on `projects.slug`. For a single-project app this is low risk, but the constraint prevents future issues.
**Warning signs:** Wrong project data loads.

## Code Examples

### Passcode Verification API Route
```typescript
// src/app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { z } from 'zod';

const schema = z.object({ passcode: z.string().min(1) });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode } = schema.parse(body);

  // Compare hash of input with stored hash
  const encoder = new TextEncoder();
  const inputHash = await crypto.subtle.digest('SHA-256', encoder.encode(passcode));
  const storedHash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(process.env.SCHEDULE_PASSCODE!)
  );

  const inputArr = new Uint8Array(inputHash);
  const storedArr = new Uint8Array(storedHash);
  const match = inputArr.every((byte, i) => byte === storedArr[i]);

  if (!match) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
  }

  // Sign a Supabase-compatible JWT
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);
  const token = await new SignJWT({
    role: 'authenticated',
    sub: 'editor',
    aud: 'authenticated',
    iss: 'supabase',
    editor: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('365d')
    .sign(secret);

  const response = NextResponse.json({ success: true });
  response.cookies.set('editor-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return response;
}
```

### RLS Migration
```sql
-- Migration: Add passcode auth RLS policies
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all access to projects" ON projects;
DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;
DROP POLICY IF EXISTS "Allow all access to owners" ON owners;
DROP POLICY IF EXISTS "Allow all access to task_dependencies" ON task_dependencies;
DROP POLICY IF EXISTS "Allow all access to checkpoints" ON checkpoints;

-- Add slug to projects
ALTER TABLE projects ADD COLUMN slug TEXT UNIQUE;

-- Read: open to everyone
CREATE POLICY "Public read projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Public read tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "Public read owners" ON owners FOR SELECT USING (true);
CREATE POLICY "Public read deps" ON task_dependencies FOR SELECT USING (true);
CREATE POLICY "Public read checkpoints" ON checkpoints FOR SELECT USING (true);

-- Write: editor role only (custom JWT claim)
-- The 'authenticated' role is set when using a custom-signed JWT
CREATE POLICY "Editor insert tasks" ON tasks FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editor update tasks" ON tasks FOR UPDATE
  USING (auth.role() = 'authenticated');
CREATE POLICY "Editor delete tasks" ON tasks FOR DELETE
  USING (auth.role() = 'authenticated');

-- Repeat pattern for owners, task_dependencies, projects, checkpoints
```

### Auth Context Hook
```typescript
// src/hooks/useAuth.ts
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthState {
  isEditor: boolean;
  isLoading: boolean;
  unlock: (passcode: string) => Promise<{ success: boolean; error?: string }>;
  lock: () => void;
}

const AuthContext = createContext<AuthState>({
  isEditor: false,
  isLoading: true,
  unlock: async () => ({ success: false }),
  lock: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isEditor, setIsEditor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check localStorage + validate token
  useEffect(() => {
    const stored = localStorage.getItem('schedule-editor');
    if (stored === 'true') {
      // Validate by checking if cookie still exists via a lightweight API call
      fetch('/api/auth/status')
        .then(res => res.json())
        .then(data => setIsEditor(data.authenticated))
        .catch(() => setIsEditor(false))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const unlock = useCallback(async (passcode: string) => {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      localStorage.setItem('schedule-editor', 'true');
      setIsEditor(true);
      return { success: true };
    }
    return { success: false, error: 'Invalid passcode' };
  }, []);

  const lock = useCallback(() => {
    localStorage.removeItem('schedule-editor');
    setIsEditor(false);
    // Optionally clear cookie via API
    fetch('/api/auth/lock', { method: 'POST' });
  }, []);

  return (
    <AuthContext.Provider value={{ isEditor, isLoading, unlock, lock }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `jsonwebtoken` for JWT | `jose` (edge-compatible) | 2023+ | `jose` works in Next.js Edge Runtime and middleware; `jsonwebtoken` requires Node.js crypto |
| Supabase `supabase.auth.setSession()` | Custom JWT via `createClient` headers | Stable pattern | For non-Supabase-Auth flows, custom JWTs with `auth.role()` checks in RLS is the documented approach |
| `getServerSideProps` cookie handling | `cookies()` from `next/headers` in App Router | Next.js 13+ | App Router server components and route handlers use the `cookies()` API |

**Deprecated/outdated:**
- `next/cookie` (does not exist) — use `next/headers` `cookies()` instead
- `supabase.auth.signIn()` for custom auth — not applicable; Supabase Auth is for email/OAuth flows, not shared passcodes

## Open Questions

1. **Supabase JWT Secret Access**
   - What we know: The JWT secret is available in Supabase Dashboard > Settings > API
   - What's unclear: Whether the user has already added it to their env or Vercel config
   - Recommendation: Add `SUPABASE_JWT_SECRET` and `SCHEDULE_PASSCODE` to `.env.local` and Vercel environment variables as part of implementation

2. **Supabase `auth.role()` with Custom JWTs**
   - What we know: Supabase RLS can check `auth.role()` which reads from the JWT `role` claim. Custom JWTs signed with the project's JWT secret are accepted by PostgREST.
   - What's unclear: Whether `auth.role()` returns the value from custom JWTs exactly as expected, or if additional PostgREST configuration is needed.
   - Recommendation: Verify during implementation by signing a test JWT and checking `auth.role()` in a simple RLS policy. HIGH confidence this works based on Supabase documentation, but needs validation with this specific setup.

3. **Project Slug Source**
   - What we know: User wants `/schedule/kitchen-reno` style URLs. Currently there is a single hardcoded project UUID.
   - What's unclear: Whether the slug should be set via migration seed data or made configurable
   - Recommendation: Add slug column to projects table, seed with a default slug (e.g., 'kitchen-reno') in the migration, and use the dynamic route to look it up

## Sources

### Primary (HIGH confidence)
- Supabase documentation on custom JWTs and RLS: PostgREST accepts JWTs signed with the project's JWT secret; `auth.role()` reads the `role` claim
- Next.js App Router documentation: API routes via `route.ts`, `cookies()` from `next/headers`, middleware pattern
- `jose` library: Edge-compatible JWT signing/verification, widely used in Next.js ecosystem

### Secondary (MEDIUM confidence)
- Pattern of custom JWT + Supabase RLS for non-user-account auth flows: documented in Supabase guides and community examples
- Web Crypto API for passcode hashing: standard browser/Node.js API, no external dependency needed

### Tertiary (LOW confidence)
- Exact behavior of `auth.role()` with custom JWTs in Supabase's current PostgREST version: needs validation during implementation (flagged in Open Questions)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project except `jose`; patterns well-documented
- Architecture: HIGH - Two-tier RLS (read open / write gated) is a standard Supabase pattern; React context for auth state is straightforward
- Pitfalls: HIGH - Based on known Supabase RLS behaviors and common Next.js auth mistakes

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, 30 days)
