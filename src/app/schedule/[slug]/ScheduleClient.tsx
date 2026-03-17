'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { IApi } from '@svar-ui/react-gantt';
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
import { GanttView } from '@/components/gantt/GanttView';
import {
  toSvarTasks,
  toSvarLinks,
  treeSortTasks,
} from '@/components/gantt/gantt-adapter';
import { TaskTable } from '@/components/task-list/TaskTable';
import { OwnerManager } from '@/components/owners/OwnerManager';
import { EditToggle } from '@/components/auth/EditToggle';
import { ProgressPlot } from '@/components/progress/ProgressPlot';
import { Button } from '@/components/ui/button';
import type { ComputedTask, Dependency } from '@/types/scheduling';
import { CyclicDependencyError } from '@/types/scheduling';
import { detectCycle } from '@/lib/scheduling/dependency-graph';

const ROW_HEIGHT = 34;
const SCALE_HEIGHT = 20;

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
  // Scroll sync refs
  // ---------------------------------------------------------------------------

  const ganttApiRef = useRef<IApi | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const scrollSourceRef = useRef<'table' | 'gantt' | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleGanttInit = useCallback((api: IApi) => {
    ganttApiRef.current = api;

    // Gantt scrolls -> sync table
    api.on('scroll-chart', (ev: { top?: number }) => {
      if (scrollSourceRef.current === 'table') return;
      scrollSourceRef.current = 'gantt';
      clearTimeout(scrollTimeoutRef.current);
      if (tableContainerRef.current && ev.top != null) {
        tableContainerRef.current.scrollTop = ev.top;
      }
      scrollTimeoutRef.current = setTimeout(() => {
        scrollSourceRef.current = null;
      }, 100);
    });
  }, []);

  const handleTableScroll = useCallback(() => {
    if (scrollSourceRef.current === 'gantt') return;
    scrollSourceRef.current = 'table';
    clearTimeout(scrollTimeoutRef.current);
    const top = tableContainerRef.current?.scrollTop ?? 0;
    ganttApiRef.current?.exec('scroll-chart', { top });
    scrollTimeoutRef.current = setTimeout(() => {
      scrollSourceRef.current = null;
    }, 100);
  }, []);

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
  // SVAR Gantt data transforms (memoized, tree-sorted for alignment)
  // ---------------------------------------------------------------------------

  const treeSchedule = useMemo(
    () => treeSortTasks(schedule),
    [schedule]
  );

  const svarTasks = useMemo(
    () => toSvarTasks(treeSchedule, owners, collapsedIds),
    [treeSchedule, owners, collapsedIds]
  );
  const svarLinks = useMemo(
    () => toSvarLinks(dependencies),
    [dependencies]
  );

  // ---------------------------------------------------------------------------
  // Gantt link event handlers
  // ---------------------------------------------------------------------------

  const handleAddLink = useCallback(
    async (sourceId: string, targetId: string) => {
      // Pre-flight cycle check before hitting the database
      const proposedDeps: Dependency[] = [
        ...dependencies,
        {
          id: 'temp',
          projectId,
          upstreamTaskId: sourceId,
          downstreamTaskId: targetId,
          dependencyType: 'finish-to-start' as const,
        },
      ];
      const cycle = detectCycle(tasks, proposedDeps);
      if (cycle !== null) {
        toast.error(`Circular dependency: ${cycle.join(' \u2192 ')}`);
        return;
      }

      try {
        await addDependency(client, {
          projectId,
          upstreamTaskId: sourceId,
          downstreamTaskId: targetId,
        });
        await refetch();
        toast.success('Dependency created');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to create dependency'
        );
      }
    },
    [client, projectId, tasks, dependencies, refetch]
  );

  const handleDeleteLink = useCallback(
    async (linkId: string) => {
      try {
        await removeDependency(client, linkId);
        await refetch();
        toast.success('Dependency removed');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to remove dependency'
        );
      }
    },
    [client, refetch]
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
      await updateTask(client, taskId, updates);

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

  // Total scale header = 2 scales x SCALE_HEIGHT
  const scaleHeaderHeight = 2 * SCALE_HEIGHT;

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

        {/* Split-pane: TaskTable (left) | Gantt timeline (right) */}
        <div
          className="flex border border-border rounded-lg overflow-hidden"
          style={{
            height: showProgress
              ? 'calc(100vh - 420px)'
              : 'calc(100vh - 120px)',
          }}
        >
          {/* Left pane -- editable task table */}
          <div
            ref={tableContainerRef}
            className="min-w-0 overflow-auto border-r border-border"
            style={{
              width: '55%',
              scrollbarWidth: 'none',
            }}
            onScroll={handleTableScroll}
          >
            <style>{`
              .gantt-table-scroll::-webkit-scrollbar { width: 0; height: auto; }
            `}</style>
            <div className="gantt-table-scroll">
              <TaskTable
                schedule={treeSchedule}
                owners={owners}
                dependencies={dependencies}
                onUpdate={handleUpdateTask}
                onDelete={handleDeleteTask}
                onAddTask={handleAddTask}
                onAddSubtask={handleAddSubtask}
                rowHeight={ROW_HEIGHT}
                headerHeight={scaleHeaderHeight}
                isEditor={isEditor}
                collapsedIds={collapsedIds}
                onToggleCollapse={toggleCollapse}
              />
            </div>
          </div>

          {/* Right pane -- Gantt timeline only */}
          <div className="min-w-0 flex flex-col" style={{ width: '45%' }}>
            <GanttView
              tasks={svarTasks}
              links={svarLinks}
              onAddLink={isEditor ? handleAddLink : undefined}
              onDeleteLink={isEditor ? handleDeleteLink : undefined}
              onInit={handleGanttInit}
              showGrid={false}
              cellHeight={ROW_HEIGHT}
              scaleHeight={SCALE_HEIGHT}
              isEditor={isEditor}
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
      </div>
    </div>
  );
}
