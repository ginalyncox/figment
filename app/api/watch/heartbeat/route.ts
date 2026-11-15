import { NextResponse } from "next/server";
import { currentUser, isSubscribed } from "@/lib/auth";
import { monthKey, sql } from "@/lib/db";

const BEAT_SECONDS = 15;
const MIN_GAP_SECONDS = 12; // ignore beats that arrive faster than real time allows

/** Adds 15 seconds of watch time for a paying subscriber. Drives creator pay, so it is strict. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !isSubscribed(user)) return NextResponse.json({ counted: false });

  const body = await request.json().catch(() => null);
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  if (!/^[0-9a-f-]{36}$/i.test(videoId)) return NextResponse.json({ counted: false }, { status: 400 });

  const rows = await sql`select creator_id, duration_seconds from videos where id = ${videoId} and status = 'published'`;
  const video = rows[0];
  // Creators cannot earn from watching their own videos.
  if (!video || video.creator_id === user.id) return NextResponse.json({ counted: false });

  // One viewer cannot add more than 3 plays of a video (or 10 minutes, for very short clips) per month.
  const cap = Math.max(600, Math.ceil(Number(video.duration_seconds || 0) * 3));

  const updated = await sql`
    insert into watch_time (user_id, video_id, month, seconds, last_beat_at)
    values (${user.id}, ${videoId}, ${monthKey()}, ${BEAT_SECONDS}, now())
    on conflict (user_id, video_id, month) do update
      set seconds = watch_time.seconds + ${BEAT_SECONDS}, last_beat_at = now()
      where watch_time.last_beat_at < now() - make_interval(secs => ${MIN_GAP_SECONDS})
        and watch_time.seconds + ${BEAT_SECONDS} <= ${cap}
    returning seconds`;

  return NextResponse.json({ counted: updated.length > 0 });
}
