# Feature Research

**Domain:** Home renovation Gantt chart / project scheduling tool
**Researched:** 2026-03-15
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Task list with hierarchy | Every Gantt tool has parent/child tasks. Renovation projects are naturally hierarchical (Room > Trade > Task). Without hierarchy, lists become unmanageable at 50+ items. | MEDIUM | PROJECT.md specifies 3-4 levels deep. Visual tier formatting (bold, font size) by depth is part of the spec. |
| Gantt bar visualization | This IS a Gantt tool. Horizontal time bars on a timeline are the defining feature. Users open it expecting to see bars. | HIGH | Rendering a performant, scrollable, zoomable Gantt chart is the single hardest UI piece. Use a library or expect significant effort. |
| Task dependencies (finish-to-start) | Dependencies are the core value of a Gantt over a simple calendar. "Plumbing rough-in must finish before drywall starts" is the whole point for renovation scheduling. | MEDIUM | Finish-to-start is the only dependency type needed for renovation. FS, SS, FF, SF are enterprise overkill. |
| Calculated dates from dependencies | If Task B depends on Task A, Task B's start date must auto-calculate from Task A's end. This is the "scheduling" in "scheduling tool." Without it, it is just a drawing app. | MEDIUM | PROJECT.md calls this "required start date." Forward-pass calculation through dependency chain. Cascade updates when upstream tasks change. |
| Duration-based scheduling | User sets duration (e.g., 5 days), system calculates end date from start date + duration. Standard in every Gantt tool. | LOW | PROJECT.md specifies float days. Weekend toggle affects calculation. |
| Task completion tracking (% complete) | Users need to see what is done vs what remains. Every Gantt tool shows this as partial bar fill or similar visual. | LOW | Simple 0-100% per task. Roll-up to parent is a nice touch but not required for v1. |
| Owner/assignee per task | "Who owns this?" is the first question when looking at a schedule. For renovation: which contractor does this task. | LOW | PROJECT.md specifies owner with name, contact info, and color. Color-coded bars by owner is highly valuable for visual scanning. |
| Editable task properties | Users need to edit start date, duration, owner, completion %, dependencies, and name inline or via a detail panel. | MEDIUM | Calendar popup for dates (per spec). Inline editing is faster but panel editing is simpler to build. |
| Read-only sharing (view link) | PROJECT.md core requirement: contractors get a read-only link. Standard in collaborative tools. Without this, you are emailing screenshots. | LOW | No auth on read. Passcode only gates edit mode. Simple URL sharing. |
| Simple auth gate for editing | PROJECT.md specifies shared passcode. Not a full auth system, just a gate to prevent accidental edits by viewers. | LOW | Single passcode stored in env or DB. No sessions, no accounts, no password reset. Cookie or localStorage to remember the gate. |
| Multiple projects | Renovation may span multiple scopes (kitchen, bathroom, exterior). Or homeowner may track renovation + another project. | LOW | PROJECT.md requires this. Each project is an independent set of tasks/owners. Project selector in nav. |
| Data persistence | Tasks, dependencies, and progress must survive page reload. This is a planning tool, not a whiteboard sketch. | LOW | Supabase is the specified database. Standard CRUD. |

### Differentiators (Competitive Advantage)

