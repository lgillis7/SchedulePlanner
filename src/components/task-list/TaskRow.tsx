'use client';

import { Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tierStyles, tierIndent, formatDate } from '@/lib/utils/formatting';
import type { ComputedTask, Owner, Dependency } from '@/types/scheduling';

interface TaskRowProps {
  task: ComputedTask;
  owners: Owner[];
  dependencies: Dependency[];
  allTasks: ComputedTask[];
  onEdit: (task: ComputedTask) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask: (parentTask: ComputedTask) => void;
}

export function TaskRow({
  task,
  owners,
  dependencies,
  allTasks,
  onEdit,
  onDelete,
  onAddSubtask,
}: TaskRowProps) {
  const owner = task.ownerId
    ? owners.find((o) => o.id === task.ownerId)
    : null;

  // Get upstream line numbers for this task
  const upstreamDeps = dependencies.filter(
    (d) => d.downstreamTaskId === task.id
  );
  const upstreamLineNumbers = upstreamDeps
    .map((d) => {
      const upTask = allTasks.find((t) => t.id === d.upstreamTaskId);
      return upTask ? upTask.sortOrder : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  return (
    <tr className="border-b border-border hover:bg-muted/50">
      {/* Line # */}
      <td className="px-2 py-1.5 text-center text-xs text-muted-foreground tabular-nums">
        {task.sortOrder}
      </td>

      {/* Title with tier formatting */}
      <td className={`px-2 py-1.5 ${tierIndent(task.tierDepth)}`}>
        <span className={tierStyles(task.tierDepth)}>{task.title}</span>
      </td>

      {/* Owner */}
      <td className="px-2 py-1.5 whitespace-nowrap">
        {owner ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: owner.color }}
            />
            <span className="text-sm">{owner.name}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )}
      </td>

      {/* Desired Start */}
      <td className="px-2 py-1.5 text-sm whitespace-nowrap">
        {formatDate(task.desiredStartDate)}
      </td>

      {/* Duration */}
      <td className="px-2 py-1.5 text-sm text-center tabular-nums">
        {task.durationDays}d
      </td>

      {/* Required Start (computed) */}
      <td className="px-2 py-1.5 text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(task.requiredStartDate)}
      </td>

      {/* End Date (computed) */}
      <td className="px-2 py-1.5 text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(task.endDate)}
      </td>

      {/* Completion % */}
      <td className="px-2 py-1.5 text-sm text-center tabular-nums">
        {task.completionPct}%
      </td>

      {/* Dependencies */}
      <td className="px-2 py-1.5 text-sm text-muted-foreground tabular-nums">
        {upstreamLineNumbers.length > 0
          ? upstreamLineNumbers.join(', ')
          : '-'}
      </td>

      {/* Actions */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onEdit(task)}
            aria-label={`Edit ${task.title}`}
          >
            <Pencil />
          </Button>
          {task.tierDepth < 3 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onAddSubtask(task)}
              aria-label={`Add subtask to ${task.title}`}
            >
              <Plus />
            </Button>
          )}
          <Button
            variant="destructive"
            size="icon-xs"
            onClick={() => {
              if (
                window.confirm(
                  `Delete "${task.title}" and all its subtasks?`
                )
              ) {
                onDelete(task.id);
              }
            }}
            aria-label={`Delete ${task.title}`}
          >
            <Trash2 />
          </Button>
        </div>
      </td>
    </tr>
  );
}
