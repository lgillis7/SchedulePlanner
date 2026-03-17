import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Project,
  RawTask,
  Dependency,
  Owner,
  Checkpoint,
} from '@/types/scheduling';

// ---------------------------------------------------------------------------
// Snake-case <-> camelCase mappers
// ---------------------------------------------------------------------------

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    includeWeekends: row.include_weekends as boolean,
  };
}

function mapTask(row: Record<string, unknown>): RawTask {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    parentTaskId: (row.parent_task_id as string) ?? null,
    ownerId: (row.owner_id as string) ?? null,
    title: row.title as string,
    tierDepth: row.tier_depth as RawTask['tierDepth'],
    sortOrder: row.sort_order as number,
    desiredStartDate: row.desired_start_date as string,
    durationDays: row.duration_days as number,
    completionPct: row.completion_pct as number,
    notes: (row.notes as string) ?? null,
  };
}

function mapOwner(row: Record<string, unknown>): Owner {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    contactInfo: (row.contact_info as string) ?? null,
    color: row.color as string,
    sortOrder: row.sort_order as number,
  };
}

function mapDependency(row: Record<string, unknown>): Dependency {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    upstreamTaskId: row.upstream_task_id as string,
    downstreamTaskId: row.downstream_task_id as string,
    dependencyType: row.dependency_type as 'finish-to-start',
  };
}