Features that set SchedulePlanner apart from generic Gantt tools. These are specifically valuable for home renovation context.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Progress plot (time vs work-days-completed) | The killer feature from PROJECT.md. No simple Gantt tool shows "are we ahead or behind" as a visual curve. Enterprise tools have earned value analysis, but this is a simpler, more intuitive version: X-axis = calendar time, Y-axis = work-days completed. Desired curve + actual curve = instant health check. | MEDIUM | Requires calculating total planned work-days and plotting expected daily completion rate. "Desired progress curve" is the baseline. Current state is a glowing data point. |
| Manual "as built" checkpoints | Unique to this tool. User clicks a button to snapshot current progress, building an actual-progress curve over time. This is intentional reflection, not automated noise. Most tools auto-track; manual checkpoints make the homeowner pause and assess. | LOW | Store timestamp + cumulative work-days-completed at each checkpoint. Plot as data points on the progress chart. |
| Weekend inclusion toggle | Renovation-specific: some trades work weekends, some do not. Most Gantt tools assume business days. Toggle lets user choose per-project whether weekends count in duration calculations. | LOW | Affects date arithmetic globally. When toggled, all calculated dates need to recompute. |
| Owner color-coding on Gantt bars | Instantly see "the plumber's tasks are blue, electrician is orange." Visual contractor coordination at a glance. Generic tools color by status or priority, not by assignee. | LOW | Owner entity has a color field. Gantt bars inherit owner's color. Simple but high-impact visual. |
| Drag-and-drop dependency creation | PROJECT.md lists this as a "desirement." Drawing a line from one bar to another is far more intuitive than typing IDs. This is what makes the tool feel polished vs spreadsheet-like. | HIGH | Requires hit detection on Gantt bars, drag state management, line rendering between bars. Significant UI complexity. Defer to v1.x unless using a Gantt library that provides it. |
| Dual view modes (list+calendar, list+Gantt) | Most tools pick one view. Offering both lets the homeowner switch context: Gantt for planning dependencies, calendar for "what's happening this week." | MEDIUM | Two distinct right-panel renderers sharing the same task list on the left. Calendar view is a month grid with task bars or dots. |
| Dependency editing by ID/line number | PROJECT.md spec for lightweight dependency entry. Type "3, 7" to say "this task depends on tasks 3 and 7." Faster than drag-and-drop for power users. | LOW | Each task gets a visible line number. Dependency field accepts comma-separated numbers. Parse and validate on entry. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems -- especially for a personal renovation tool.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time collaboration / multiplayer editing | "What if my wife and I edit at the same time?" | Adds enormous complexity (conflict resolution, operational transforms, websockets). For 2 editors behind one passcode, this is overkill. Last-write-wins with page refresh is fine. | Optimistic updates with simple conflict detection: "This item was modified since you loaded it. Reload?" |
| Resource leveling / workload balancing | Enterprise Gantt tools auto-balance work across team members. | Renovation contractors are not fungible resources. The plumber cannot do electrical work. Auto-leveling makes no sense here. | Manual scheduling with visual owner highlighting so the homeowner can spot conflicts. |
| Complex dependency types (SS, FF, SF, lag, lead) | "We need start-to-start with 2-day lag!" | Finish-to-start covers 95% of renovation scheduling. SS/FF/SF add UI complexity and confuse non-PM users. Lag/lead times add date calculation complexity for marginal benefit. | Finish-to-start only. If a task needs to start 2 days after another starts, model it as a short predecessor task. |
| Budget / cost tracking | Home renovation tools often include budgets. | This is a scheduling tool, not a financial tool. Budget tracking is a separate domain with its own complexity (estimates vs actuals, change orders, payment tracking). Adding it dilutes focus. | Keep scope to schedule. Use a spreadsheet or dedicated budget tool for costs. |
| External integrations (Google Calendar, Jira, etc.) | "Sync my schedule to my calendar!" | Integration maintenance burden is high. APIs change, auth flows are complex, sync conflicts arise. PROJECT.md explicitly lists this as out of scope. | Export to CSV or PDF for manual import elsewhere. |
| User accounts and role-based permissions | "Contractors should only see their tasks." | PROJECT.md explicitly rejects this. Account management is a massive scope addition. Contractors benefit from seeing the full schedule for context. | Single passcode for edit. Open read access. Contractors see everything. |
| Undo/redo system | "What if I make a mistake?" | Full undo/redo requires command pattern, state snapshots, or event sourcing. Significant architectural complexity for a personal tool. | Confirmation dialogs on destructive actions (delete task, remove dependency). Manual "as built" checkpoints serve as a form of progress backup. |
| Auto-scheduling / AI scheduling | "Just tell it what needs to happen and let it figure out the order." | Garbage-in-garbage-out. The homeowner knows the renovation sequence; the tool should make it easy to express, not guess. AI scheduling adds unpredictability and complexity. | Good dependency visualization and automatic date cascading IS the scheduling intelligence. |
| Mobile-native app | "I need this on my phone at the job site." | Native mobile dev doubles the codebase. Gantt charts are inherently wide/landscape and do not work well on small screens. | Responsive web design. Ensure the task list view works on mobile even if the Gantt chart requires landscape/tablet. |
| Import from MS Project / other tools | "I have an existing project file." | MPP parsing is complex. This is a greenfield personal tool, not an enterprise migration target. | Manual entry. The task list is small enough (50-200 items) that manual entry is reasonable. |
| Notifications / email alerts | "Email me when a task is due." | Email infrastructure, notification preferences, delivery reliability -- all for a tool used by 2-3 people. | The progress plot and visual indicators tell you if you are behind. Check the tool daily during active renovation. |

