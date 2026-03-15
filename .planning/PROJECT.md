# SchedulePlanner — Home Renovation Gantt Tool

## What This Is

A web-based Gantt chart planning tool for organizing a home renovation project. It lets a homeowner create hierarchical project items with dependencies, durations, ownership (contractors/specialists), and completion tracking. Contractors can view a read-only version of the full schedule; the homeowner edits behind a simple shared passcode.

## Core Value

Clearly visualize the renovation schedule — what depends on what, who owns what, and whether we're ahead or behind — so we can make informed decisions with contractors.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Web-accessible Gantt chart with read-only sharing for contractors
- [ ] Simple shared passcode login for edit access (no account management)
- [ ] Multiple projects, each with independent items and owners
- [ ] Hierarchical project items up to 3-4 levels deep with visual tier formatting (bold, italics, font size)
- [ ] Item properties: desired start date, required start date (calculated), duration (float days), end date, owner, completion %, upstream/downstream dependencies
- [ ] Desired start date defaults to today, editable via calendar popup
- [ ] Required start date calculated from upstream dependency end dates; falls back to desired start date when no dependencies
- [ ] Weekend inclusion toggle for date calculations (business days vs all days)
- [ ] Dependency editing by item ID/line number, intuitive UX
- [ ] Drag-and-drop dependency creation on the Gantt chart (desirement)
- [ ] Owner management: name, optional contact info, color (determines item color)
- [ ] Two view modes: list + calendar, list + Gantt chart
- [ ] Progress plot: time vs work-days-completed, with desired progress curve and current-state glowing data point
- [ ] Manual checkpoint button to save "as built" data points over time, building an actual-progress curve on the plot
- [ ] Hosted on Vercel, database on Supabase, code on GitHub

### Out of Scope

- External tool integration (calendars, Jira, etc.) — not needed for personal renovation use
- Durable account management / user registration — shared passcode is sufficient
- Separate user accounts for edit tracking — one shared code
- Contractor-filtered views — contractors see full schedule for context

## Context

- This is a personal/household tool for the homeowner and their wife to plan and track a home renovation
- Contractors will receive read-only links to see the full schedule and understand how their work fits in
- The progress plot is a reflection tool — used to check actual vs expected progress together
- "As built" curve builds over time via manual checkpoints, not auto-snapshots
- Tier depth realistically 3-4 levels (e.g., Bathroom → Plumbing → Roughing → Drain install)
- The homeowner already has Vercel and Supabase accounts ready

## Constraints

- **Hosting**: Vercel — already has an account and manages deployments there
- **Database**: Supabase — if persistent storage is needed
- **Source control**: GitHub at github.com/lgillis7/SchedulePlanner
- **Auth**: Brittle passcode only — no OAuth, no email/password, no sessions beyond simple gate

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single shared passcode for edit access | Simplicity — only homeowner and wife need edit access | — Pending |
| Manual progress checkpoints (not auto) | More intentional tracking, less noise in data | — Pending |
| Contractors see full schedule (not filtered) | Context matters — they need to see how their work fits the bigger picture | — Pending |
| Max 3-4 tier depth for items | Realistic for renovation scope, keeps UI manageable | — Pending |
| Supabase for database | Already available, pairs well with Vercel | — Pending |

---
*Last updated: 2026-03-15 after initialization*
