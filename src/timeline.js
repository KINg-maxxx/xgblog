export const TIMELINE_PREVIEW_LIMIT = 2;

export function getTimelineUpdateView(value, expanded) {
  const updates = Array.isArray(value) ? value : [];
  return {
    updates,
    visibleCount: expanded ? updates.length : Math.min(updates.length, TIMELINE_PREVIEW_LIMIT),
    hiddenCount: Math.max(0, updates.length - TIMELINE_PREVIEW_LIMIT),
  };
}
