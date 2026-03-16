import { format, parseISO } from 'date-fns';

/**
 * Format an ISO date string (YYYY-MM-DD) to a locale-friendly display.
 * Example: "2026-03-16" -> "Mar 16, 2026"
 */
export function formatDate(isoString: string): string {
  return format(parseISO(isoString), 'MMM d, yyyy');
}

/**
 * Returns Tailwind classes for task hierarchy formatting based on tier depth.
 */
export function tierStyles(depth: number): string {
  switch (depth) {
    case 0:
      return 'text-lg font-bold';
    case 1:
      return 'text-base font-semibold';
    case 2:
      return 'text-sm font-medium';
    case 3:
    default:
      return 'text-sm font-normal text-muted-foreground';
  }
}

/**
 * Returns Tailwind padding class for hierarchy indentation.
 * Each depth level adds 4 units (16px) of left padding.
 */
export function tierIndent(depth: number): string {
  switch (depth) {
    case 0:
      return 'pl-0';
    case 1:
      return 'pl-4';
    case 2:
      return 'pl-8';
    case 3:
    default:
      return 'pl-12';
  }
}
