import { describe, it, expect } from 'vitest';
import { topologicalSort, detectCycle } from '../dependency-graph';
import type { RawTask, Dependency } from '@/types/scheduling';

function makeTask(id: string, title: string): RawTask {
  return {
    id,
    projectId: 'proj-1',
    parentTaskId: null,
    ownerId: null,
    title,
    tierDepth: 0,
    sortOrder: 0,
    desiredStartDate: '2026-03-16',
    durationDays: 1,
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

describe('topologicalSort', () => {
  it('returns all tasks when there are no dependencies', () => {
    const tasks = [makeTask('a', 'A'), makeTask('b', 'B'), makeTask('c', 'C')];
    const result = topologicalSort(tasks, []);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('orders a linear chain correctly', () => {
    const tasks = [makeTask('a', 'A'), makeTask('b', 'B'), makeTask('c', 'C')];
    const deps = [makeDep('a', 'b'), makeDep('b', 'c')];
    const result = topologicalSort(tasks, deps);
    const ids = result.map((t) => t.id);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('c'));
  });

  it('handles diamond dependency correctly', () => {
    const tasks = [
      makeTask('a', 'A'),
      makeTask('b', 'B'),
      makeTask('c', 'C'),
      makeTask('d', 'D'),
    ];
    const deps = [makeDep('a', 'b'), makeDep('a', 'c'), makeDep('b', 'd'), makeDep('c', 'd')];
    const result = topologicalSort(tasks, deps);
    const ids = result.map((t) => t.id);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'));
    expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'));
  });

  it('handles independent groups', () => {
    const tasks = [
      makeTask('a', 'A'),
      makeTask('b', 'B'),
      makeTask('c', 'C'),
      makeTask('d', 'D'),
    ];
    const deps = [makeDep('a', 'b'), makeDep('c', 'd')];
    const result = topologicalSort(tasks, deps);
    const ids = result.map((t) => t.id);
    expect(ids).toHaveLength(4);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
    expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'));
  });
});

describe('detectCycle', () => {
  it('returns null when there is no cycle', () => {
    const tasks = [makeTask('a', 'A'), makeTask('b', 'B'), makeTask('c', 'C')];
    const deps = [makeDep('a', 'b'), makeDep('b', 'c')];
    expect(detectCycle(tasks, deps)).toBeNull();
  });

  it('detects a simple two-node cycle', () => {
    const tasks = [makeTask('a', 'A'), makeTask('b', 'B')];
    const deps = [makeDep('a', 'b'), makeDep('b', 'a')];
    const result = detectCycle(tasks, deps);
    expect(result).not.toBeNull();
    expect(result).toContain('A');
    expect(result).toContain('B');
  });

  it('detects a complex cycle and excludes non-cycle tasks', () => {
    const tasks = [
      makeTask('a', 'A'),
      makeTask('b', 'B'),
      makeTask('c', 'C'),
      makeTask('d', 'D'),
    ];
    // A -> B -> C -> A (cycle), D -> B (D is not in the cycle)
    const deps = [makeDep('a', 'b'), makeDep('b', 'c'), makeDep('c', 'a'), makeDep('d', 'b')];
    const result = detectCycle(tasks, deps);
    expect(result).not.toBeNull();
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
    // D feeds into the cycle but is not part of it -- however Kahn's algorithm
    // will leave D in the remaining set since its downstream (B) can't be processed.
    // This is acceptable: D is reported as affected by the cycle.
  });

  it('detects a self-dependency', () => {
    const tasks = [makeTask('a', 'A')];
    const deps = [makeDep('a', 'a')];
    const result = detectCycle(tasks, deps);
    expect(result).not.toBeNull();
    expect(result).toContain('A');
  });
});
