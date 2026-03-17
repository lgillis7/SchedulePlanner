-- ============================================================================
-- Migration: Two-tier RLS (read open, write gated) + slug column
-- ============================================================================

-- Add slug column to projects
ALTER TABLE projects ADD COLUMN slug TEXT UNIQUE;

-- Set default slug for existing project
UPDATE projects SET slug = 'kitchen-reno' WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================================================
-- Drop existing permissive policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow all access to projects" ON projects;
DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;
DROP POLICY IF EXISTS "Allow all access to owners" ON owners;
DROP POLICY IF EXISTS "Allow all access to task_dependencies" ON task_dependencies;
DROP POLICY IF EXISTS "Allow all access to checkpoints" ON checkpoints;

-- ============================================================================
-- Read policies: open to everyone (anon key has role 'anon')
-- ============================================================================

CREATE POLICY "Public read projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Public read tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "Public read owners" ON owners FOR SELECT USING (true);
CREATE POLICY "Public read task_dependencies" ON task_dependencies FOR SELECT USING (true);
CREATE POLICY "Public read checkpoints" ON checkpoints FOR SELECT USING (true);

-- ============================================================================
-- Write policies: editor role only (custom JWT has role 'authenticated')
-- The anon key JWT has role 'anon', so these policies block it.
-- ============================================================================

-- Projects
CREATE POLICY "Editor insert projects" ON projects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editor update projects" ON projects FOR UPDATE
  USING (auth.role() = 'authenticated');
CREATE POLICY "Editor delete projects" ON projects FOR DELETE
  USING (auth.role() = 'authenticated');

-- Tasks
CREATE POLICY "Editor insert tasks" ON tasks FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editor update tasks" ON tasks FOR UPDATE
  USING (auth.role() = 'authenticated');
CREATE POLICY "Editor delete tasks" ON tasks FOR DELETE
  USING (auth.role() = 'authenticated');

-- Owners
CREATE POLICY "Editor insert owners" ON owners FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editor update owners" ON owners FOR UPDATE
  USING (auth.role() = 'authenticated');
CREATE POLICY "Editor delete owners" ON owners FOR DELETE
  USING (auth.role() = 'authenticated');

-- Task Dependencies
CREATE POLICY "Editor insert task_dependencies" ON task_dependencies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editor update task_dependencies" ON task_dependencies FOR UPDATE
  USING (auth.role() = 'authenticated');
CREATE POLICY "Editor delete task_dependencies" ON task_dependencies FOR DELETE
  USING (auth.role() = 'authenticated');

-- Checkpoints
CREATE POLICY "Editor insert checkpoints" ON checkpoints FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editor update checkpoints" ON checkpoints FOR UPDATE
  USING (auth.role() = 'authenticated');
CREATE POLICY "Editor delete checkpoints" ON checkpoints FOR DELETE
  USING (auth.role() = 'authenticated');
