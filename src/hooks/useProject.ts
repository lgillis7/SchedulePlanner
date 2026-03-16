'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getProjectWithData } from '@/lib/supabase/queries';
import type { Project, RawTask, Dependency, Owner } from '@/types/scheduling';

export function useProject(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<RawTask[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const client = createClient();
      const data = await getProjectWithData(client, projectId);
      setProject(data.project);
      setTasks(data.tasks);
      setDependencies(data.dependencies);
      setOwners(data.owners);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    project,
    tasks,
    dependencies,
    owners,
    loading,
    error,
    refetch: fetchData,
  };
}
