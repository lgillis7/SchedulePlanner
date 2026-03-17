---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/schedule/[slug]/ScheduleClient.tsx
  - src/lib/utils/formatting.ts
  - src/components/task-list/TaskTable.tsx
  - src/components/task-list/TaskRow.tsx
autonomous: true
requirements: [QUICK-01]
must_haves:
  truths:
    - "Color palette uses refined slate-blue tones instead of pure gray"
    - "Typography hierarchy is tighter — no oversized text, consistent weight scale"
    - "Header is compact with clean visual separation from content"
    - "Table rows are denser with less visual noise"
    - "Overall feel is modern SaaS tool, not default Bootstrap/template"
  artifacts:
    - path: "src/app/globals.css"
      provides: "Updated color palette with slate-blue accent tones"
    - path: "src/app/schedule/[slug]/ScheduleClient.tsx"
      provides: "Refined header and layout spacing"
    - path: "src/lib/utils/formatting.ts"
      provides: "Tighter tier typography (smaller sizes, subtler weight differences)"
  key_links:
    - from: "src/app/globals.css"
      to: "all components"
      via: "CSS custom properties consumed by Tailwind"
      pattern: "--primary|--accent|--border|--muted"
---

<objective>
Modernize the SchedulePlanner UI from its current default-shadcn gray appearance to a clean, minimalist, professional look. Update the color scheme to use refined slate-blue tones, tighten typography and spacing, and make the overall layout feel like a modern productivity tool.

Purpose: The app currently looks generic/dated — default gray palette, oversized tier-0 text, loose spacing. A visual refresh makes it feel polished and intentional.
Output: Updated CSS variables, refined layout, tighter table density.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/globals.css
@src/app/layout.tsx
@src/app/schedule/[slug]/ScheduleClient.tsx
@src/components/task-list/TaskTable.tsx
@src/components/task-list/TaskRow.tsx
@src/lib/utils/formatting.ts
@src/components/gantt/GanttView.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update color palette and typography foundation</name>
  <files>src/app/globals.css, src/app/layout.tsx</files>
  <action>
Update the CSS custom properties in globals.css `:root` block to use a refined slate-blue palette instead of pure neutral gray. The goal is subtle warmth and sophistication — NOT a dramatic color shift.

Specific changes to `:root`:
- `--primary`: shift from pure black (oklch 0.205 0 0) to a deep slate-blue, e.g. `oklch(0.25 0.02 260)` — just enough chroma to feel intentional
- `--accent`: shift from gray (oklch 0.97 0 0) to a very subtle cool-tinted off-white, e.g. `oklch(0.97 0.005 260)`
- `--border`: soften slightly, e.g. `oklch(0.91 0.005 260)` — a hint of blue in borders
- `--muted`: similar subtle cool shift, e.g. `oklch(0.96 0.005 260)`
- `--muted-foreground`: keep readable but slightly warmer, e.g. `oklch(0.50 0.01 260)`
- `--ring`: match the slate-blue family, e.g. `oklch(0.60 0.03 260)`
- Keep `--background` pure white and `--foreground` near-black — the accent comes from UI chrome, not content
- Keep `--destructive` unchanged (red is fine)

Also update the `.dark` block similarly — shift dark grays toward cool slate (add small chroma ~0.01-0.02 at hue ~260).

In layout.tsx, update the font to use Inter instead of Geist for a more universally professional feel:
- Change import from `Geist, Geist_Mono` to `Inter, JetBrains_Mono` from `next/font/google`
- Update variable names: `--font-inter`, `--font-jetbrains-mono`
- Update `--font-sans` in globals.css `@theme inline` to reference `var(--font-inter)` (or keep as `var(--font-sans)` if the variable names align)
- Add `font-feature-settings: 'cv02', 'cv03', 'cv04';` on body for Inter's refined alternates (straighter l, open 6/9)
- Keep `antialiased` on body

Reduce the base `--radius` from `0.625rem` to `0.5rem` for tighter, more modern corners.
  </action>
  <verify>Run `npm run build` — build succeeds with no errors. Visually: open the app, color palette should feel cooler/more intentional than before, fonts should render as Inter.</verify>
  <done>CSS variables updated to slate-blue palette, Inter font configured, radius tightened. Build passes.</done>
</task>

<task type="auto">
  <name>Task 2: Refine header, layout spacing, and table density</name>
  <files>src/app/schedule/[slug]/ScheduleClient.tsx, src/lib/utils/formatting.ts, src/components/task-list/TaskTable.tsx, src/components/task-list/TaskRow.tsx</files>
  <action>
