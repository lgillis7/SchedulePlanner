'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { ProgressPoint } from '@/lib/progress/curve-calculator';
import type { Checkpoint } from '@/types/scheduling';

interface ProgressPlotProps {
  plannedCurve: ProgressPoint[];
  actualProgress: number;
  checkpoints: Checkpoint[];
  totalWorkDays: number;
}

/** Glowing dot for today's actual progress point. */
function GlowDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={7}
      fill="oklch(0.809 0.105 251.813)"
      stroke="oklch(0.809 0.105 251.813)"
      strokeWidth={2}
      style={{ filter: 'drop-shadow(0 0 8px oklch(0.809 0.105 251.813))' }}
    />
  );
}

interface MergedPoint {
  date: string;
  planned?: number;
  asBuilt?: number;
  actual?: number;
}

export function ProgressPlot({
  plannedCurve,
  actualProgress,
  checkpoints,
  totalWorkDays,
}: ProgressPlotProps) {
  const data = useMemo(() => {
    if (plannedCurve.length === 0) return [];

    const map = new Map<string, MergedPoint>();

    // Planned curve
    for (const pt of plannedCurve) {
      map.set(pt.date, { date: pt.date, planned: pt.planned });
    }

    // As-built curve from checkpoints
    for (const cp of checkpoints) {
      const d = format(parseISO(cp.capturedAt), 'yyyy-MM-dd');
      const existing = map.get(d) ?? { date: d };
      existing.asBuilt = cp.completedWorkDays;
      map.set(d, existing);
    }

    // Today's actual progress
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayEntry = map.get(today) ?? { date: today };
    todayEntry.actual = actualProgress;
    map.set(today, todayEntry);

    // Sort by date
    return Array.from(map.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [plannedCurve, actualProgress, checkpoints]);

  const hasCheckpoints = checkpoints.length > 0;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  if (plannedCurve.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center">
        <p className="text-sm text-muted-foreground">No tasks to plot</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => {
            try {
              return format(parseISO(value), 'MMM d');
            } catch {
              return value;
            }
          }}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, totalWorkDays || 'auto']}
          tick={{ fontSize: 11 }}
          label={{
            value: 'Work Days',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 11, fill: 'oklch(0.556 0.022 257.417)' },
          }}
        />
        <Tooltip
          labelFormatter={(label) => {
            try {
              return format(parseISO(String(label)), 'MMM d, yyyy');
            } catch {
              return String(label);
            }
          }}
          formatter={(value, name) => [
            `${Math.round(Number(value) * 10) / 10} days`,
            String(name),
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid oklch(0.274 0.006 286.033)',
            backgroundColor: 'oklch(0.145 0.005 286.067)',
          }}
        />
        <ReferenceLine
          x={todayStr}
          stroke="oklch(0.556 0.022 257.417)"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        <Line
          type="monotone"
          dataKey="planned"
          stroke="oklch(0.556 0.022 257.417)"
          strokeWidth={2}
          dot={false}
          name="Planned"
          connectNulls
        />
        {hasCheckpoints && (
          <Line
            type="monotone"
            dataKey="asBuilt"
            stroke="oklch(0.696 0.17 162.48)"
            strokeWidth={2}
            connectNulls
            dot={{ r: 3 }}
            name="As Built"
          />
        )}
        <Scatter
          dataKey="actual"
          shape={<GlowDot />}
          name="Current Progress"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
