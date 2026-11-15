import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { mux } from "@/lib/mux";

// Mux calls this URL when an uploaded video has finished processing.

export async function POST(request: Request) {
  const body = await request.text();

  let event;
  try {
    event = await mux().webhooks.unwrap(body, request.headers); // checks the signature
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (event.type === "video.upload.asset_created") {
    const uploadId = event.data.id;
    const assetId = event.data.asset_id;
    if (uploadId && assetId) {
      await sql`update videos set mux_asset_id = ${assetId}, status = 'processing'
                where mux_upload_id = ${uploadId} and status = 'uploading'`;
    }
  }

  if (event.type === "video.asset.ready") {
    const asset = event.data;
    const playbackId = asset.playback_ids?.find((p) => p.policy === "signed")?.id ?? null;
    const videoId = asset.passthrough || "";
    if (playbackId && /^[0-9a-f-]{36}$/i.test(videoId)) {
      // Ready videos wait for a human review. Nothing goes public automatically.
      await sql`
        update videos
        set mux_asset_id = ${asset.id}, mux_playback_id = ${playbackId},
            duration_seconds = ${asset.duration ?? null}, status = 'pending_review'
        where id = ${videoId} and status in ('uploading','processing')`;
    }
  }

  if (event.type === "video.asset.errored") {
    const videoId = event.data.passthrough || "";
    if (/^[0-9a-f-]{36}$/i.test(videoId)) {
      await sql`update videos set status = 'removed', removed_reason = 'Processing failed'
                where id = ${videoId} and status in ('uploading','processing')`;
    }
  }

  return NextResponse.json({ received: true });
}
