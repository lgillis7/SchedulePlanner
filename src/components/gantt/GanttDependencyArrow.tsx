import { BAR_HEIGHT } from './gantt-utils';

interface GanttDependencyArrowProps {
  sourceEndX: number;
  sourceY: number;
  targetStartX: number;
  targetY: number;
}

export function GanttDependencyArrow({
  sourceEndX,
  sourceY,
  targetStartX,
  targetY,
}: GanttDependencyArrowProps) {
  const sourceCenterY = sourceY + BAR_HEIGHT / 2;
  const targetCenterY = targetY + BAR_HEIGHT / 2;
  const midX = (sourceEndX + targetStartX) / 2;

  // Right-angle connector path
  const pathD = [
    `M ${sourceEndX} ${sourceCenterY}`,
    `H ${midX}`,
    `V ${targetCenterY}`,
    `H ${targetStartX}`,
  ].join(' ');

  // Small arrowhead triangle pointing right (4px)
  const arrowD = [
    `M ${targetStartX} ${targetCenterY}`,
    `L ${targetStartX - 4} ${targetCenterY - 3}`,
    `L ${targetStartX - 4} ${targetCenterY + 3}`,
    'Z',
  ].join(' ');

  return (
    <g>
      <path
        d={pathD}
        stroke="#94A3B8"
        strokeWidth={1.5}
        fill="none"
      />
      <path
        d={arrowD}
        fill="#94A3B8"
      />
    </g>
  );
}
