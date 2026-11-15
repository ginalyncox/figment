import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Report({
  searchParams,
}: {
  searchParams: Promise<{ video?: string; status?: string }>;
}) {
  const { video, status } = await searchParams;

  if (status === "sent") {
    return (
      <>
        <h1>Report received</h1>
        <p role="status">Thank you. We emailed you a confirmation and will review your report.</p>
        <p><Link href="/">Back to videos</Link></p>
      </>
    );
  }

  return (
    <>
      <h1>Report a video</h1>
      <p>
        Use this form to ask us to remove a video. You do not need an account. See our{" "}
        <Link href="/legal/copyright">copyright policy</Link> and{" "}
        <Link href="/legal/removal">image removal policy</Link>.
      </p>
      <p className="notice">
        <strong>Intimate images:</strong> if a video shows you in an intimate or sexual way without your
        consent (real or AI-made), choose “Intimate image of me”. We remove these within 48 hours of a valid request.
      </p>
      {status === "missing" ? <p className="error" role="alert">Please fill in every field and tick the statement box.</p> : null}

      <form className="stack" method="post" action="/api/reports">
        <label>
          What is the problem?
          <select name="kind" required defaultValue="">
            <option value="" disabled>Choose one</option>
            <option value="intimate_image">Intimate image of me, shared without my consent</option>
            <option value="likeness">It uses my face or voice without my consent</option>
            <option value="copyright">It copies my copyrighted work</option>
            <option value="other">Something else</option>
          </select>
        </label>
        <label>
          Link to the video
          <input type="text" name="video_url" defaultValue={video || ""} required />
        </label>
        <label>
          Your full name
          <input type="text" name="name" autoComplete="name" required />
        </label>
        <label>
          Your email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Tell us what is wrong
          <textarea name="details" required />
        </label>
        <p className="muted">
          For copyright reports, describe your original work and where it can be seen. For reports made
          for someone else, say how you are authorized to act for them.
        </p>
        <label className="check">
          <input type="checkbox" name="good_faith" required />
          <span>
            I have a good-faith belief that this use is not authorized (or, for an intimate image, that it
            was not consensual). The information in this report is accurate, and under penalty of perjury,
            I am the person affected or am authorized to act for them.
          </span>
        </label>
        <label>
          Type your full name as your electronic signature
          <input type="text" name="signature" required />
        </label>
        {/* Hidden from people; catches simple bots. */}
        <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
          <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <button className="btn" type="submit">Send report</button>
      </form>
    </>
  );
}
