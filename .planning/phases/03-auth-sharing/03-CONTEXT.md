# Phase 3: Auth + Sharing - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Gate editing behind a shared passcode while contractors view the full schedule via a shared link without any login. Single URL access model with read-only default and passcode unlock for editing. Supabase RLS enforcement for server-side security.

</domain>

<decisions>
## Implementation Decisions

### Read-only vs edit-mode boundary
- Interactive read-only mode: contractors can hover for tooltips, expand/collapse task groups, scroll/zoom the timeline — just can't edit
- Edit controls (input fields, drag handles, delete buttons) are completely hidden in read-only mode — clean, simplified view
- Visible unlock button (lock/edit icon) always present so authenticated users know editing is available
- After unlocking, a lock button allows voluntarily switching back to read-only mode — useful for previewing the contractor view

### Session & persistence behavior
- Passcode authentication persists forever (localStorage) until user clears browser data or explicitly locks
- Multiple devices can be authenticated simultaneously — anyone with the passcode can edit from any device
- Passcode is set once in Supabase/environment config — no in-app passcode management UI

### Sharing URL & access model
- Single URL for everyone — read-only by default, unlock button prompts for passcode to edit
- Project-specific path with readable slug (e.g., /schedule/kitchen-reno) rather than root URL or random ID
- Address bar URL is the shareable link — no dedicated share button, just copy the URL

### Claude's Discretion
- Passcode storage mechanism (hash vs token vs other secure approach)
- Supabase RLS policy design and enforcement details
- Passcode entry UI (modal, inline, separate page) — user skipped discussing this
- Error handling for incorrect passcode attempts

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-auth-sharing*
*Context gathered: 2026-03-16*
