-- ============================================================================
-- Initial Schema: SchedulePlanner (Home Renovation Gantt)
-- ============================================================================

-- 1. Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  include_weekends BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to projects" ON projects FOR ALL USING (true) WITH CHECK (true);

-- 2. Owners
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_info TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to owners" ON owners FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_owners_project_id ON owners(project_id);

-- 3. Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  tier_depth INTEGER NOT NULL DEFAULT 0 CHECK (tier_depth >= 0 AND tier_depth <= 3),
  sort_order INTEGER NOT NULL DEFAULT 0,
  desired_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_days FLOAT NOT NULL DEFAULT 1.0 CHECK (duration_days > 0),
  completion_pct FLOAT NOT NULL DEFAULT 0.0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_project_sort ON tasks(project_id, sort_order);

-- 4. Task Dependencies
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  upstream_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  downstream_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish-to-start',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(upstream_task_id, downstream_task_id),
  CHECK(upstream_task_id != downstream_task_id)
);

ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to task_dependencies" ON task_dependencies FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_task_dependencies_project_id ON task_dependencies(project_id);
CREATE INDEX idx_task_dependencies_upstream ON task_dependencies(upstream_task_id);
CREATE INDEX idx_task_dependencies_downstream ON task_dependencies(downstream_task_id);

-- 5. Checkpoints (progress snapshots)
CREATE TABLE checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_work_days FLOAT NOT NULL,
  completed_work_days FLOAT NOT NULL,
  notes TEXT
);

ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to checkpoints" ON checkpoints FOR ALL USING (true) WITH CHECK (true);
