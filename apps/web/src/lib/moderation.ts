export const moderationStatuses = ["new", "reviewing", "resolved", "dismissed"] as const;
export type ModerationStatus = typeof moderationStatuses[number];

export function moderationTransition(current: string, next: string) {
  if (!(moderationStatuses as readonly string[]).includes(next)) return false;
  if (current === "resolved" || current === "dismissed") return false;
  return current !== next;
}
