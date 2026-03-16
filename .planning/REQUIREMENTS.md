# Requirements: SchedulePlanner

**Defined:** 2026-03-15
**Core Value:** Clearly visualize the renovation schedule — what depends on what, who owns what, and whether we're ahead or behind

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Task Management

- [x] **TASK-01**: User can create, edit, and delete project items (tasks)
- [x] **TASK-02**: User can organize tasks in a hierarchy up to 3-4 levels deep (e.g., Bathroom > Plumbing > Roughing > Drain install)
- [x] **TASK-03**: Tasks display with visual tier formatting — bold, italics, and font size indicate depth level
- [x] **TASK-04**: Each task has a desired start date (defaults to today), editable via calendar popup
- [x] **TASK-05**: Each task has a duration in floating-point days
- [x] **TASK-06**: Each task has a required start date, calculated from upstream dependency end dates; falls back to desired start date when no dependencies
- [x] **TASK-07**: Each task has an end date calculated as required start date + duration
- [x] **TASK-08**: User can toggle whether weekends are included in date calculations (business days vs all days)

### Dependencies

- [x] **DEP-01**: User can set finish-to-start dependencies between tasks
- [x] **DEP-02**: User can edit dependencies by inputting task ID/line number of upstream items
- [x] **DEP-03**: Downstream task required start dates automatically recalculate when upstream task dates change
- [x] **DEP-04**: System detects and prevents circular dependencies
- [x] **DEP-05**: User can create dependencies via drag-and-drop on the Gantt chart (from bar to bar)

### Owners

- [x] **OWN-01**: User can create, edit, and delete item owners within a project
- [x] **OWN-02**: Each owner has a name, optional contact info field, and a color
- [x] **OWN-03**: User can assign an owner to any task
- [x] **OWN-04**: Task color on the Gantt chart is determined by its owner's color

### Visualization

- [x] **VIS-01**: User can view tasks in a split-pane list + Gantt chart view
- [x] **VIS-02**: Gantt chart displays horizontal time bars for each task with owner-colored fills
- [x] **VIS-03**: Gantt chart displays dependency lines between connected tasks
- [x] **VIS-04**: Each task shows a completion % indicator on its Gantt bar

### Progress Tracking

- [x] **PROG-01**: User can set completion percentage (0-100%) for each task
- [ ] **PROG-02**: User can view a progress plot with time on x-axis and work-days-completed on y-axis
- [ ] **PROG-03**: Progress plot displays a desired progress curve based on each task's desired start date and duration
- [ ] **PROG-04**: Progress plot displays a glowing data point for current state (today's date, sum of all task % complete * duration)
- [ ] **PROG-05**: User can manually save a progress checkpoint via button click
- [ ] **PROG-06**: Saved checkpoints appear as an "as built" curve on the progress plot, showing actual progress over time

### Access & Sharing

- [ ] **AUTH-01**: Editing requires entering a shared passcode (single code, no account management)
- [ ] **AUTH-02**: Read-only view is accessible without any login — shareable via URL for contractors
- [ ] **AUTH-03**: Passcode entry persists across browser sessions (cookie/localStorage) so user doesn't re-enter every visit

### Infrastructure

- [x] **INFRA-01**: Application is hosted on Vercel
- [x] **INFRA-02**: Data is persisted in Supabase database
- [x] **INFRA-03**: Source code is stored on GitHub (github.com/lgillis7/SchedulePlanner)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Views

- **VIEW-01**: User can switch to a list + calendar view (month grid with task indicators)

### Projects

- **PROJ-01**: User can create, edit, and delete multiple projects
- **PROJ-02**: Each project has independent tasks, owners, and settings

### Enhancements

- **ENH-01**: Parent tasks auto-calculate dates and completion % from child tasks (roll-up)
- **ENH-02**: Critical path highlighting on Gantt chart (zero-slack tasks)
- **ENH-03**: Zoom levels on Gantt chart (day/week/month)
- **ENH-04**: CSV/PDF export for sharing with contractors

## Out of Scope

| Feature | Reason |
|---------|--------|
| External tool integration (calendars, Jira) | Not needed for personal renovation use |
| User accounts / role-based permissions | Shared passcode is sufficient for 2 editors |
| Complex dependency types (SS, FF, SF, lag/lead) | Finish-to-start covers 95% of renovation scheduling |
| Budget / cost tracking | Separate domain — use a spreadsheet |
| Real-time collaboration / multiplayer editing | Overkill for 2 editors; last-write-wins is fine |
| Resource leveling / workload balancing | Contractors are not fungible resources |
| Notifications / email alerts | Tool is checked daily; no alert infrastructure needed |
| Mobile native app | Responsive web is sufficient |
| AI/auto-scheduling | Homeowner knows the renovation sequence |
| Import from MS Project | Greenfield, manual entry is fine for 50-200 items |
| Undo/redo system | Confirmation dialogs on destructive actions suffice |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TASK-01 | Phase 1 | Complete |
| TASK-02 | Phase 1 | Complete |
| TASK-03 | Phase 1 | Complete |
| TASK-04 | Phase 1 | Complete |
| TASK-05 | Phase 1 | Complete |
| TASK-06 | Phase 1 | Complete |
| TASK-07 | Phase 1 | Complete |
| TASK-08 | Phase 1 | Complete |
| DEP-01 | Phase 1 | Complete |
| DEP-02 | Phase 1 | Complete |
| DEP-03 | Phase 1 | Complete |
| DEP-04 | Phase 1 | Complete |
| DEP-05 | Phase 2 | Complete |
| OWN-01 | Phase 1 | Complete |
| OWN-02 | Phase 1 | Complete |
| OWN-03 | Phase 1 | Complete |
| OWN-04 | Phase 2 | Complete |
| VIS-01 | Phase 2 | Complete |
| VIS-02 | Phase 2 | Complete |
| VIS-03 | Phase 2 | Complete |
| VIS-04 | Phase 2 | Complete |
| PROG-01 | Phase 1 | Complete |
| PROG-02 | Phase 4 | Pending |
| PROG-03 | Phase 4 | Pending |
| PROG-04 | Phase 4 | Pending |
| PROG-05 | Phase 4 | Pending |
| PROG-06 | Phase 4 | Pending |
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 3 | Pending |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
