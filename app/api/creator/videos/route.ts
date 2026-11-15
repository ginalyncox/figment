import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { sql } from "@/lib/db";
import { mux } from "@/lib/mux";

/** Creates a video record and returns a one-time upload address. The file goes straight to Mux. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!user.is_creator || !user.license_version) {
    return NextResponse.json({ error: "Accept the Creator License Agreement first." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 2000) : "";
  const aiTools = typeof body?.aiTools === "string" ? body.aiTools.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "Add a title." }, { status: 400 });
  if (body?.rightsConfirmed !== true) {
    return NextResponse.json({ error: "Confirm the rights statement to upload." }, { status: 400 });
  }

  const pending = await sql`
    select count(*)::int as n from videos
    where creator_id = ${user.id} and status in ('uploading','processing','pending_review')`;
  if (pending[0].n >= 10) {
    return NextResponse.json({ error: "You have 10 videos waiting for review. Please wait for those first." }, { status: 429 });
  }

  const rows = await sql`
    insert into videos (creator_id, title, description, ai_tools, rights_confirmed_at)
    values (${user.id}, ${title}, ${description}, ${aiTools}, now())
    returning id`;
  const videoId: string = rows[0].id;

  const upload = await mux().video.uploads.create({
    cors_origin: config.siteUrl,
    new_asset_settings: { playback_policies: ["signed"], passthrough: videoId },
  });
  await sql`update videos set mux_upload_id = ${upload.id} where id = ${videoId}`;

  return NextResponse.json({ videoId, uploadUrl: upload.url });
}