function mapCheckpoint(row: Record<string, unknown>): Checkpoint {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    capturedAt: row.captured_at as string,
    totalWorkDays: row.total_work_days as number,
    completedWorkDays: row.completed_work_days as number,
    notes: (row.notes as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

/** Fetch all projects ordered by name. */
export async function getAllProjects(
  client: SupabaseClient
): Promise<Array<Project & { slug: string }>> {
  const { data, error } = await client
    .from('projects')
    .select('*')
    .order('name');

  if (error) throw new Error(`Failed to load projects: ${error.message}`);
  return (data as Record<string, unknown>[]).map((row) => ({
    ...mapProject(row),
    slug: row.slug as string,
  }));
}

/** Look up a project by its URL slug. Returns null if not found. */
export async function getProjectBySlug(
  client: SupabaseClient,
  slug: string
): Promise<Project | null> {
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    // PGRST116 = no rows returned from .single()
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to load project by slug: ${error.message}`);
  }

  return mapProject(data as Record<string, unknown>);
}

/** Load all project data in one call (4 parallel queries). */
export async function getProjectWithData(
  client: SupabaseClient,
  projectId: string
): Promise<{
  project: Project;
  tasks: RawTask[];
  dependencies: Dependency[];
  owners: Owner[];
}> {
  const [projectRes, tasksRes, depsRes, ownersRes] = await Promise.all([
    client.from('projects').select('*').eq('id', projectId).single(),
    client.from('tasks').select('*').eq('project_id', projectId).order('sort_order'),
    client.from('task_dependencies').select('*').eq('project_id', projectId),
    client.from('owners').select('*').eq('project_id', projectId).order('sort_order'),
  ]);

  if (projectRes.error) throw new Error(`Failed to load project: ${projectRes.error.message}`);
  if (tasksRes.error) throw new Error(`Failed to load tasks: ${tasksRes.error.message}`);
  if (depsRes.error) throw new Error(`Failed to load dependencies: ${depsRes.error.message}`);
  if (ownersRes.error) throw new Error(`Failed to load owners: ${ownersRes.error.message}`);

  return {
    project: mapProject(projectRes.data as Record<string, unknown>),
    tasks: (tasksRes.data as Record<string, unknown>[]).map(mapTask),
    dependencies: (depsRes.data as Record<string, unknown>[]).map(mapDependency),
    owners: (ownersRes.data as Record<string, unknown>[]).map(mapOwner),
  };
}

export async function updateProject(
  client: SupabaseClient,
  projectId: string,
  updates: Partial<{ name: string; includeWeekends: boolean }>
): Promise<Project> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.includeWeekends !== undefined) dbUpdates.include_weekends = updates.includeWeekends;

  const { data, error } = await client
    .from('projects')
    .update(dbUpdates)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update project: ${error.message}`);
  return mapProject(data as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(
  client: SupabaseClient,
  task: {
    projectId: string;
    title: string;
    parentTaskId?: string;
    tierDepth: number;
    sortOrder: number;
  }
): Promise<RawTask> {
  const { data, error } = await client
    .from('tasks')
    .insert({
      project_id: task.projectId,
      title: task.title,
      parent_task_id: task.parentTaskId ?? null,
      tier_depth: task.tierDepth,
      sort_order: task.sortOrder,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return mapTask(data as Record<string, unknown>);
}

export async function updateTask(
  client: SupabaseClient,
  taskId: string,
  updates: Partial<{
    title: string;
    desiredStartDate: string;
    durationDays: number;
    completionPct: number;
    ownerId: string | null;
    parentTaskId: string | null;
    tierDepth: number;
    sortOrder: number;
    notes: string | null;
  }>
): Promise<RawTask> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.desiredStartDate !== undefined) dbUpdates.desired_start_date = updates.desiredStartDate;
  if (updates.durationDays !== undefined) dbUpdates.duration_days = updates.durationDays;
  if (updates.completionPct !== undefined) dbUpdates.completion_pct = updates.completionPct;
  if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
  if (updates.parentTaskId !== undefined) dbUpdates.parent_task_id = updates.parentTaskId;
  if (updates.tierDepth !== undefined) dbUpdates.tier_depth = updates.tierDepth;
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

  const { data, error } = await client
    .from('tasks')
    .update(dbUpdates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update task: ${error.message}`);
  return mapTask(data as Record<string, unknown>);
}

export async function deleteTask(
  client: SupabaseClient,
  taskId: string
): Promise<void> {
  const { error } = await client.from('tasks').delete().eq('id', taskId);
  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Owners
// ---------------------------------------------------------------------------

export async function createOwner(
  client: SupabaseClient,
  owner: {
    projectId: string;
    name: string;
    color: string;
    contactInfo?: string;
  }
): Promise<Owner> {
  const { data, error } = await client
    .from('owners')
    .insert({
      project_id: owner.projectId,
      name: owner.name,
      color: owner.color,
      contact_info: owner.contactInfo ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create owner: ${error.message}`);
  return mapOwner(data as Record<string, unknown>);
}

export async function updateOwner(
  client: SupabaseClient,
  ownerId: string,
  updates: Partial<{
    name: string;
    color: string;
    contactInfo: string | null;
    sortOrder: number;
  }>
): Promise<Owner> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.contactInfo !== undefined) dbUpdates.contact_info = updates.contactInfo;
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

  const { data, error } = await client
    .from('owners')
    .update(dbUpdates)
    .eq('id', ownerId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update owner: ${error.message}`);
  return mapOwner(data as Record<string, unknown>);
}

export async function deleteOwner(
  client: SupabaseClient,
  ownerId: string
): Promise<void> {
  const { error } = await client.from('owners').delete().eq('id', ownerId);
  if (error) throw new Error(`Failed to delete owner: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export async function addDependency(
  client: SupabaseClient,
  dep: {
    projectId: string;
    upstreamTaskId: string;
    downstreamTaskId: string;
  }
): Promise<Dependency> {
  const { data, error } = await client
    .from('task_dependencies')
    .insert({
      project_id: dep.projectId,
      upstream_task_id: dep.upstreamTaskId,
      downstream_task_id: dep.downstreamTaskId,
      dependency_type: 'finish-to-start',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add dependency: ${error.message}`);
  return mapDependency(data as Record<string, unknown>);
}

export async function removeDependency(
  client: SupabaseClient,
  depId: string
): Promise<void> {
  const { error } = await client
    .from('task_dependencies')
    .delete()
    .eq('id', depId);
  if (error) throw new Error(`Failed to remove dependency: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------

export async function getCheckpoints(
  client: SupabaseClient,
  projectId: string
): Promise<Checkpoint[]> {
  const { data, error } = await client
    .from('checkpoints')
    .select('*')
    .eq('project_id', projectId)
    .order('captured_at', { ascending: true });

  if (error) throw new Error(`Failed to load checkpoints: ${error.message}`);
  return (data as Record<string, unknown>[]).map(mapCheckpoint);
}

export async function createCheckpoint(
  client: SupabaseClient,
  checkpoint: {
    projectId: string;
    totalWorkDays: number;
    completedWorkDays: number;
  }
): Promise<Checkpoint> {
  const { data, error } = await client
    .from('checkpoints')
    .insert({
      project_id: checkpoint.projectId,
      total_work_days: checkpoint.totalWorkDays,
      completed_work_days: checkpoint.completedWorkDays,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create checkpoint: ${error.message}`);
  return mapCheckpoint(data as Record<string, unknown>);
}
