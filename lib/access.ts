import { config } from "./config";
import { isSubscribed } from "./auth";
import { sql, type User } from "./db";
import { decideAccess } from "./paywall";

export type Access =
  | { allowed: true; reason: "subscriber" | "owner" | "free"; freeUsed: number }
  | { allowed: false; reason: "paywall" | "no_viewer"; freeUsed: number };

export async function checkAccess(
  user: User | null,
  viewerKey: string | null,
  video: { id: string; creator_id: string },
): Promise<Access> {
  const subscribed = isSubscribed(user);
  const isOwner = !!user && user.id === video.creator_id;
  if (subscribed) return { allowed: true, reason: "subscriber", freeUsed: 0 };
  if (isOwner) return { allowed: true, reason: "owner", freeUsed: 0 };
  if (!viewerKey) return { allowed: false, reason: "no_viewer", freeUsed: 0 };

  const rows = await sql`select video_id from free_views where viewer_key = ${viewerKey}`;
  const freeUsed = rows.length;
  const alreadyFreeViewed = rows.some((r) => r.video_id === video.id);

  const decision = decideAccess({
    subscribed,
    isOwner,
    alreadyFreeViewed,
    freeUsed,
    limit: config.freeVideoLimit,
  });

  if (!decision.allowed) return { allowed: false, reason: "paywall", freeUsed };

  if (decision.recordFreeView) {
    await sql`
      insert into free_views (viewer_key, video_id) values (${viewerKey}, ${video.id})
      on conflict do nothing`;
    return { allowed: true, reason: "free", freeUsed: freeUsed + 1 };
  }
  return { allowed: true, reason: "free", freeUsed };
}
