'use client';

import { TaskRow } from './TaskRow';
import type { ComputedTask, Owner, Dependency } from '@/types/scheduling';

interface TaskTableProps {
  schedule: ComputedTask[];
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
  /** When false, hides edit controls for read-only view */
  isEditor?: boolean;
}

export function TaskTable({
  schedule,
  owners,
  dependencies,
  onUpdate,
  onDelete,
  onAddTask,
  onAddSubtask,
  rowHeight,
  isEditor = false,
}: TaskTableProps) {
  // Use caller-provided order (tree-sorted for Gantt alignment)
  const sortedTasks = schedule;

  return (
    <div className="w-full">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground w-12 text-center">
              #
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground min-w-[200px]">
              Task
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Owner
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
              Desired Start
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">
              Duration
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
              Req. Start
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
              End Date
            </th>
            <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">
              Done
            </th>
            {isEditor && (
              <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Deps
              </th>
            )}
            {isEditor && (
              <th className="px-2 py-1.5 text-xs font-medium text-muted-foreground w-20">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              owners={owners}
              dependencies={dependencies}
              allTasks={sortedTasks}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              rowHeight={rowHeight}
              isEditor={isEditor}
            />
          ))}
          {sortedTasks.length === 0 && (
            <tr>
              <td
                colSpan={isEditor ? 10 : 8}
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
