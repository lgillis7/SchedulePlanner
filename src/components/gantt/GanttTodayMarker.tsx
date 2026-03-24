import { format } from 'date-fns';
import { dateToX, DAY_WIDTH } from './gantt-utils';

interface GanttTodayMarkerProps {
  rangeStart: Date;
  totalHeight: number;
}

export function GanttTodayMarker({ rangeStart, totalHeight }: GanttTodayMarkerProps) {
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const x = dateToX(todayISO, rangeStart);

  // Only render if today is within visible range
  // We don't know totalDays here, but we can check x >= 0 and use totalHeight as proxy
  if (x < 0) return null;

  return (
    <line
      x1={x}
      y1={0}
      x2={x}
      y2={totalHeight}
      stroke="#EF4444"
      strokeWidth={1.5}
      strokeDasharray="4 3"
    />
  );
}
