'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useSchedule } from '@/hooks/useSchedule';
import { useAuth } from '@/hooks/useAuth';
import { useCheckpoints } from '@/hooks/useCheckpoints';
import { createClient } from '@/lib/supabase/client';
import { createEditorClient } from '@/lib/supabase/editor-client';
import {
  computePlannedCurve,
  computeActualProgress,
} from '@/lib/progress/curve-calculator';
import {
  createTask,
  updateTask,
  deleteTask,
  updateProject,
  createOwner,
  updateOwner,
  deleteOwner,
  addDependency,
  removeDependency,
} from '@/lib/supabase/queries';
import { GanttChart } from '@/components/gantt/GanttChart';
import { ROW_HEIGHT, HEADER_HEIGHT } from '@/components/gantt/gantt-utils';
import { treeSortTasks } from '@/components/gantt/gantt-adapter';
import { TaskTable } from '@/components/task-list/TaskTable';
import { OwnerManager } from '@/components/owners/OwnerManager';
import { EditToggle } from '@/components/auth/EditToggle';
import { ProgressPlot } from '@/components/progress/ProgressPlot';
import { Button } from '@/components/ui/button';
import type { ComputedTask } from '@/types/scheduling';
import { CyclicDependencyError } from '@/types/scheduling';

interface ScheduleClientProps {
  projectId: string;
}

