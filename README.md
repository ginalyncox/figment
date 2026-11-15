# Figment

A site where creators upload AI-made videos. Viewers watch a few free, then subscribe weekly or
monthly. Each month the subscription money is split: a service fee for Gina Makes LLC, and the rest
to creators by watch time.

Built with Next.js (Vercel), Neon (database), Stripe (payments and creator payouts), Mux (video),
and Resend (sign-in emails).

## Status

- **Works and is tested:** the paywall rule, the payout math (8 automated tests), the database
  tables and queries, page rendering, sign-in link creation, and the security checks.
- **Not yet tested with real accounts:** Stripe, Mux, Neon, and Resend. No keys were available when
  this was built. Test every flow in Stripe **test mode** before taking real money.
- **Legal pages are drafts.** A lawyer must review them before outside creators or paying viewers join.

## How it works

| Piece | Where |
| --- | --- |
| Free-video counter and paywall | `lib/paywall.ts`, `lib/access.ts`, `app/watch/[id]/page.tsx` |
| Weekly / monthly checkout | `app/subscribe/page.tsx`, `app/api/checkout/route.ts` |
| Cancel online (Stripe billing page) | `app/account/page.tsx`, `app/api/portal/route.ts` |
| Stripe events (payments, renewals, refunds) | `app/api/webhooks/stripe/route.ts` |
| Creator sign-up, license acceptance, payout setup | `app/creator/page.tsx`, `app/api/creator/join/route.ts` |
| Video upload (straight to Mux) | `components/UploadForm.tsx`, `app/api/creator/videos/route.ts` |
| Watch-time tracking | `components/Player.tsx`, `app/api/watch/heartbeat/route.ts` |
| Payout math | `lib/payouts.ts` (pure), `lib/payoutRun.ts` (database + Stripe) |
| Admin: approve videos, handle reports, send payouts | `app/admin/page.tsx` |
| Report / takedown form | `app/report/page.tsx`, `app/api/reports/route.ts` |
| Legal text (edit these files) | `content/legal/*.md` |

Rules built in:

- Viewers get `FREE_VIDEO_LIMIT` different videos free (default 3). Re-watching one stays free.
- Only **paying subscribers'** watch time counts toward creator pay. Free views and a creator's own
  views do not.
- Every upload waits for admin approval. Nothing goes public automatically.
- Payouts never run by themselves. An admin previews the numbers, ticks a box, and presses send.
- Your fee is `PLATFORM_FEE_BPS` (default 2000 = 20%) of revenue after Stripe fees and refunds.

## Setup

1. **Database.** Create a Neon project. Run `psql "$DATABASE_URL" -f db/schema.sql`.
2. **Stripe (test mode first).**
   - Turn on **Connect**.
   - Create one product with two recurring prices: weekly and monthly. Copy the two price ids.
   - Turn on the **customer portal** and allow cancellation there.
   - Add a webhook to `https://YOUR-SITE/api/webhooks/stripe` for both *your account* and
     *connected accounts*, with these events: `checkout.session.completed`,
     `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `charge.succeeded`, `charge.updated`, `charge.refunded`,
     `account.updated`.
3. **Mux.** Create an access token, a **signing key**, and a webhook to
   `https://YOUR-SITE/api/webhooks/mux`.
4. **Resend.** Create an API key and verify a sending domain.
5. Copy `.env.example` to `.env.local` and fill it in. Add the same values in Vercel.
6. `npm install`, then `npm run dev`.

Checks: `npm test` (rules), `npm run typecheck`, `npm run lint`, `npm run build`.

## Known gaps (do these before launch)

1. **Keep creator money in Stripe until payouts are sent.** Creator pay is sent from your Stripe
   balance. If Stripe has already paid that balance out to your bank, transfers fail. Set your own
   Stripe payout schedule to manual or monthly, after the creator run.
2. **Late refunds.** A refund that arrives after a month's payout is recorded but not yet taken back
   from creators automatically. The license allows deducting it later; the code does not do it yet.
3. **Free-view counter** uses a cookie for signed-out visitors. Clearing cookies resets it.
4. **No privacy policy yet.** Needed before launch.
5. **No sales-tax handling.** Ask an accountant; Stripe Tax can be switched on at checkout.
6. **Tax forms for creators (1099s)** are filed from the Stripe dashboard, not by this code.
7. **Removal requests** email the admin, but someone must act on them. Intimate-image requests have
   a 48-hour legal deadline.
8. Check the name "Figment" for trademark conflicts, and replace every `[BRACKET]` in `content/legal`.

© 2026 Gina Makes LLC
