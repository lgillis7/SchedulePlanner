---
phase: quick-3
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/schedule/[slug]/ScheduleClient.tsx
  - src/components/task-list/TaskRow.tsx
  - src/components/task-list/TaskTable.tsx
  - src/app/globals.css
autonomous: true
must_haves:
  truths:
    - "Horizontal scrollbar for the Gantt chart appears below the split-pane, not inside the Gantt's own area"
    - "Add-subtask (+) button appears inline next to the task name, not in the Actions column"
    - "Editor can drag task rows to reorder them, and the new order persists after page refresh"
  artifacts:
    - path: "src/app/schedule/[slug]/ScheduleClient.tsx"
      provides: "Scrollbar relocation, drag-to-reorder state and handlers"
    - path: "src/components/task-list/TaskRow.tsx"
      provides: "Inline add-subtask button next to name, drag handle"
    - path: "src/components/task-list/TaskTable.tsx"
      provides: "Drag-to-reorder row logic via HTML drag-and-drop"
    - path: "src/app/globals.css"
      provides: "Scrollbar override styles for SVAR Gantt"
  key_links:
    - from: "TaskTable drag handlers"
      to: "ScheduleClient handleReorderTask"
      via: "onReorder callback prop"
    - from: "handleReorderTask"
      to: "updateTask (queries.ts)"
      via: "sortOrder field updates + refetch"
---

<objective>
Three UX improvements to the schedule view: (1) move the horizontal scrollbar so it sits below the entire Gantt chart area instead of being internal to the SVAR component, (2) move the add-subtask button from the Actions column to inline next to the task name for faster access, and (3) add drag-to-reorder rows so editors can rearrange task order.

Purpose: Better usability -- scrollbar is more discoverable, subtask creation is faster, and manual ordering gives editors direct control over task display order.
Output: Updated ScheduleClient, TaskTable, TaskRow, and globals.css.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/schedule/[slug]/ScheduleClient.tsx
@src/components/task-list/TaskTable.tsx
@src/components/task-list/TaskRow.tsx
@src/components/gantt/GanttView.tsx
@src/components/gantt/gantt-adapter.ts
@src/lib/supabase/queries.ts
@src/types/scheduling.ts
@src/app/globals.css

<interfaces>
From src/types/scheduling.ts:
```typescript
export interface RawTask {
  id: string; projectId: string; parentTaskId: string | null;
  ownerId: string | null; title: string; tierDepth: 0|1|2|3;
  sortOrder: number; desiredStartDate: string; durationDays: number;
  completionPct: number; notes: string | null;
}
export interface ComputedTask extends RawTask {
  requiredStartDate: string; effectiveStartDate: string; endDate: string;
}
```

From src/lib/supabase/queries.ts:
```typescript
export async function updateTask(client, taskId, updates: Partial<{
  title: string; desiredStartDate: string; durationDays: number;
  completionPct: number; ownerId: string | null; parentTaskId: string | null;
  tierDepth: number; sortOrder: number; notes: string | null;
}>): Promise<RawTask>;
```

