/**
 * Sort tasks in tree order: parent -> children (recursively), siblings by sortOrder.
 * Used by ScheduleClient to produce a flat array matching the visual display order.
 */
export function treeSortTasks<
  T extends { id: string; parentTaskId: string | null; sortOrder: number }
>(tasks: T[]): T[] {
  const byParent = new Map<string | null, T[]>();
  for (const t of tasks) {
    const key = t.parentTaskId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const result: T[] = [];
  function visit(parentId: string | null) {
    for (const task of byParent.get(parentId) ?? []) {
      result.push(task);
      visit(task.id);
    }
  }
  visit(null);
  return result;
}
