import Link from "next/link";
import { notFound } from "next/navigation";
import Player from "@/components/Player";
import { checkAccess } from "@/lib/access";
import { currentUser, isAdmin, isSubscribed, viewerKey } from "@/lib/auth";
import { config } from "@/lib/config";
import { sql } from "@/lib/db";
import { playbackTokens } from "@/lib/mux";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Watch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const rows = await sql`
    select v.*, coalesce(u.display_name, 'A creator') as creator
    from videos v join users u on u.id = v.creator_id
    where v.id = ${id}`;
  const video = rows[0];
  const user = await currentUser();

  // Unpublished videos are visible only to their creator and to admins.
  const canPreview = !!user && !!video && (user.id === video.creator_id || isAdmin(user));
  if (!video || video.status === "removed" || (video.status !== "published" && !canPreview)) notFound();
  if (!video.mux_playback_id) {
    return <p className="notice">This video is still processing. Check back in a few minutes.</p>;
  }

  const access =
    video.status !== "published"
      ? ({ allowed: true, reason: "owner", freeUsed: 0 } as const)
      : await checkAccess(user, await viewerKey(user), { id: video.id, creator_id: video.creator_id });

  if (!access.allowed) {
    return (
      <>
        <h1>{video.title}</h1>
        <div className="notice" role="status">
          <p>
            <strong>You have watched your {config.freeVideoLimit} free videos.</strong>
          </p>
          <p>Subscribe by the week or the month to keep watching. Cancel online any time.</p>
          <p className="row">
            <Link className="btn" href="/subscribe">See subscription plans</Link>
            {!user ? <Link href={`/login?next=/watch/${video.id}`}>Already subscribed? Sign in</Link> : null}
          </p>
        </div>
      </>
    );
  }

  const tokens = await playbackTokens(video.mux_playback_id);
  const subscribed = isSubscribed(user);
  const freeLeft = Math.max(0, config.freeVideoLimit - access.freeUsed);

  return (
    <>
      <h1>{video.title}</h1>
      {video.status !== "published" ? (
        <p className="notice">Preview only. This video is not published yet (status: {video.status}).</p>
      ) : null}
      <Player
        videoId={video.id}
        playbackId={video.mux_playback_id}
        playbackToken={tokens.playback}
        thumbnailToken={tokens.thumbnail}
        title={video.title}
        countWatchTime={subscribed && user?.id !== video.creator_id && video.status === "published"}
      />
      <p className="muted">
        By {video.creator} · Made with AI{video.ai_tools ? ` (${video.ai_tools})` : ""}
      </p>
      {video.description ? <p>{video.description}</p> : null}
      {access.reason === "free" ? (
        <p className="notice" role="status">
          Free video. You have {freeLeft} free {freeLeft === 1 ? "video" : "videos"} left.{" "}
          <Link href="/subscribe">Subscribe</Link> to watch everything.
        </p>
      ) : null}
      <p><Link href={`/report?video=/watch/${video.id}`}>Report this video</Link></p>
    </>
  );
}
