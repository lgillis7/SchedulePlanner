import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProjectBySlug } from '@/lib/supabase/queries';
import ScheduleClient from './ScheduleClient';

interface SchedulePageProps {
  params: Promise<{ slug: string }>;
}

export default async function SchedulePage({ params }: SchedulePageProps) {
  const { slug } = await params;
  const client = await createClient();
  const project = await getProjectBySlug(client, slug);

  if (!project) {
    notFound();
  }

  return <ScheduleClient projectId={project.id} />;
}
