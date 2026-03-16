import type { IScaleConfig, IGanttColumn } from '@svar-ui/react-gantt';

/**
 * Timeline scales: month header + day detail.
 * Good for renovation projects spanning weeks to months.
 */
export const scales: IScaleConfig[] = [
  { unit: 'month', step: 1, format: '%M %Y' },
  { unit: 'day', step: 1, format: '%d' },
];

/**
 * Grid columns for the left task-list pane.
 * Keep minimal -- full task editing stays in the existing TaskEditor.
 */
export const columns: IGanttColumn[] = [
  { id: 'text', header: 'Task', flexgrow: 1 },
];
