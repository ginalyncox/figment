export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  sent: "Check your email. We sent you a sign-in link. It works for 15 minutes.",
  expired: "That sign-in link has expired. Please ask for a new one.",
  invalid: "Please enter a valid email address.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; next?: string }>;
}) {
  const { status, next } = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      <p className="muted">No password. Enter your email and we will send you a sign-in link.</p>
      {status && messages[status] ? <p className="notice" role="status">{messages[status]}</p> : null}
      <form className="stack" method="post" action="/api/auth/request">
        <input type="hidden" name="next" value={next || "/account"} />
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <button className="btn" type="submit">Email me a sign-in link</button>
      </form>
    </>
  );
}
