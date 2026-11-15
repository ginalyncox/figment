"use client";

import MuxUploader from "@mux/mux-uploader-react";
import { useState } from "react";

export default function UploadForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [aiTools, setAiTools] = useState("");
  const [rights, setRights] = useState(false);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/creator/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, aiTools, rightsConfirmed: rights }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setUploadUrl(data.uploadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="notice" role="status">
        Upload complete. Your video is processing, then it waits for review before it goes live.{" "}
        <a href="/creator">Refresh your dashboard</a>
      </p>
    );
  }

  if (uploadUrl) {
    return (
      <div>
        <p><strong>Step 2:</strong> choose the video file for “{title}”.</p>
        <MuxUploader endpoint={uploadUrl} onSuccess={() => setDone(true)} />
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={start}>
      <label>
        Title
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </label>
      <label>
        AI tools used (shown to viewers)
        <input type="text" value={aiTools} onChange={(e) => setAiTools(e.target.value)} maxLength={200} placeholder="Example: Sora, Runway, ElevenLabs" />
      </label>
      <label className="check">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} required />
        <span>
          I made this video and have the rights to license it. It does not use a real person’s face or
          voice without their written consent, and it contains no nudity or sexual content.
        </span>
      </label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Starting…" : "Next: choose file"}</button>
    </form>
  );
}
