import { describe, it, expect } from 'vitest';
import { computeSchedule } from '../scheduler';
import type { RawTask, Dependency } from '@/types/scheduling';
import { CyclicDependencyError } from '@/types/scheduling';

function makeTask(
  id: string,
  title: string,
  desiredStartDate: string,
  durationDays: number
): RawTask {
  return {
    id,
    projectId: 'proj-1',
    parentTaskId: null,
    ownerId: null,
    title,
    tierDepth: 0,
    sortOrder: 0,
    desiredStartDate,
    durationDays,
    completionPct: 0,
    notes: null,
  };
}

function makeDep(upstreamId: string, downstreamId: string): Dependency {
  return {
    id: `dep-${upstreamId}-${downstreamId}`,
    projectId: 'proj-1',
    upstreamTaskId: upstreamId,
    downstreamTaskId: downstreamId,
    dependencyType: 'finish-to-start',
  };
}

describe('computeSchedule', () => {
  it('computes a single task with no dependencies', () => {
    // Mon 2026-03-16, duration 3 business days -> end Wed 2026-03-19
    const tasks = [makeTask('a', 'A', '2026-03-16', 3)];
    const result = computeSchedule(tasks, [], false);
    expect(result).toHaveLength(1);
    expect(result[0].requiredStartDate).toBe('2026-03-16');
    expect(result[0].effectiveStartDate).toBe('2026-03-16');
    expect(result[0].endDate).toBe('2026-03-19');
  });

  it('computes two tasks with linear dependency', () => {
    // A: start 03-16, dur 2 -> end 03-18 (Mon+2=Wed)
    // B: desired 03-16, dur 1, depends on A -> required=03-18, effective=03-18, end=03-19
    const tasks = [
      makeTask('a', 'A', '2026-03-16', 2),
      makeTask('b', 'B', '2026-03-16', 1),
    ];
    const deps = [makeDep('a', 'b')];
    const result = computeSchedule(tasks, deps, false);

    const taskB = result.find((t) => t.id === 'b')!;
    expect(taskB.requiredStartDate).toBe('2026-03-18');
    expect(taskB.effectiveStartDate).toBe('2026-03-18');
    expect(taskB.endDate).toBe('2026-03-19');
  });

  it('uses desired start when it is later than required', () => {
    // A: start 03-16, dur 1 -> end 03-17
    // B: desired 03-25, dur 1, depends on A -> required=03-17, effective=03-25 (desired wins), end=03-26
    const tasks = [
      makeTask('a', 'A', '2026-03-16', 1),
      makeTask('b', 'B', '2026-03-25', 1),
    ];
    const deps = [makeDep('a', 'b')];
    const result = computeSchedule(tasks, deps, false);

    const taskB = result.find((t) => t.id === 'b')!;
    expect(taskB.requiredStartDate).toBe('2026-03-17');
    expect(taskB.effectiveStartDate).toBe('2026-03-25');
    expect(taskB.endDate).toBe('2026-03-26');
  });

  it('computes diamond dependency correctly', () => {
    // A(03-16, dur 1) -> B(dur 2), A -> C(dur 3), B+C -> D(dur 1)
    // A end = 03-17
    // B: required=03-17, effective=03-17, end=03-19 (Tue+2=Thu)
    // C: required=03-17, effective=03-17, end=03-20 (Tue+3=Fri)
    // D: required=max(03-19,03-20)=03-20, effective=03-20, end=03-23 (Fri+1=Mon)
    const tasks = [
      makeTask('a', 'A', '2026-03-16', 1),
      makeTask('b', 'B', '2026-03-16', 2),
      makeTask('c', 'C', '2026-03-16', 3),
      makeTask('d', 'D', '2026-03-16', 1),
    ];
    const deps = [makeDep('a', 'b'), makeDep('a', 'c'), makeDep('b', 'd'), makeDep('c', 'd')];
    const result = computeSchedule(tasks, deps, false);

    const taskD = result.find((t) => t.id === 'd')!;
    expect(taskD.requiredStartDate).toBe('2026-03-20');
    expect(taskD.effectiveStartDate).toBe('2026-03-20');
    expect(taskD.endDate).toBe('2026-03-23');
  });

  it('produces different dates with includeWeekends toggle', () => {
    // Fri 03-20, dur 2
    // Business days: Fri + 2 = Tue 03-24
    // Calendar days: Fri + 2 = Sun 03-22
    const tasks = [makeTask('a', 'A', '2026-03-20', 2)];
    const biz = computeSchedule(tasks, [], false);
    const cal = computeSchedule(tasks, [], true);
    expect(biz[0].endDate).not.toBe(cal[0].endDate);
    expect(biz[0].endDate).toBe('2026-03-24');
    expect(cal[0].endDate).toBe('2026-03-22');
  });

  it('throws CyclicDependencyError for cycles', () => {
    const tasks = [
      makeTask('a', 'A', '2026-03-16', 1),
      makeTask('b', 'B', '2026-03-16', 1),
    ];
    const deps = [makeDep('a', 'b'), makeDep('b', 'a')];
    expect(() => computeSchedule(tasks, deps, false)).toThrow(CyclicDependencyError);
    try {
      computeSchedule(tasks, deps, false);
    } catch (e) {
      expect(e).toBeInstanceOf(CyclicDependencyError);
      expect((e as CyclicDependencyError).cycleTasks).toContain('A');
      expect((e as CyclicDependencyError).cycleTasks).toContain('B');
    }
  });

  it('returns empty array for empty task list', () => {
    expect(computeSchedule([], [], false)).toEqual([]);
  });
});
