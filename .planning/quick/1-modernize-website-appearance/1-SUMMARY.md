---
task: 1
slug: modernize-website-appearance
status: complete
date: 2026-03-17
commits:
  - "5286504: feat(quick-1): update color palette to slate-blue and switch to Inter font"
  - "0a9bc43: feat(quick-1): refine header, typography hierarchy, and table density"
  - "ff89688: fix(ui): align table rows with Gantt chart and enforce sans-serif font"
files_modified:
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/schedule/[slug]/ScheduleClient.tsx
  - src/lib/utils/formatting.ts
  - src/components/task-list/TaskTable.tsx
  - src/components/task-list/TaskRow.tsx
---

# Quick Task 1: Modernize Website Appearance

## What Changed

Modernized the SchedulePlanner UI from a dated default look to a clean, professional scheduler tool aesthetic.

### Color Palette (globals.css)
- Shifted all neutral grays to subtle slate-blue tones (hue 260) for a cooler, more intentional palette
- Updated both light and dark mode variables
- Reduced border radius from 0.625rem to 0.5rem for tighter corners

### Typography (layout.tsx, globals.css)
- Switched from Geist to Inter font family (sans-serif)
- Added font-feature-settings for Inter's refined alternates
- Added global CSS override to apply sans-serif to SVAR Gantt components

### Layout & Density (ScheduleClient.tsx, formatting.ts, TaskTable.tsx, TaskRow.tsx)
- Compact header: text-lg title, uppercase subtitle label, border separator
- Tier hierarchy uses font-weight (semibold/medium/normal) instead of font-size
- Tighter table row padding (py-1 instead of py-1.5)
- ROW_HEIGHT reduced to 34px to match denser rows

### Alignment Fix (ScheduleClient.tsx, TaskTable.tsx)
- Fixed table row / Gantt bar misalignment by replacing paddingTop with a headerHeight prop on the thead
- Table header row now matches Gantt scale header height exactly (40px)

## Verification
- Build passes (`next build` clean)
- Visual checkpoint approved with user feedback incorporated
- Gantt scroll sync validated after alignment fix
