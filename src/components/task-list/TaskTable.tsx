'use client';

import { useCallback, useMemo, useState, type RefObject } from 'react';
import { TaskRow } from './TaskRow';
import type { ComputedTask, Owner, Dependency } from '@/types/scheduling';

interface TaskTableProps {
  schedule: ComputedTask[];
  /** Pre-computed visible tasks from parent (skips internal hiddenIds calculation) */
  visibleTasks?: ComputedTask[];
  owners: Owner[];
  dependencies: Dependency[];
  onUpdate: (
    taskId: string,
    updates: Record<string, unknown>,
    depChanges?: {
      add: { upstreamTaskId: string }[];
      remove: string[];
    }
  ) => Promise<void>;
  onDelete: (taskId: string) => void;
  onAddTask: () => void;
  onAddSubtask: (parentTask: ComputedTask) => void;
  /** Fixed row height in pixels for Gantt scroll sync alignment */
  rowHeight?: number;
  /** Fixed header height in pixels to match Gantt scale header */
  headerHeight?: number;
  /** When false, hides edit controls for read-only view */
  isEditor?: boolean;
  /** Set of collapsed parent task IDs */
  collapsedIds: Set<string>;
  /** Toggle collapse state for a parent task */
  onToggleCollapse: (taskId: string) => void;
  /** Callback when a task is reordered via drag-and-drop (source ID, target ID) */
  onReorder?: (taskId: string, targetTaskId: string) => void;
  /** Ref for the thead row — parent uses this to fake sticky-top via transform */
  theadRowRef?: RefObject<HTMLTableRowElement | null>;
}

export function TaskTable({
  schedule,
  visibleTasks: visibleTasksProp,
  owners,
  dependencies,
  onUpdate,
  onDelete,
  onAddTask,
  onAddSubtask,
  rowHeight,
  headerHeight,
  isEditor = false,
  collapsedIds,
  onToggleCollapse,
  onReorder,
  theadRowRef,
}: TaskTableProps) {
  // Use caller-provided order (tree-sorted for Gantt alignment)
  const sortedTasks = schedule;

  // Determine which task IDs are parents (have children)
  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of sortedTasks) {
      if (t.parentTaskId) ids.add(t.parentTaskId);
    }
    return ids;
  }, [sortedTasks]);

  // Compute hierarchical display IDs (e.g., "1", "1.1", "1.2", "2", "2.1")
  const displayIdMap = useMemo(() => {
    const map = new Map<string, string>();
    const siblingCounters = new Map<string | null, number>();
    for (const task of sortedTasks) {
      const parentKey = task.parentTaskId ?? null;
      const count = (siblingCounters.get(parentKey) ?? 0) + 1;
      siblingCounters.set(parentKey, count);
      if (task.parentTaskId) {
        const parentDisplayId = map.get(task.parentTaskId);
        map.set(task.id, `${parentDisplayId}.${count}`);
      } else {
        map.set(task.id, String(count));
      }
    }
    return map;
  }, [sortedTasks]);

  // Build set of hidden task IDs (children of collapsed ancestors)
  // Skipped when visibleTasks prop is provided by parent
  const hiddenIds = useMemo(() => {
    if (visibleTasksProp) return new Set<string>();
    const hidden = new Set<string>();
    const taskMap = new Map(sortedTasks.map((t) => [t.id, t]));
    for (const task of sortedTasks) {
      let current = task;
      while (current.parentTaskId) {
        if (collapsedIds.has(current.parentTaskId)) {
          hidden.add(task.id);
          break;
        }
        const parent = taskMap.get(current.parentTaskId);
        if (!parent) break;
        current = parent;
      }
    }
    return hidden;
  }, [sortedTasks, collapsedIds, visibleTasksProp]);

  const visibleTasks = useMemo(
    () => visibleTasksProp ?? sortedTasks.filter((t) => !hiddenIds.has(t.id)),
    [visibleTasksProp, sortedTasks, hiddenIds]
  );

  // ---------------------------------------------------------------------------
  // Drag-to-reorder state
  // ---------------------------------------------------------------------------

  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = useCallback((taskId: string) => {
    setDragSourceId(taskId);
  }, []);

  const handleDragOver = useCallback((taskId: string) => {
    setDragOverId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragSourceId && dragOverId && dragSourceId !== dragOverId && onReorder) {
      onReorder(dragSourceId, dragOverId);
    }
    setDragSourceId(null);
    setDragOverId(null);
  }, [dragSourceId, dragOverId, onReorder]);

  // Editor columns: drag handle + # + Task + Owner + Deps + Desired Start + Duration + Req Start + End Date + Done = 10
  // Read-only columns: # + Task + Owner + Desired Start + Duration + Req Start + End Date + Done = 8
  const totalColumns = isEditor ? 10 : 8;

  // Sticky column offsets: drag(32) + #(48) + Task(200)
  const stickyIdLeft = isEditor ? 32 : 0;   // after drag handle
  const stickyTaskLeft = stickyIdLeft + 48;  // after # column

  return (
    <div className="w-full">
      <table className="text-left border-collapse gantt-aligned-table" style={{ width: 'auto', minWidth: '100%' }}>
        <colgroup>
          {isEditor && <col style={{ width: 32 }} />}
          <col style={{ width: 48 }} />
          <col style={{ width: 200 }} />
        </colgroup>
        <thead>
          <tr
            ref={theadRowRef}
            className="border-b border-border bg-background"
            style={{ ...(headerHeight ? { height: headerHeight } : {}), position: 'relative', zIndex: 20, willChange: 'transform' }}
          >
            {isEditor && (
              <th className="w-8 sticky left-0 z-30 bg-background" />
            )}
            <th
              className="px-2 py-1.5 text-xs font-medium text-muted-foreground w-12 text-center sticky z-30 bg-background"
              style={{ left: stickyIdLeft }}
            >
              #
            </th>
            <th
              className="px-2 py-1.5 text-xs font-medium text-muted-foreground min-w-[200px] sticky z-30 bg-background border-r border-border"
              style={{ left: stickyTaskLeft }}
            >
              Task
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
              Owner
            </th>
            {isEditor && (
              <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap" style={{ maxWidth: 80 }}>
                Deps
              </th>
            )}
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
              Desired Start
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center whitespace-nowrap">
              Duration
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
              Req. Start
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
              End Date
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center whitespace-nowrap">
              Done
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              owners={owners}
              dependencies={dependencies}
              allTasks={sortedTasks}
              displayIdMap={displayIdMap}
              stickyIdLeft={stickyIdLeft}
              stickyTaskLeft={stickyTaskLeft}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              rowHeight={rowHeight}
              isEditor={isEditor}
              isParent={parentIds.has(task.id)}
              isCollapsed={collapsedIds.has(task.id)}
              onToggleCollapse={onToggleCollapse}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              isDragOver={dragOverId === task.id && dragSourceId !== task.id}
            />
          ))}
          {sortedTasks.length === 0 && (
            <tr>
              <td
                colSpan={totalColumns}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                {isEditor
                  ? 'No tasks yet. Click "Add Task" to create one.'
                  : 'No tasks yet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
