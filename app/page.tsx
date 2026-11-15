import Link from "next/link";
import { config } from "@/lib/config";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const videos = await sql`
    select v.id, v.title, v.description, v.ai_tools, v.duration_seconds,
           coalesce(u.display_name, 'A creator') as creator
    from videos v join users u on u.id = v.creator_id
    where v.status = 'published'
    order by v.published_at desc
    limit 60`;

  return (
    <>
      <h1>AI-made videos from independent creators</h1>
      <p className="muted">
        Watch {config.freeVideoLimit} videos free. After that, subscribe by the week or the month.
        Creators are paid from every subscription.
      </p>

      {videos.length === 0 ? (
        <p className="notice">No videos yet. Creators can <Link href="/creator">upload the first one</Link>.</p>
      ) : (
        <ul className="grid">
          {videos.map((v) => (
            <li className="card" key={v.id}>
              <h2>
                {/* prefetch is off so hovering a link never uses up a free video */}
                <Link className="title" href={`/watch/${v.id}`} prefetch={false}>{v.title}</Link>
              </h2>
              <p className="muted">
                By {v.creator}
                {v.duration_seconds ? ` · ${Math.max(1, Math.round(Number(v.duration_seconds) / 60))} min` : ""}
              </p>
              {v.description ? <p>{String(v.description).slice(0, 140)}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
