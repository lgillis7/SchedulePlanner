import type { ComputedTask } from '@/types/scheduling';
import {
  dateToX,
  DAY_WIDTH,
  ROW_HEIGHT,
  BAR_HEIGHT,
  BAR_Y_OFFSET,
  HEADER_HEIGHT,
} from './gantt-utils';

const DEFAULT_COLOR = '#94A3B8'; // slate-400

interface GanttBarProps {
  task: ComputedTask;
  rowIndex: number;
  rangeStart: Date;
  ownerColor: string;
}

export function GanttBar({ task, rowIndex, rangeStart, ownerColor }: GanttBarProps) {
  const x = dateToX(task.effectiveStartDate, rangeStart);
  const rawWidth = dateToX(task.endDate, rangeStart) - x;
  const width = Math.max(rawWidth, DAY_WIDTH); // minimum one day
  const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT + BAR_Y_OFFSET;
  const color = ownerColor || DEFAULT_COLOR;

  return (
    <g>
      {/* Background bar */}
      <rect
        x={x}
        y={y}
        width={width}
        height={BAR_HEIGHT}
        rx={3}
        fill={color}
        opacity={0.35}
      />
      {/* Completion fill */}
      {task.completionPct > 0 && (
        <rect
          x={x}
          y={y}
          width={width * (task.completionPct / 100)}
          height={BAR_HEIGHT}
          rx={3}
          fill={color}
          opacity={0.85}
        />
      )}
    </g>
  );
}
