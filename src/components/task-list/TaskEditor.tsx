'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { detectCycle } from '@/lib/scheduling/dependency-graph';
import { formatDate } from '@/lib/utils/formatting';
import type { ComputedTask, RawTask, Owner, Dependency } from '@/types/scheduling';

interface TaskEditorProps {
  task: ComputedTask | null;
  allTasks: ComputedTask[];
  owners: Owner[];
  dependencies: Dependency[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    taskId: string,
    updates: {
      title?: string;
      desiredStartDate?: string;
      durationDays?: number;
      completionPct?: number;
      ownerId?: string | null;
      parentTaskId?: string | null;
      tierDepth?: number;
      notes?: string | null;
    },
    depChanges?: {
      add: { upstreamTaskId: string }[];
      remove: string[];
    }
  ) => Promise<void>;
}

export function TaskEditor({
  task,
  allTasks,
  owners,
  dependencies,
  open,
  onOpenChange,
  onSave,
}: TaskEditorProps) {
  const [title, setTitle] = useState('');
  const [desiredStartDate, setDesiredStartDate] = useState<Date | undefined>();
  const [durationDays, setDurationDays] = useState('1');
  const [completionPct, setCompletionPct] = useState('0');
  const [ownerId, setOwnerId] = useState<string>('__unassigned__');
  const [depsInput, setDepsInput] = useState('');
  const [parentTaskId, setParentTaskId] = useState<string>('__none__');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Populate form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDesiredStartDate(parseISO(task.desiredStartDate));
      setDurationDays(String(task.durationDays));
      setCompletionPct(String(task.completionPct));
      setOwnerId(task.ownerId ?? '__unassigned__');
      setNotes(task.notes ?? '');
      setParentTaskId(task.parentTaskId ?? '__none__');

      // Populate deps as comma-separated line numbers
      const upstreamDeps = dependencies.filter(
        (d) => d.downstreamTaskId === task.id
      );
      const lineNumbers = upstreamDeps
        .map((d) => {
          const upTask = allTasks.find((t) => t.id === d.upstreamTaskId);
          return upTask ? String(upTask.sortOrder) : null;
        })
        .filter(Boolean);
      setDepsInput(lineNumbers.join(', '));
    }
  }, [task, dependencies, allTasks]);

  if (!task) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Task title is required');
      return;
    }

    const dur = parseFloat(durationDays);
    if (isNaN(dur) || dur < 0.1) {
      toast.error('Duration must be at least 0.1 days');
      return;
    }

    const pct = parseFloat(completionPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('Completion must be between 0 and 100');
      return;
    }

    // Resolve dependency line numbers to task IDs
    const newUpstreamIds: string[] = [];
    if (depsInput.trim()) {
      const lineNums = depsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
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

    // Calculate dep changes
    const currentUpstreamDeps = dependencies.filter(
      (d) => d.downstreamTaskId === task.id
    );
    const currentUpstreamIds = new Set(
      currentUpstreamDeps.map((d) => d.upstreamTaskId)
    );
    const newUpstreamSet = new Set(newUpstreamIds);

    const depsToAdd = newUpstreamIds
      .filter((id) => !currentUpstreamIds.has(id))
      .map((id) => ({ upstreamTaskId: id }));
    const depsToRemove = currentUpstreamDeps
      .filter((d) => !newUpstreamSet.has(d.upstreamTaskId))
      .map((d) => d.id);

    // Check for cycles with proposed new dependencies
    if (depsToAdd.length > 0) {
      const proposedDeps: Dependency[] = [
        ...dependencies.filter(
          (d) =>
            d.downstreamTaskId !== task.id ||
            newUpstreamSet.has(d.upstreamTaskId)
        ),
        ...depsToAdd.map((da) => ({
          id: `temp-${da.upstreamTaskId}`,
          projectId: task.projectId,
          upstreamTaskId: da.upstreamTaskId,
          downstreamTaskId: task.id,
          dependencyType: 'finish-to-start' as const,
        })),
      ];

      // Convert ComputedTask[] to RawTask[] for detectCycle
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
        toast.error(
          `Circular dependency detected: ${cycleResult.join(' -> ')}`
        );
        return;
      }
    }

    // Determine parent/tier changes
    const newParentId = parentTaskId === '__none__' ? null : parentTaskId;
    let newTierDepth = task.tierDepth;
    if (newParentId !== task.parentTaskId) {
      if (newParentId === null) {
        newTierDepth = 0 as RawTask['tierDepth'];
      } else {
        const parent = allTasks.find((t) => t.id === newParentId);
        newTierDepth = parent
          ? (Math.min(parent.tierDepth + 1, 3) as RawTask['tierDepth'])
          : task.tierDepth;
      }
    }

    setSaving(true);
    try {
      await onSave(
        task.id,
        {
          title: title.trim(),
          desiredStartDate: desiredStartDate
            ? format(desiredStartDate, 'yyyy-MM-dd')
            : undefined,
          durationDays: dur,
          completionPct: pct,
          ownerId: ownerId === '__unassigned__' ? null : ownerId,
          parentTaskId: newParentId,
          tierDepth: newTierDepth,
          notes: notes.trim() || null,
        },
        depsToAdd.length > 0 || depsToRemove.length > 0
          ? { add: depsToAdd, remove: depsToRemove }
          : undefined
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save task'
      );
    } finally {
      setSaving(false);
    }
  };

  // Filter parent options: cannot be self or own children
  const parentOptions = allTasks.filter(
    (t) => t.id !== task.id && t.tierDepth < 3
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Title */}
          <div className="grid gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task name"
            />
          </div>

          {/* Desired Start Date with Calendar */}
          <div className="grid gap-1.5">
            <Label>Desired Start Date</Label>
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="w-full justify-start text-left font-normal" />
                }
              >
                <CalendarIcon className="mr-2 size-4" />
                {desiredStartDate
                  ? formatDate(format(desiredStartDate, 'yyyy-MM-dd'))
                  : 'Pick a date'}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={desiredStartDate}
                  onSelect={(date) => {
                    if (date) setDesiredStartDate(date);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Duration */}
            <div className="grid gap-1.5">
              <Label htmlFor="task-duration">Duration (days)</Label>
              <Input
                id="task-duration"
                type="number"
                min="0.1"
                step="0.5"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
              />
            </div>

            {/* Completion % */}
            <div className="grid gap-1.5">
              <Label htmlFor="task-completion">Completion %</Label>
              <Input
                id="task-completion"
                type="number"
                min="0"
                max="100"
                step="5"
                value={completionPct}
                onChange={(e) => setCompletionPct(e.target.value)}
              />
            </div>
          </div>

          {/* Owner */}
          <div className="grid gap-1.5">
            <Label>Owner</Label>
            <Select value={ownerId} onValueChange={(v) => setOwnerId(v ?? '__unassigned__')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select owner" />
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
          </div>

          {/* Dependencies */}
          <div className="grid gap-1.5">
            <Label htmlFor="task-deps">
              Dependencies (comma-separated line #s)
            </Label>
            <Input
              id="task-deps"
              value={depsInput}
              onChange={(e) => setDepsInput(e.target.value)}
              placeholder="e.g., 1, 3, 5"
            />
          </div>

          {/* Parent Task */}
          <div className="grid gap-1.5">
            <Label>Parent Task</Label>
            <Select value={parentTaskId} onValueChange={(v) => setParentTaskId(v ?? '__none__')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (top-level)</SelectItem>
                {parentOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {'  '.repeat(t.tierDepth)}{t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="task-notes">Notes</Label>
            <textarea
              id="task-notes"
              className="h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
