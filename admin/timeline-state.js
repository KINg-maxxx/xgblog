function updatesFor(entries, entryIndex) {
  const entry = Array.isArray(entries) ? entries[entryIndex] : null;
  if (!entry) return null;
  if (!Array.isArray(entry.updates)) entry.updates = [];
  return entry.updates;
}

export function addTimelineUpdate(entries, entryIndex) {
  const updates = updatesFor(entries, entryIndex);
  if (!updates) return -1;
  updates.unshift({ date: '', title: '新的子更新', text: '' });
  return 0;
}

export function moveTimelineUpdate(entries, entryIndex, updateIndex, direction) {
  const updates = updatesFor(entries, entryIndex);
  if (!updates) return -1;
  const target = updateIndex + direction;
  if (target < 0 || target >= updates.length) return updateIndex;
  const [update] = updates.splice(updateIndex, 1);
  updates.splice(target, 0, update);
  return target;
}

export function removeTimelineUpdate(entries, entryIndex, updateIndex) {
  const updates = updatesFor(entries, entryIndex);
  if (!updates || updateIndex < 0 || updateIndex >= updates.length) return -1;
  updates.splice(updateIndex, 1);
  return updates.length ? Math.min(updateIndex, updates.length - 1) : -1;
}
