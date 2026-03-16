'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useProject } from '@/hooks/useProject';
import { useSchedule } from '@/hooks/useSchedule';
import { createClient } from '@/lib/supabase/client';
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
import { toSvarTasks, toSvarLinks } from '@/components/gantt/gantt-adapter';
import { OwnerManager } from '@/components/owners/OwnerManager';
import { Button } from '@/components/ui/button';
import type { ComputedTask } from '@/types/scheduling';
import { CyclicDependencyError } from '@/types/scheduling';

const DEFAULT_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

export default function HomePage() {
  const { project, tasks, dependencies, owners, loading, error, refetch } =
    useProject(DEFAULT_PROJECT_ID);
  const { schedule, error: scheduleError } = useSchedule(
    tasks,
    dependencies,
    project?.includeWeekends ?? false
  );

  const client = createClient();

  // ---------------------------------------------------------------------------
  // SVAR Gantt data transforms (memoized)
  // ---------------------------------------------------------------------------

  const svarTasks = useMemo(
    () => toSvarTasks(schedule, owners),
    [schedule, owners]
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
      try {
        await addDependency(client, {
          projectId: DEFAULT_PROJECT_ID,
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
    [client, refetch]
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
        projectId: DEFAULT_PROJECT_ID,
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
  }, [client, tasks, refetch]);

  const handleAddSubtask = useCallback(
    async (parent: ComputedTask) => {
      try {
        const maxSort = tasks.reduce(
          (max, t) => Math.max(max, t.sortOrder),
          0
        );
        const childDepth = Math.min(parent.tierDepth + 1, 3) as 0 | 1 | 2 | 3;
        await createTask(client, {
          projectId: DEFAULT_PROJECT_ID,
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
    [client, tasks, refetch]
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
            projectId: DEFAULT_PROJECT_ID,
            upstreamTaskId: dep.upstreamTaskId,
            downstreamTaskId: taskId,
          });
        }
      }

      await refetch();
      toast.success('Task updated');
    },
    [client, refetch]
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

  if (loading) {
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
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project?.name ?? 'SchedulePlanner'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Home renovation project scheduling tool
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Weekend Toggle */}
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
              projectId={DEFAULT_PROJECT_ID}
              onCreate={handleCreateOwner}
              onUpdate={handleUpdateOwner}
              onDelete={handleDeleteOwner}
            />
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

        {/* Gantt Chart */}
        <div style={{ height: 'calc(100vh - 200px)' }}>
          <GanttView
            tasks={svarTasks}
            links={svarLinks}
            onAddLink={handleAddLink}
            onDeleteLink={handleDeleteLink}
          />
        </div>
      </div>
    </div>
  );
}
