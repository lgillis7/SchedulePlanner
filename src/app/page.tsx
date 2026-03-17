import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAllProjects } from '@/lib/supabase/queries';

export default async function HomePage() {
  const client = await createClient();
  const projects = await getAllProjects(client);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center px-4 py-16">
      <h1 className="text-3xl font-semibold text-primary mb-1">
        SchedulePlanner
      </h1>
      <p className="text-muted-foreground mb-8">Select a project</p>

      {projects.length === 0 ? (
        <p className="text-muted-foreground text-sm">No projects found</p>
      ) : (
        <div className="grid gap-4 w-full max-w-md">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/schedule/${project.slug}`}
              className="block rounded-lg border bg-card text-card-foreground px-5 py-4 transition-shadow hover:shadow-md"
            >
              <span className="text-lg font-medium">{project.name}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
