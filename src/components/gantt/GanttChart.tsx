'use client';

import { useMemo } from 'react';
import { eachDayOfInterval, isWeekend } from 'date-fns';
import type { ComputedTask, Owner, Dependency } from '@/types/scheduling';
import {
  computeDateRange,
  dateToX,
  DAY_WIDTH,
  ROW_HEIGHT,
  BAR_Y_OFFSET,
  HEADER_HEIGHT,
} from './gantt-utils';
import { GanttBar } from './GanttBar';
import { GanttTimescale } from './GanttTimescale';
import { GanttDependencyArrow } from './GanttDependencyArrow';
import { GanttTodayMarker } from './GanttTodayMarker';

export interface GanttChartProps {
  /** Filtered, tree-sorted tasks (same array the table renders) */
  visibleTasks: ComputedTask[];
  /** All tasks for date range calculation (not filtered by collapse) */
  allTasks: ComputedTask[];
  owners: Owner[];
  dependencies: Dependency[];
}

export function GanttChart({
  visibleTasks,
  allTasks,
  owners,
  dependencies,
}: GanttChartProps) {
  const ownerMap = useMemo(
    () => new Map(owners.map((o) => [o.id, o])),
    [owners]
  );

  const range = useMemo(() => computeDateRange(allTasks), [allTasks]);

  const taskIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    visibleTasks.forEach((t, i) => map.set(t.id, i));
    return map;
  }, [visibleTasks]);

  const svgWidth = range.totalDays * DAY_WIDTH;
  const bodyHeight = visibleTasks.length * ROW_HEIGHT;
  const totalHeight = HEADER_HEIGHT + bodyHeight;

  // Weekend shading columns
  const weekendRects = useMemo(() => {
    const days = eachDayOfInterval({ start: range.startDate, end: range.endDate });
    return days
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => isWeekend(d))
      .map(({ i }) => (
        <rect
          key={`weekend-${i}`}
          x={i * DAY_WIDTH}
          y={HEADER_HEIGHT}
          width={DAY_WIDTH}
          height={bodyHeight}
          fill="var(--muted)"
          opacity={0.3}
        />
      ));
  }, [range, bodyHeight]);

  // Dependency arrows -- only for pairs where BOTH tasks are visible
  const arrows = useMemo(() => {
    return dependencies
      .filter(
        (dep) =>
          taskIndexMap.has(dep.upstreamTaskId) &&
          taskIndexMap.has(dep.downstreamTaskId)
      )
      .map((dep) => {
        const srcIdx = taskIndexMap.get(dep.upstreamTaskId)!;
        const tgtIdx = taskIndexMap.get(dep.downstreamTaskId)!;
        const srcTask = visibleTasks[srcIdx];
        const tgtTask = visibleTasks[tgtIdx];
        return (
          <GanttDependencyArrow
            key={dep.id}
            sourceEndX={dateToX(srcTask.endDate, range.startDate)}
            sourceY={HEADER_HEIGHT + srcIdx * ROW_HEIGHT + BAR_Y_OFFSET}
            targetStartX={dateToX(tgtTask.effectiveStartDate, range.startDate)}
            targetY={HEADER_HEIGHT + tgtIdx * ROW_HEIGHT + BAR_Y_OFFSET}
          />
        );
      });
  }, [dependencies, taskIndexMap, visibleTasks, range]);

  return (
    <svg
      width={svgWidth}
      height={totalHeight}
      style={{ flexShrink: 0, display: 'block' }}
    >
      <GanttTimescale range={range} />
      {weekendRects}
      {visibleTasks.map((task, idx) => (
        <GanttBar
          key={task.id}
          task={task}
          rowIndex={idx}
          rangeStart={range.startDate}
          ownerColor={
            task.ownerId
              ? (ownerMap.get(task.ownerId)?.color ?? '#94A3B8')
              : '#94A3B8'
          }
        />
      ))}
      {arrows}
      <GanttTodayMarker rangeStart={range.startDate} totalHeight={totalHeight} />
    </svg>
  );
}
