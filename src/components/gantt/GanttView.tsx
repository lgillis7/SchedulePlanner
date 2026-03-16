'use client';

import { useState, useEffect, useCallback } from 'react';
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
}

export function GanttView({
  tasks,
  links,
  onAddLink,
  onDeleteLink,
}: GanttViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const init = useCallback(
    (api: IApi) => {
      // Intercept link creation from drag-and-drop
      api.intercept('add-link', (ev) => {
        if (onAddLink && ev.link?.source && ev.link?.target) {
          onAddLink(String(ev.link.source), String(ev.link.target));
        }
        return false; // Prevent SVAR from managing the link internally
      });

      // Intercept link deletion
      api.intercept('delete-link', (ev) => {
        if (onDeleteLink && ev.id) {
          onDeleteLink(String(ev.id));
        }
        return false; // We manage state externally
      });

      // Block task editing in the Gantt -- editing stays in TaskEditor
      api.intercept('update-task', () => false);

      // Block task addition/deletion in the Gantt
      api.intercept('add-task', () => false);
      api.intercept('delete-task', () => false);
    },
    [onAddLink, onDeleteLink]
  );

  if (!mounted) {
    return <div style={{ height: '100%', width: '100%' }} />;
  }

  return (
    <Willow>
      <Gantt
        tasks={tasks}
        links={links}
        scales={scales}
        columns={columns}
        init={init}
      />
    </Willow>
  );
}