From src/components/gantt/gantt-adapter.ts:
```typescript
export function treeSortTasks<T extends { id: string; parentTaskId: string | null; sortOrder: number }>(tasks: T[]): T[];
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move add-subtask button inline and relocate horizontal scrollbar</name>
  <files>
    src/components/task-list/TaskRow.tsx
    src/app/schedule/[slug]/ScheduleClient.tsx
    src/app/globals.css
  </files>
  <action>
**Move add-subtask button next to task name (TaskRow.tsx):**
- In the Title `<td>` cell (the one with `tierIndent`), add the `+` (Plus icon) button AFTER the task title text, inside the existing `<div className="flex items-center gap-1">`.
- Show the `+` button only when `isEditor && task.tierDepth < 3`. Use `opacity-0 group-hover/row:opacity-100` so it appears on row hover (add `group/row` class to the `<tr>`).
- Remove the `<Plus>` button from the Actions `<td>` at the bottom of TaskRow. Keep only the delete (Trash2) button in Actions.
- The button should be compact: `variant="ghost" size="icon-xs"` with `<Plus className="size-3" />`.

**Move horizontal scrollbar below Gantt chart (ScheduleClient.tsx):**
- The SVAR Gantt component renders its own horizontal scrollbar internally. The goal is to ensure the horizontal scrollbar for time-axis scrolling appears at the bottom of the right pane (the Gantt pane), which SVAR already does by default.
- Currently the left pane (task table) has `scrollbarWidth: 'none'` which hides its vertical scrollbar -- keep this behavior.
- The outer flex container has `overflow-hidden`. The Gantt's horizontal scrollbar should be visible at the bottom of the Gantt pane. If SVAR's internal scrollbar is being clipped, change the right pane div from `className="min-w-0"` to `className="min-w-0 flex flex-col"` and ensure GanttView fills the space.
- In globals.css, add CSS to ensure the SVAR horizontal scrollbar is always visible (not auto-hidden):
```css
/* Ensure SVAR Gantt horizontal scrollbar is always visible */
.wx-willow .wx-scroll-x {
  overflow-x: scroll !important;
}
```
- If the SVAR Gantt wraps its chart in a container that clips the scrollbar, inspect the rendered DOM classes (`.wx-gantt`, `.wx-chart-area`, `.wx-scroll-x`) and override `overflow` accordingly.
  </action>
  <verify>
    Run `npm run build` -- no type errors. Visually: the add-subtask + button appears next to task names on hover (editor mode), and the horizontal scrollbar for the Gantt timeline is visible at the bottom of the Gantt pane.
  </verify>
  <done>
    Add-subtask button is inline next to task name (visible on row hover in editor mode), removed from Actions column. Gantt horizontal scrollbar visible at bottom of Gantt pane.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add drag-to-reorder rows for task ordering</name>
  <files>
    src/components/task-list/TaskRow.tsx
    src/components/task-list/TaskTable.tsx
    src/app/schedule/[slug]/ScheduleClient.tsx
  </files>
  <action>
**Use native HTML5 drag-and-drop (no new dependencies needed).**

**TaskRow.tsx changes:**
- Add a drag handle as the first element in the row (editor mode only). Use a `GripVertical` icon from lucide-react, sized `size-3.5`, styled `text-muted-foreground cursor-grab opacity-0 group-hover/row:opacity-100`.
- Add a new leading `<td>` for the drag handle (before the `#` column), only when `isEditor` is true.
- Add props: `onDragStart: (taskId: string) => void`, `onDragOver: (taskId: string) => void`, `onDragEnd: () => void`, `isDragOver: boolean`.
- On the `<tr>`:
  - `draggable={isEditor}`
  - `onDragStart={() => onDragStart?.(task.id)}`
  - `onDragOver={(e) => { e.preventDefault(); onDragOver?.(task.id); }}`
  - `onDragEnd={() => onDragEnd?.()}`
- When `isDragOver` is true, add a visual indicator: `border-t-2 border-primary` on the `<tr>`.

**TaskTable.tsx changes:**
- Add prop `onReorder: (taskId: string, newIndex: number) => void` to TaskTableProps.
- Track drag state with `useState`: `dragSourceId: string | null`, `dragOverId: string | null`.
- Pass `onDragStart`, `onDragOver`, `onDragEnd`, `isDragOver` to each TaskRow.
- On `onDragEnd`: if `dragSourceId` and `dragOverId` are set and different, calculate the new index position from `visibleTasks` array, then call `onReorder(dragSourceId, targetIndex)`.
- Add the drag handle column header (empty `<th>` with `w-8`) before the `#` header when `isEditor`.
- Increment the `colSpan` on the empty-state row accordingly.

**ScheduleClient.tsx changes:**
- Add `handleReorderTask` callback that:
  1. Takes `(taskId: string, newIndex: number)`.
  2. Finds the task in `treeSchedule` array.
  3. Reorders only among siblings (tasks with same `parentTaskId`): removes the dragged task from siblings list, inserts at the target position within siblings.
  4. Assigns new sequential `sortOrder` values (1, 2, 3...) to all siblings.
  5. Calls `updateTask(client, id, { sortOrder })` for each changed task, then `refetch()`.
  6. Shows toast on success/error.
- Pass `onReorder={isEditor ? handleReorderTask : undefined}` to TaskTable.
- Only allow reordering among siblings with the same `parentTaskId`. If dragging between different parents, ignore the drop (no-op).
  </action>
  <verify>
    Run `npm run build` -- no type errors. In editor mode, drag handle appears on row hover. Dragging a row to a new position within its siblings reorders it and the order persists after refresh (sortOrder updated in DB).
  </verify>
  <done>
    Drag-to-reorder works for sibling tasks. Drag handle visible on hover (editor mode). Sort order persists via sortOrder field in database. Cross-parent drops are ignored.
  </done>
</task>

</tasks>

<verification>
1. `npm run build` passes with no errors
2. In editor mode: hover a task row to see the `+` button next to the name and drag handle on the left
3. Click `+` next to a task name to create a subtask -- same behavior as before
4. The Actions column only shows the delete button now
5. Horizontal scrollbar is visible at the bottom of the Gantt chart pane
6. Drag a task row up or down among its siblings -- drop indicator shows, order updates
7. Refresh the page -- reordered tasks maintain their new positions
8. In read-only mode: no drag handles, no `+` buttons visible
</verification>

<success_criteria>
- Add-subtask button is inline next to task names (hover-visible, editor only)
- Actions column contains only the delete button
- Gantt horizontal scrollbar visible below the chart
- Drag-to-reorder works for sibling tasks with visual drop indicator
- Sort order persists to database
- Read-only mode unaffected
- Build passes clean
</success_criteria>

<output>
After completion, create `.planning/quick/3-move-scrollbar-below-gantt-chart-move-ad/3-SUMMARY.md`
</output>