**ScheduleClient.tsx — Header refinement:**
- Reduce outer padding from `px-4 py-4` to `px-4 py-3`
- Reduce header margin from `mb-4` to `mb-3`
- Change h1 from `text-2xl font-bold` to `text-lg font-semibold` — the project name should be clear but not dominating
- Change subtitle from `text-sm text-muted-foreground mt-0.5` to `text-xs text-muted-foreground tracking-wide uppercase mt-0.5` — make it a quiet label, not a sentence
- Change subtitle text from "Home renovation project scheduling tool" to just the project type or remove the hardcoded subtitle entirely (it adds no value for users who already know what this is). Replace with a subtle divider line below the header instead: add `border-b border-border pb-3` to the header wrapper div (the one with `mb-3 flex items-center justify-between`)
- Reduce the height calculation from `calc(100vh - 160px)` to `calc(100vh - 120px)` to use more vertical space (header is now shorter)

**formatting.ts — Tighter tier typography:**
- Tier 0: change from `text-lg font-bold` to `text-sm font-semibold` — summary tasks should be distinguished by weight, not size
- Tier 1: change from `text-base font-semibold` to `text-sm font-medium`
- Tier 2: keep `text-sm font-normal` (was font-medium, downgrade)
- Tier 3: change to `text-sm font-normal text-muted-foreground/70` (or use `opacity-70` if slash syntax not supported — check Tailwind v4)

Actually, since Tailwind v4 supports `/opacity` on text utilities: use `text-muted-foreground` for tier 3 as-is (it already does this).

Revised tier styles:
```
case 0: return 'text-sm font-semibold tracking-tight';
case 1: return 'text-sm font-medium';
case 2: return 'text-sm';
case 3: default: return 'text-xs text-muted-foreground';
```

**TaskTable.tsx — Header row refinement:**
- The thead styling is fine (`bg-muted/50`). No changes needed.
- Reduce th padding from `px-2 py-2` to `px-2 py-1.5` for tighter header

**TaskRow.tsx — Row density:**
- Reduce row padding from `py-1.5` to `py-1` on all td elements
- The hover state `hover:bg-muted/50` on tr is good, keep it
- For the inline editing border, change `border-primary` to `border-ring` for subtler editing indicator
- Ensure the row height constant in ScheduleClient.tsx (ROW_HEIGHT = 38) still works with the tighter padding. If rows become shorter than 38px, reduce ROW_HEIGHT to 34. The Gantt cellHeight must match, so update both ROW_HEIGHT and the SCALE_HEIGHT if needed (SCALE_HEIGHT can stay at 20).

Test the ROW_HEIGHT carefully: the Gantt scroll sync depends on row heights matching exactly. If you change ROW_HEIGHT, verify the Gantt bars still align with table rows.
  </action>
  <verify>Run `npm run build` — build succeeds. Visually verify: header is compact (single line title, no oversized text), table rows are denser, tier hierarchy uses weight not size, overall layout uses more screen real estate.</verify>
  <done>Header is compact with border separator. Tier styles use weight hierarchy not size hierarchy. Table rows are tighter. Gantt scroll sync still works (ROW_HEIGHT matches actual rendered height).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete visual modernization: slate-blue color palette, Inter font, compact header, tighter table density, refined typography hierarchy.</what-built>
  <how-to-verify>
    1. Run `npm run dev` and open http://localhost:3000
    2. Verify the color palette feels cooler and more intentional (subtle blue tint in borders, hover states, muted elements)
    3. Verify the font is Inter (compare with browser dev tools if unsure)
    4. Verify the header is compact — project name is medium-sized, subtitle is a quiet uppercase label or removed
    5. Verify task hierarchy uses weight (bold/medium/normal) rather than size to distinguish tiers
    6. Verify table rows are tight and the Gantt bars align properly with table rows (scroll both panes)
    7. Test the edit mode (unlock) — verify edit controls still look good with the new palette
  </how-to-verify>
  <resume-signal>Type "approved" or describe what needs adjustment</resume-signal>
</task>

</tasks>

<verification>
- `npm run build` passes without errors
- No TypeScript errors in modified files
- Gantt scroll sync still works (table rows align with Gantt bars)
- Visual: modern, clean, professional appearance
</verification>

<success_criteria>
- Color palette shifted from pure gray to slate-blue tones
- Typography uses Inter font family
- Header is compact (no oversized title, no redundant subtitle)
- Task hierarchy uses font-weight, not font-size
- Table rows are denser with less vertical padding
- All functional behavior preserved (editing, auth, scroll sync)
</success_criteria>

<output>
After completion, create `.planning/quick/1-modernize-website-appearance/1-SUMMARY.md`
</output>
