import { eachDayOfInterval, getMonth, getYear, format, isWeekend } from 'date-fns';
import { DAY_WIDTH, type DateRange } from './gantt-utils';

interface GanttTimescaleProps {
  range: DateRange;
}

interface MonthGroup {
  label: string;
  startIndex: number;
  count: number;
}

export function GanttTimescale({ range }: GanttTimescaleProps) {
  const days = eachDayOfInterval({ start: range.startDate, end: range.endDate });

  // Group consecutive days by month+year
  const monthGroups: MonthGroup[] = [];
  let current: MonthGroup | null = null;

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const key = `${getYear(d)}-${getMonth(d)}`;
    const prevKey =
      current !== null
        ? `${getYear(days[current.startIndex])}-${getMonth(days[current.startIndex])}`
        : null;

    if (key !== prevKey) {
      current = { label: format(d, 'MMM yyyy'), startIndex: i, count: 1 };
      monthGroups.push(current);
    } else {
      current!.count++;
    }
  }

  return (
    <g className="gantt-timescale">
      {/* Top row: month+year labels */}
      {monthGroups.map((group) => {
        const x = group.startIndex * DAY_WIDTH;
        const w = group.count * DAY_WIDTH;
        return (
          <g key={`month-${group.startIndex}`}>
            <rect
              x={x}
              y={0}
              width={w}
              height={20}
              fill="none"
              stroke="var(--border)"
              strokeWidth={0.5}
            />
            <text
              x={x + w / 2}
              y={14}
              textAnchor="middle"
              fill="var(--muted-foreground)"
              fontSize={11}
              fontWeight={500}
            >
              {group.label}
            </text>
          </g>
        );
      })}

      {/* Bottom row: day numbers */}
      {days.map((d, i) => {
        const x = i * DAY_WIDTH;
        const weekend = isWeekend(d);
        return (
          <g key={`day-${i}`}>
            {weekend && (
              <rect
                x={x}
                y={20}
                width={DAY_WIDTH}
                height={20}
                fill="var(--muted)"
                opacity={0.5}
              />
            )}
            <rect
              x={x}
              y={20}
              width={DAY_WIDTH}
              height={20}
              fill="none"
              stroke="var(--border)"
              strokeWidth={0.5}
            />
            <text
              x={x + DAY_WIDTH / 2}
              y={34}
              textAnchor="middle"
              fill="var(--muted-foreground)"
              fontSize={10}
            >
              {format(d, 'd')}
            </text>
          </g>
        );
      })}
    </g>
  );
}