## Feature Dependencies

```
[Data Persistence (Supabase)]
    |
    +--requires--> [Task CRUD]
    |                  |
    |                  +--requires--> [Task Hierarchy (parent/child)]
    |                  |
    |                  +--requires--> [Owner Management]
    |                  |                   |
    |                  |                   +--enables--> [Owner Color-Coding on Bars]
    |                  |
    |                  +--requires--> [Duration & Date Calculation]
    |                                      |
    |                                      +--requires--> [Weekend Toggle]
    |                                      |
    |                                      +--enables--> [Dependency System]
    |                                                        |
    |                                                        +--enables--> [Calculated Start Dates]
    |                                                        |
    |                                                        +--enables--> [Dependency Editing by ID]
    |                                                        |
    |                                                        +--enables--> [Drag-and-Drop Dependencies]
    |
    +--requires--> [Gantt Chart Rendering]
    |                  |
    |                  +--enhanced-by--> [Owner Color-Coding on Bars]
    |                  |
    |                  +--enhanced-by--> [Drag-and-Drop Dependencies]
    |
    +--requires--> [Auth Gate (Passcode)]
    |                  |
    |                  +--enables--> [Read-Only Sharing]
    |
    +--requires--> [Completion % Tracking]
    |                  |
    |                  +--enables--> [Progress Plot]
    |                                    |
    |                                    +--enables--> [Manual Checkpoints]
    |
    +--requires--> [Multiple Projects]

[List + Gantt View] --parallel-with--> [List + Calendar View]
    (share same task list component on the left)
```

### Dependency Notes

- **Gantt Chart Rendering requires Task CRUD:** Cannot render bars without task data (start, end, duration).
- **Dependency System requires Duration & Date Calculation:** Dependencies trigger date recalculation downstream.
- **Progress Plot requires Completion % Tracking:** The Y-axis (work-days-completed) is derived from task completion percentages and durations.
- **Manual Checkpoints require Progress Plot:** Checkpoints are data points on the progress plot; the plot must exist first.
- **Drag-and-Drop Dependencies require both Gantt Rendering and Dependency System:** Need rendered bars to click on and a dependency engine to wire them into.
- **Owner Color-Coding enhances both Task CRUD (owner field) and Gantt Rendering (bar colors):** These must exist before color-coding adds value.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what is needed to start planning the renovation.

- [ ] Task CRUD with hierarchy (3-4 levels) -- core data model, can't do anything without it
- [ ] Owner management with color assignment -- need to know who does what from day one
- [ ] Duration and date calculation with weekend toggle -- the scheduling math engine
- [ ] Finish-to-start dependencies with calculated start dates -- the core value proposition
- [ ] Dependency editing by task ID/line number -- lightweight UX for wiring tasks
- [ ] Gantt chart rendering with owner-colored bars -- the primary visualization
- [ ] Completion % tracking per task -- needed to see where things stand
- [ ] Simple passcode auth gate -- enable sharing with contractors immediately
- [ ] Read-only view (no passcode) -- contractors can view from day one
- [ ] Data persistence (Supabase) -- obviously
- [ ] Single project support -- start with one; multi-project can wait

### Add After Validation (v1.x)

Features to add once core scheduling is working.

- [ ] Progress plot (time vs work-days-completed) -- add once there is enough data to plot meaningfully (a few weeks into the renovation)
- [ ] Manual "as built" checkpoints -- add alongside progress plot
- [ ] Multiple project support -- add when/if homeowner needs a second project
- [ ] List + Calendar view (second view mode) -- add once the Gantt view is solid
- [ ] Drag-and-drop dependency creation on Gantt bars -- polish feature, add once dependencies work via ID entry
- [ ] Parent task auto-calculation (roll-up of child dates and completion) -- quality of life improvement

### Future Consideration (v2+)

Features to defer until the tool is battle-tested during actual renovation.

