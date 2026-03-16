'use client';

import { useMemo } from 'react';
import { computeSchedule } from '@/lib/scheduling/scheduler';
import type { RawTask, ComputedTask, Dependency } from '@/types/scheduling';
import { CyclicDependencyError } from '@/types/scheduling';

export function useSchedule(
  tasks: RawTask[],
  dependencies: Dependency[],
  includeWeekends: boolean
): { schedule: ComputedTask[]; error: Error | null } {
  return useMemo(() => {
    try {
      const schedule = computeSchedule(tasks, dependencies, includeWeekends);
      return { schedule, error: null };
    } catch (err) {
      if (err instanceof CyclicDependencyError) {
        return { schedule: [], error: err };
      }
      return {
        schedule: [],
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }, [tasks, dependencies, includeWeekends]);
}
