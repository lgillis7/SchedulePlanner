'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Gantt, Willow } from '@svar-ui/react-gantt';
import type { IApi } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import type { SvarTask, SvarLink } from './gantt-adapter';
import { scales, columns } from './gantt-config';

interface GanttViewProps {
  tasks: SvarTask[];
  links: SvarLink[];
  onAddLink?: (sourceId: string, targetId: string) => void;
  onDeleteLink?: (linkId: string) => void;
  /** Called once with the SVAR API after initialization */
  onInit?: (api: IApi) => void;
  /** Row height in pixels — must match the task table row height for scroll sync */
  cellHeight?: number;
  /** Height per scale row in pixels */
  scaleHeight?: number;
  /** When false, hides the left-side grid (columns={false}) */
  showGrid?: boolean;
  /** When false, hides link drag circles for read-only mode */
  isEditor?: boolean;
}

export function GanttView({
  tasks,
  links,
  onAddLink,
  onDeleteLink,
  onInit,
  cellHeight,
  scaleHeight,
  showGrid = true,
  isEditor = false,
}: GanttViewProps) {
  const [mounted, setMounted] = useState(false);

  // Use refs for callbacks so `init` stays stable (called once by SVAR on mount)
  const cbRef = useRef({ onAddLink, onDeleteLink, onInit });
  cbRef.current = { onAddLink, onDeleteLink, onInit };

  useEffect(() => {
    setMounted(true);
  }, []);

  const init = useCallback((api: IApi) => {
    cbRef.current.onInit?.(api);

    // Intercept link creation from click-to-link
    api.intercept('add-link', (ev) => {
      const { onAddLink } = cbRef.current;
      if (onAddLink && ev.link?.source && ev.link?.target) {
        onAddLink(String(ev.link.source), String(ev.link.target));
      }
      return false; // We manage state externally
    });

    // Intercept link deletion (x-button or delete key)
    api.intercept('delete-link', (ev) => {
      const { onDeleteLink } = cbRef.current;
      if (onDeleteLink && ev.id) {
        onDeleteLink(String(ev.id));
      }
      return false;
    });

    // Block all task mutations — editing stays in the TaskTable
    api.intercept('update-task', () => false);
    api.intercept('drag-task', () => false);
    api.intercept('move-task', () => false);
    api.intercept('add-task', () => false);
    api.intercept('delete-task', () => false);
  }, []); // stable — uses refs

  if (!mounted) {
    return <div style={{ height: '100%', width: '100%' }} />;
  }

  return (
    <Willow>
      <style>{`
        ${isEditor
          ? `/* Only show right (output) link circle on bar hover by default.
              Left (input) circles appear only when SVAR enters linking mode (.wx-target). */
            .wx-link.wx-left:not(.wx-target):not(.wx-visible) {
              opacity: 0 !important;
              pointer-events: none !important;
            }
            .wx-link.wx-left.wx-target,
            .wx-link.wx-left.wx-visible {
              opacity: 1 !important;
              pointer-events: auto !important;
            }`
          : `/* Read-only: hide all link drag circles */
            .wx-link {
              display: none !important;
            }`
        }
      `}</style>
      <Gantt
        tasks={tasks}
        links={links}
        scales={scales}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        columns={(showGrid ? columns : false) as any}
        init={init}
        {...(cellHeight != null ? { cellHeight } : {})}
        {...(scaleHeight != null ? { scaleHeight } : {})}
      />
    </Willow>
  );
}