- [ ] CSV/PDF export -- useful for sharing with contractors who want a printout
- [ ] Critical path highlighting -- visually mark tasks with zero slack; useful but not essential for a small project
- [ ] Baseline comparison (save a "plan" and compare against current schedule) -- the progress plot partially covers this
- [ ] Task notes/comments -- free-text per task for context ("inspector requires 48hr notice")
- [ ] Zoom levels on Gantt (day/week/month) -- v1 can default to a sensible zoom

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Task CRUD with hierarchy | HIGH | MEDIUM | P1 |
| Gantt chart rendering | HIGH | HIGH | P1 |
| Dependencies + date calculation | HIGH | MEDIUM | P1 |
| Owner management + color | HIGH | LOW | P1 |
| Completion % tracking | MEDIUM | LOW | P1 |
| Passcode auth gate | MEDIUM | LOW | P1 |
| Read-only sharing | MEDIUM | LOW | P1 |
| Data persistence (Supabase) | HIGH | MEDIUM | P1 |
| Weekend toggle | MEDIUM | LOW | P1 |
| Dependency editing by ID | MEDIUM | LOW | P1 |
| Progress plot | HIGH | MEDIUM | P2 |
| Manual checkpoints | MEDIUM | LOW | P2 |
| Multiple projects | LOW | LOW | P2 |
| Calendar view mode | MEDIUM | MEDIUM | P2 |
| Drag-and-drop dependencies | MEDIUM | HIGH | P2 |
| Parent task roll-up | MEDIUM | MEDIUM | P2 |
| Critical path highlighting | LOW | MEDIUM | P3 |
| CSV/PDF export | LOW | LOW | P3 |
| Task notes/comments | LOW | LOW | P3 |
| Gantt zoom levels | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- the tool is not usable without these
- P2: Should have, add once core is validated and in use
- P3: Nice to have, add based on real usage feedback

## Competitor Feature Analysis

| Feature | Enterprise Tools (MS Project, Smartsheet) | Simple Tools (TeamGantt, Instagantt, Tom's Planner) | SchedulePlanner Approach |
|---------|------------------------------------------|------------------------------------------------------|------------------------|
| Task hierarchy | Unlimited depth, WBS codes | 2-3 levels typical | 3-4 levels, visual formatting by depth |
| Dependencies | All 4 types + lag/lead | Finish-to-start mainly | Finish-to-start only, by design |
| Resource management | Full leveling, allocation % | Basic assignee | Owner with color, no leveling |
| Gantt rendering | Full-featured, zoom, print | Clean, simple bars | Clean bars with owner colors |
| Progress tracking | Earned value, baselines | % complete | % complete + progress plot (unique) |
| Sharing | Role-based, per-user | Link sharing | Passcode edit / open read |
| Cost tracking | Full budgeting | Sometimes basic | None (out of scope) |
| Views | Gantt, board, calendar, table, resource | Gantt + list | List+Gantt, List+Calendar |
| Collaboration | Real-time, comments, @mentions | Basic sharing | Single-editor, read-only sharing |
| Price | $20-55/user/month | $0-10/user/month | Free (self-hosted on Vercel) |

**SchedulePlanner's niche:** It occupies the space between "use a spreadsheet" and "pay for TeamGantt." Free, self-hosted, purpose-built for the homeowner-as-project-manager use case. The progress plot is genuinely novel for this tier. No account signup, no subscription, no feature bloat.

## Sources

- [Celoxis Gantt Chart Software Tools](https://www.celoxis.com/article/gantt-chart-software-tools) -- Feature landscape for enterprise Gantt tools
- [Flowlu Best Gantt Chart Software](https://www.flowlu.com/blog/project-management/best-gantt-chart-software/) -- Feature comparison across tools
- [The Digital Project Manager Free Gantt Tools](https://thedigitalprojectmanager.com/tools/free-gantt-chart-software/) -- Free tool feature comparison
- [ProjectManager Gantt Chart Dependencies](https://www.projectmanager.com/blog/gantt-chart-dependencies) -- Dependency type reference
- [TeamGantt Critical Path](https://www.teamgantt.com/blog/critical-path) -- Critical path method explained
- [Instagantt Home Renovation Template](https://www.instagantt.com/gantt-chart-templates/preview/home-renovation-gantt-complete-house-remodel-with-permits-contractor-hiring-demolition-construction-and-final-inspection-phases) -- Renovation-specific Gantt template
- [RenoQuest Construction PM Software](https://renoquest.com/best-construction-project-management-software/) -- Renovation industry tool features
- [Monday.com Free Gantt Chart Software](https://monday.com/blog/project-management/free-gantt-chart-software/) -- Free tool feature overview

---
*Feature research for: Home renovation Gantt chart / project scheduling tool*
*Researched: 2026-03-15*
