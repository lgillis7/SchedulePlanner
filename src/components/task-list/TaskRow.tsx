'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Trash2, Plus, CalendarIcon, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { tierStyles, tierIndent, formatDate } from '@/lib/utils/formatting';
import { detectCycle } from '@/lib/scheduling/dependency-graph';
import type { ComputedTask, RawTask, Owner, Dependency } from '@/types/scheduling';

interface TaskRowProps {
  task: ComputedTask;
  owners: Owner[];
  dependencies: Dependency[];
  allTasks: ComputedTask[];
  onUpdate: (
    taskId: string,
    updates: Record<string, unknown>,
    depChanges?: {
      add: { upstreamTaskId: string }[];
      remove: string[];
    }
  ) => Promise<void>;
  onDelete: (taskId: string) => void;
  onAddSubtask: (parentTask: ComputedTask) => void;
  /** Fixed row height in pixels for Gantt scroll sync alignment */
  rowHeight?: number;
  /** When false, renders all fields as static text */
  isEditor?: boolean;
  /** Whether this task has children */
  isParent?: boolean;
  /** Whether this parent task's children are collapsed */
  isCollapsed?: boolean;
  /** Toggle collapse state for this task */
  onToggleCollapse?: (taskId: string) => void;
  /** Drag-to-reorder callbacks (editor only) */
  onDragStart?: (taskId: string) => void;
  onDragOver?: (taskId: string) => void;
  onDragEnd?: () => void;
  /** Whether this row is the current drag-over target */
  isDragOver?: boolean;
}