export default function ScheduleClient({ projectId }: ScheduleClientProps) {
  const { project, tasks, dependencies, owners, loading, error, refetch } =
    useProject(projectId);
  const { schedule, error: scheduleError } = useSchedule(
    tasks,
    dependencies,
    project?.includeWeekends ?? false
  );

  const { isEditor, isLoading: authLoading, editorToken } = useAuth();

  // Memoize the Supabase client based on auth state
  const client = useMemo(() => {
    if (isEditor && editorToken) {
      return createEditorClient(editorToken);
    }
    return createClient();
  }, [isEditor, editorToken]);

  // ---------------------------------------------------------------------------
  // Progress tracking
  // ---------------------------------------------------------------------------

  const [showProgress, setShowProgress] = useState(false);

  const { checkpoints, saving, saveCheckpoint } = useCheckpoints(
    projectId,
    isEditor,
    editorToken
  );

  const plannedCurve = useMemo(
    () => computePlannedCurve(schedule, project?.includeWeekends ?? false),
    [schedule, project?.includeWeekends]
  );

  const actualProgress = useMemo(
    () => computeActualProgress(schedule),
    [schedule]
  );

  const totalWorkDays = useMemo(() => {
    const parentIds = new Set(
      schedule
        .filter((t) => schedule.some((o) => o.parentTaskId === t.id))
        .map((t) => t.id)
    );
    return schedule
      .filter((t) => !parentIds.has(t.id))
      .reduce((sum, t) => sum + t.durationDays, 0);
  }, [schedule]);

  const handleSaveCheckpoint = useCallback(async () => {
    try {
      await saveCheckpoint(totalWorkDays, actualProgress);
      toast.success('Checkpoint saved');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save checkpoint'
      );
    }
  }, [saveCheckpoint, totalWorkDays, actualProgress]);

  // ---------------------------------------------------------------------------
  // Collapse state (shared between TaskTable and Gantt)
  // ---------------------------------------------------------------------------

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((taskId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Scroll sync: fake sticky-top for table header via transform
  // (CSS sticky doesn't work inside overflow-x:auto containers)
  // ---------------------------------------------------------------------------

  const theadRowRef = useRef<HTMLTableRowElement>(null);

  const handleContainerScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (theadRowRef.current) {
      theadRowRef.current.style.transform = `translateY(${e.currentTarget.scrollTop}px)`;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Tree sort + visible tasks (shared between TaskTable and GanttChart)
  // ---------------------------------------------------------------------------

  const treeSchedule = useMemo(
    () => treeSortTasks(schedule),
    [schedule]
  );

  // Build set of hidden task IDs (children of collapsed ancestors)
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    const taskMap = new Map(treeSchedule.map(t => [t.id, t]));
    for (const task of treeSchedule) {
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
  }, [treeSchedule, collapsedIds]);

  const visibleTasks = useMemo(
    () => treeSchedule.filter(t => !hiddenIds.has(t.id)),
    [treeSchedule, hiddenIds]
  );

  // ---------------------------------------------------------------------------
  // Task handlers
  // ---------------------------------------------------------------------------

  const handleAddTask = useCallback(async () => {
    try {
      const maxSort = tasks.reduce(
        (max, t) => Math.max(max, t.sortOrder),
        0
      );
      await createTask(client, {
        projectId,
        title: 'New Task',
        tierDepth: 0,
        sortOrder: maxSort + 1,
      });
      await refetch();
      toast.success('Task created');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create task'
      );
    }
  }, [client, projectId, tasks, refetch]);

  const handleAddSubtask = useCallback(
    async (parent: ComputedTask) => {
      try {
        const maxSort = tasks.reduce(
          (max, t) => Math.max(max, t.sortOrder),
          0
        );
        const childDepth = Math.min(parent.tierDepth + 1, 3) as 0 | 1 | 2 | 3;
        await createTask(client, {
          projectId,
          title: 'New Subtask',
          parentTaskId: parent.id,
          tierDepth: childDepth,
          sortOrder: maxSort + 1,
        });
        await refetch();
        toast.success('Subtask created');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to create subtask'
        );
      }
    },
    [client, projectId, tasks, refetch]
  );

  const handleUpdateTask = useCallback(
    async (
      taskId: string,
      updates: Record<string, unknown>,
      depChanges?: {
        add: { upstreamTaskId: string }[];
        remove: string[];
      }
    ) => {
      // Only call updateTask if there are actual field updates
      if (Object.keys(updates).length > 0) {
        await updateTask(client, taskId, updates);
      }

      // Handle dependency changes
      if (depChanges) {
        for (const dep of depChanges.remove) {
          await removeDependency(client, dep);
        }
        for (const dep of depChanges.add) {
          await addDependency(client, {
            projectId,
            upstreamTaskId: dep.upstreamTaskId,
            downstreamTaskId: taskId,
          });
        }
      }

      await refetch();
      toast.success('Task updated');
    },
    [client, projectId, refetch]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        await deleteTask(client, taskId);
        await refetch();
        toast.success('Task deleted');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to delete task'
        );
      }
    },
    [client, refetch]
  );

  // ---------------------------------------------------------------------------
  // Drag-to-reorder handler
  // ---------------------------------------------------------------------------

  const handleReorderTask = useCallback(
    async (taskId: string, targetTaskId: string) => {
      try {
        const draggedTask = treeSchedule.find((t) => t.id === taskId);
        const targetTask = treeSchedule.find((t) => t.id === targetTaskId);
        if (!draggedTask || !targetTask) return;

        // Only allow reordering among siblings (same parentTaskId)
        if (draggedTask.parentTaskId !== targetTask.parentTaskId) {
          toast.error('Can only reorder within the same parent group');
          return;
        }

        const parentId = draggedTask.parentTaskId;

        // Get all siblings in current order
        const siblings = treeSchedule.filter((t) => t.parentTaskId === parentId);

        // Remove dragged task and insert at target position
        const withoutDragged = siblings.filter((t) => t.id !== taskId);
        const targetIdx = withoutDragged.findIndex((t) => t.id === targetTask.id);
        const insertIdx = targetIdx === -1 ? withoutDragged.length : targetIdx;

        const reordered = [
          ...withoutDragged.slice(0, insertIdx),
          draggedTask,
          ...withoutDragged.slice(insertIdx),
        ];

        // Assign new sequential sortOrder values and update changed tasks
        const updates: Promise<unknown>[] = [];
        for (let i = 0; i < reordered.length; i++) {
          const newSortOrder = i + 1;
          if (reordered[i].sortOrder !== newSortOrder) {
            updates.push(
              updateTask(client, reordered[i].id, { sortOrder: newSortOrder })
            );
          }
        }

        if (updates.length > 0) {
          await Promise.all(updates);
          await refetch();
          toast.success('Task reordered');
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to reorder task'
        );
      }
    },
    [client, treeSchedule, refetch]
  );

  // ---------------------------------------------------------------------------
  // Owner handlers
  // ---------------------------------------------------------------------------

  const handleCreateOwner = useCallback(
    async (owner: {
      projectId: string;
      name: string;
      color: string;
      contactInfo?: string;
    }) => {
      await createOwner(client, owner);
      await refetch();
    },
    [client, refetch]
  );

  const handleUpdateOwner = useCallback(
    async (
      ownerId: string,
      updates: Partial<{ name: string; color: string; contactInfo: string | null }>
    ) => {
      await updateOwner(client, ownerId, updates);
      await refetch();
    },
    [client, refetch]
  );

  const handleDeleteOwner = useCallback(
    async (ownerId: string) => {
      await deleteOwner(client, ownerId);
      await refetch();
    },
    [client, refetch]
  );

  // ---------------------------------------------------------------------------
  // Weekend toggle
  // ---------------------------------------------------------------------------

  const handleToggleWeekends = useCallback(async () => {
    if (!project) return;
    try {
      await updateProject(client, project.id, {
        includeWeekends: !project.includeWeekends,
      });
      await refetch();
      toast.success(
        project.includeWeekends
          ? 'Weekends excluded from schedule'
          : 'Weekends included in schedule'
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update setting'
      );
    }
  }, [client, project, refetch]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">
            Failed to load project
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {error.message}
          </p>
          <Button variant="outline" className="mt-4" onClick={refetch}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-3">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {project?.name ?? 'SchedulePlanner'}
            </h1>
            <p className="text-xs text-muted-foreground tracking-wide uppercase mt-0.5">
              Schedule Planner
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isEditor && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveCheckpoint}
                  disabled={saving || schedule.length === 0}
                >
                  {saving ? 'Saving...' : 'Save Checkpoint'}
                </Button>

                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={project?.includeWeekends ?? false}
                    onChange={handleToggleWeekends}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Include weekends
                </label>

                <Button variant="outline" size="sm" onClick={handleAddTask}>
                  Add Task
                </Button>

                <OwnerManager
                  owners={owners}
                  tasks={tasks}
                  projectId={projectId}
                  onCreate={handleCreateOwner}
                  onUpdate={handleUpdateOwner}
                  onDelete={handleDeleteOwner}
                />
              </>
            )}

            <EditToggle />
          </div>
        </div>

        {/* Cyclic dependency error banner */}
        {scheduleError && scheduleError instanceof CyclicDependencyError && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>Circular dependency detected:</strong>{' '}
            {(scheduleError as CyclicDependencyError).cycleTasks.join(
              ' -> '
            )}
          </div>
        )}

        {/* Unified scroll container: single scrollTop controls both panes */}
        <div
          onScroll={handleContainerScroll}
          className="border border-border rounded-lg"
          style={{
            overflow: 'auto',
            height: showProgress
              ? 'calc(100vh - 420px)'
              : 'calc(100vh - 160px)',
          }}
        >
          <div style={{ display: 'flex', minWidth: 'fit-content' }}>
            {/* Frozen task table -- sticky left, scrollable horizontally within 50vw */}
            <div style={{ position: 'sticky', left: 0, zIndex: 10, flexShrink: 0, background: 'var(--background)', width: '50vw', overflowX: 'auto', overflowY: 'hidden' }}>
              <TaskTable
                schedule={treeSchedule}
                visibleTasks={visibleTasks}
                owners={owners}
                dependencies={dependencies}
                onUpdate={handleUpdateTask}
                onDelete={handleDeleteTask}
                onAddTask={handleAddTask}
                onAddSubtask={handleAddSubtask}
                rowHeight={ROW_HEIGHT}
                headerHeight={HEADER_HEIGHT}
                isEditor={isEditor}
                collapsedIds={collapsedIds}
                onToggleCollapse={toggleCollapse}
                onReorder={isEditor ? handleReorderTask : undefined}
                theadRowRef={theadRowRef}
              />
            </div>

            {/* SVG Gantt timeline */}
            <GanttChart
              visibleTasks={visibleTasks}
              allTasks={treeSchedule}
              owners={owners}
              dependencies={dependencies}
            />
          </div>
        </div>

        {/* Collapsible progress panel */}
        {showProgress && (
          <div className="mt-3 border border-border rounded-lg p-4 bg-background">
            <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Progress Tracking
            </h2>
            <ProgressPlot
              plannedCurve={plannedCurve}
              actualProgress={actualProgress}
              checkpoints={checkpoints}
              totalWorkDays={totalWorkDays}
            />
          </div>
        )}

        {/* Progress toggle at bottom */}
        <div className="mt-2 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProgress((prev) => !prev)}
          >
            {showProgress ? (
              <ChevronUp className="size-4 mr-1" />
            ) : (
              <ChevronDown className="size-4 mr-1" />
            )}
            Progress
          </Button>
        </div>
      </div>
    </div>
  );
}
