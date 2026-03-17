'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createEditorClient } from '@/lib/supabase/editor-client';
import { getCheckpoints, createCheckpoint } from '@/lib/supabase/queries';
import type { Checkpoint } from '@/types/scheduling';

export function useCheckpoints(
  projectId: string,
  isEditor: boolean,
  editorToken: string | null
) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const client = useMemo(() => {
    if (isEditor && editorToken) {
      return createEditorClient(editorToken);
    }
    return createClient();
  }, [isEditor, editorToken]);

  const fetchCheckpoints = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCheckpoints(client, projectId);
      setCheckpoints(data);
    } catch (err) {
      console.error('Failed to fetch checkpoints:', err);
    } finally {
      setLoading(false);
    }
  }, [client, projectId]);

  useEffect(() => {
    fetchCheckpoints();
  }, [fetchCheckpoints]);

  const saveCheckpoint = useCallback(
    async (totalWorkDays: number, completedWorkDays: number) => {
      try {
        setSaving(true);
        const created = await createCheckpoint(client, {
          projectId,
          totalWorkDays,
          completedWorkDays,
        });
        setCheckpoints((prev) => [...prev, created]);
      } catch (err) {
        console.error('Failed to save checkpoint:', err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [client, projectId]
  );

  return {
    checkpoints,
    loading,
    saving,
    saveCheckpoint,
    refetch: fetchCheckpoints,
  };
}
