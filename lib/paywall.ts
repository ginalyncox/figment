// The paywall rule on its own, with no database in it, so it can be tested.

/**
 * The paywall rule, with no database in it, so it can be tested.
 *  - Subscribers and the video's own creator always watch.
 *  - Everyone else gets `limit` different videos free. Re-watching one of those stays free.
 */
export function decideAccess(input: {
  subscribed: boolean;
  isOwner: boolean;
  alreadyFreeViewed: boolean;
  freeUsed: number;
  limit: number;
}): { allowed: boolean; reason: "subscriber" | "owner" | "free" | "paywall"; recordFreeView: boolean } {
  if (input.subscribed) return { allowed: true, reason: "subscriber", recordFreeView: false };
  if (input.isOwner) return { allowed: true, reason: "owner", recordFreeView: false };
  if (input.alreadyFreeViewed) return { allowed: true, reason: "free", recordFreeView: false };
  if (input.freeUsed < input.limit) return { allowed: true, reason: "free", recordFreeView: true };
  return { allowed: false, reason: "paywall", recordFreeView: false };
}
