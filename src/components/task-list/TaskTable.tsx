'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskRow } from './TaskRow';
import type { ComputedTask, Owner, Dependency } from '@/types/scheduling';

interface TaskTableProps {
  schedule: ComputedTask[];
  owners: Owner[];
  dependencies: Dependency[];
  onEdit: (task: ComputedTask) => void;
  onDelete: (taskId: string) => void;
  onAddTask: () => void;
  onAddSubtask: (parentTask: ComputedTask) => void;
}

export function TaskTable({
  schedule,
  owners,
  dependencies,
  onEdit,
  onDelete,
  onAddTask,
  onAddSubtask,
}: TaskTableProps) {
  // Sort tasks by sortOrder for display
  const sortedTasks = [...schedule].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-2 py-2 text-xs font-medium text-muted-foreground w-12 text-center">
              #
            </th>
            <th className="px-2 py-2 text-xs font-medium text-muted-foreground min-w-[200px]">
              Task
            </th>
            <th className="px-2 py-2 text-xs font-medium text-muted-foreground">
              Owner
            </th>
            <th className="px-2 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
              Desired Start
            </th>
            <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">
              Duration
            </th>
            <th className="px-2 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
              Req. Start
            </th>
            <th className="px-2 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
              End Date
            </th>
            <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">
              Done
            </th>
            <th className="px-2 py-2 text-xs font-medium text-muted-foreground">
              Deps
            </th>
            <th className="px-2 py-2 text-xs font-medium text-muted-foreground w-24">
              Actions
            </th>
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
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
            />
          ))}
          {sortedTasks.length === 0 && (
            <tr>
              <td
                colSpan={10}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No tasks yet. Click &quot;Add Task&quot; to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="border-t border-border p-2">
        <Button variant="outline" size="sm" onClick={onAddTask}>
          <Plus data-icon="inline-start" />
          Add Task
        </Button>
      </div>
    </div>
  );
}