// Inline editable text/number cell
function EditableCell({
  value,
  onSave,
  type = 'text',
  className = '',
  inputClassName = '',
  suffix = '',
  min,
  max,
  step,
}: {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'number';
  className?: string;
  inputClassName?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Sync external value changes
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`w-full bg-transparent border-b border-ring outline-none ${inputClassName}`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-muted/80 rounded px-0.5 -mx-0.5 ${className}`}
    >
      {value}{suffix}
    </span>
  );
}

export function TaskRow({
  task,
  owners,
  dependencies,
  allTasks,
  onUpdate,
  onDelete,
  onAddSubtask,
  rowHeight,
  isEditor = false,
  isParent = false,
  isCollapsed = false,
  onToggleCollapse,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragOver = false,
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

  // --- Inline save handlers ---

  const saveTitle = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) {
        toast.error('Title cannot be empty');
        return;
      }
      onUpdate(task.id, { title: trimmed });
    },
    [task.id, onUpdate]
  );

  const saveDuration = useCallback(
    (val: string) => {
      const dur = parseFloat(val);
      if (isNaN(dur) || dur < 0.1) {
        toast.error('Duration must be at least 0.1');
        return;
      }
      onUpdate(task.id, { durationDays: dur });
    },
    [task.id, onUpdate]
  );

  const saveCompletion = useCallback(
    (val: string) => {
      const pct = parseFloat(val);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        toast.error('Must be 0-100');
        return;
      }
      onUpdate(task.id, { completionPct: pct });
    },
    [task.id, onUpdate]
  );

  const saveDate = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      onUpdate(task.id, { desiredStartDate: format(date, 'yyyy-MM-dd') });
    },
    [task.id, onUpdate]
  );

  const saveOwner = useCallback(
    (val: string | null) => {
      onUpdate(task.id, {
        ownerId: !val || val === '__unassigned__' ? null : val,
      });
    },
    [task.id, onUpdate]
  );

  const saveDeps = useCallback(
    (val: string) => {
      // Resolve line numbers to task IDs
      const newUpstreamIds: string[] = [];
      if (val.trim()) {
        const lineNums = val.split(',').map((s) => s.trim()).filter(Boolean);
        for (const ln of lineNums) {
          const num = parseInt(ln, 10);
          if (isNaN(num)) {
            toast.error(`Invalid line number: "${ln}"`);
            return;
          }
          const upTask = allTasks.find((t) => t.sortOrder === num);
          if (!upTask) {
            toast.error(`No task with line number ${num}`);
            return;
          }
          if (upTask.id === task.id) {
            toast.error('A task cannot depend on itself');
            return;
          }
          newUpstreamIds.push(upTask.id);
        }
      }

      // Check for cycles
      if (newUpstreamIds.length > 0) {
        const newUpstreamSet = new Set(newUpstreamIds);
        const proposedDeps: Dependency[] = [
          ...dependencies.filter(
            (d) =>
              d.downstreamTaskId !== task.id ||
              newUpstreamSet.has(d.upstreamTaskId)
          ),
          ...newUpstreamIds
            .filter((id) => !upstreamDeps.some((d) => d.upstreamTaskId === id))
            .map((id) => ({
              id: `temp-${id}`,
              projectId: task.projectId,
              upstreamTaskId: id,
              downstreamTaskId: task.id,
              dependencyType: 'finish-to-start' as const,
            })),
        ];
        const rawTasks: RawTask[] = allTasks.map((t) => ({
          id: t.id,
          projectId: t.projectId,
          parentTaskId: t.parentTaskId,
          ownerId: t.ownerId,
          title: t.title,
          tierDepth: t.tierDepth,
          sortOrder: t.sortOrder,
          desiredStartDate: t.desiredStartDate,
          durationDays: t.durationDays,
          completionPct: t.completionPct,
          notes: t.notes,
        }));
        const cycleResult = detectCycle(rawTasks, proposedDeps);
        if (cycleResult !== null) {
          toast.error(`Circular dependency: ${cycleResult.join(' -> ')}`);
          return;
        }
      }

      // Calculate dep changes
      const currentUpstreamIds = new Set(
        upstreamDeps.map((d) => d.upstreamTaskId)
      );
      const newUpstreamSet = new Set(newUpstreamIds);

      const depsToAdd = newUpstreamIds
        .filter((id) => !currentUpstreamIds.has(id))
        .map((id) => ({ upstreamTaskId: id }));
      const depsToRemove = upstreamDeps
        .filter((d) => !newUpstreamSet.has(d.upstreamTaskId))
        .map((d) => d.id);

      if (depsToAdd.length > 0 || depsToRemove.length > 0) {
        onUpdate(task.id, {}, { add: depsToAdd, remove: depsToRemove });
      }
    },
    [task, allTasks, dependencies, upstreamDeps, onUpdate]
  );

  return (
    <tr
      className={`group/row border-b border-border hover:bg-muted/50 ${isDragOver ? 'border-t-2 border-t-primary' : ''}`}
      style={rowHeight ? { height: rowHeight, maxHeight: rowHeight, overflow: 'hidden' } : undefined}
      draggable={isEditor}
      onDragStart={() => onDragStart?.(task.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(task.id); }}
      onDragEnd={() => onDragEnd?.()}
    >
      {/* Drag handle (editor only) */}
      {isEditor && (
        <td className="px-1 py-1 w-8">
          <GripVertical className="size-3.5 text-muted-foreground cursor-grab opacity-0 group-hover/row:opacity-100" />
        </td>
      )}

      {/* Line # */}
      <td className="px-2 py-1 text-center text-xs text-muted-foreground tabular-nums">
        {task.sortOrder}
      </td>

      {/* Title with tier formatting */}
      <td className={`px-2 py-1 ${tierIndent(task.tierDepth)}`}>
        <div className="flex items-center gap-1">
          {isParent ? (
            <button
              onClick={() => onToggleCollapse?.(task.id)}
              className="shrink-0 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={isCollapsed ? 'Expand subtasks' : 'Collapse subtasks'}
            >
              {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          ) : (
            <span className="shrink-0 size-4" />
          )}
          {isEditor ? (
            <EditableCell
              value={task.title}
              onSave={saveTitle}
              className={tierStyles(task.tierDepth)}
            />
          ) : (
            <span className={tierStyles(task.tierDepth)}>{task.title}</span>
          )}
          {isEditor && task.tierDepth < 3 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onAddSubtask(task)}
              aria-label={`Add subtask to ${task.title}`}
              className="opacity-0 group-hover/row:opacity-100 shrink-0"
            >
              <Plus className="size-3" />
            </Button>
          )}
        </div>
      </td>

      {/* Owner - inline select */}
      <td className="px-2 py-1 whitespace-nowrap">
        {isEditor ? (
          <Select
            value={task.ownerId ?? '__unassigned__'}
            onValueChange={saveOwner}
          >
            <SelectTrigger className="!h-auto border-none bg-transparent shadow-none !p-0 min-w-[100px]">
              <SelectValue>
                {owner ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: owner.color }}
                    />
                    <span className="text-sm">{owner.name}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Unassigned
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: o.color }}
                    />
                    {o.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          owner ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: owner.color }}
              />
              <span className="text-sm">{owner.name}</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Unassigned</span>
          )
        )}
      </td>

      {/* Desired Start - calendar popover (read-only for parents) */}
      <td className="px-2 py-1 text-sm whitespace-nowrap">
        {isEditor && !isParent ? (
          <Popover>
            <PopoverTrigger
              render={
                <button className="inline-flex items-center gap-1 cursor-pointer hover:bg-muted/80 rounded px-0.5 -mx-0.5" />
              }
            >
              <CalendarIcon className="size-3 text-muted-foreground" />
              {formatDate(task.desiredStartDate)}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseISO(task.desiredStartDate)}
                onSelect={saveDate}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <span className={`text-sm ${isParent ? 'text-muted-foreground' : ''}`}>{formatDate(task.desiredStartDate)}</span>
        )}
      </td>

      {/* Duration (read-only for parents) */}
      <td className="px-2 py-1 text-sm text-center tabular-nums">
        {isEditor && !isParent ? (
          <EditableCell
            value={String(task.durationDays)}
            onSave={saveDuration}
            type="number"
            suffix="d"
            min={0.1}
            step={0.5}
            inputClassName="w-16 text-center"
          />
        ) : (
          <span className={isParent ? 'text-muted-foreground' : ''}>{task.durationDays}d</span>
        )}
      </td>

      {/* Required Start (computed - read only) */}
      <td className="px-2 py-1 text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(task.requiredStartDate)}
      </td>

      {/* End Date (computed - read only) */}
      <td className="px-2 py-1 text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(task.endDate)}
      </td>

      {/* Completion % (read-only for parents) */}
      <td className="px-2 py-1 text-sm text-center tabular-nums">
        {isEditor && !isParent ? (
          <EditableCell
            value={String(task.completionPct)}
            onSave={saveCompletion}
            type="number"
            suffix="%"
            min={0}
            max={100}
            step={5}
            inputClassName="w-14 text-center"
          />
        ) : (
          <span className={isParent ? 'text-muted-foreground' : ''}>{task.completionPct}%</span>
        )}
      </td>

      {/* Dependencies - inline editable (editor only) */}
      {isEditor && (
        <td className="px-2 py-1 text-sm text-muted-foreground tabular-nums">
          <EditableCell
            value={upstreamLineNumbers.length > 0 ? upstreamLineNumbers.join(', ') : ''}
            onSave={saveDeps}
            inputClassName="w-20"
            className={upstreamLineNumbers.length === 0 ? 'text-muted-foreground' : ''}
          />
          {!upstreamLineNumbers.length && (
            <span
              className="cursor-pointer hover:bg-muted/80 rounded px-0.5 text-muted-foreground"
              onClick={(e) => {
                // Find the EditableCell and trigger click on it
                const cell = e.currentTarget.previousElementSibling as HTMLElement;
                if (cell) cell.click();
              }}
            >
              -
            </span>
          )}
        </td>
      )}

      {/* Actions (editor only) */}
      {isEditor && (
        <td className="px-2 py-1">
          <div className="flex items-center gap-0.5">
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
      )}
    </tr>
  );
}
